import { Container, getKeybindings, type OverlayHandle, Spacer, Text, type TUI, truncateToWidth } from "@cave/tui";
import { theme } from "../theme/theme.js";

export type QueuedMode = "steer" | "followUp";

export interface QueuedItem {
	mode: QueuedMode;
	text: string;
}

export interface QueuedMessagesResult {
	kept: QueuedItem[];
	editIndex?: number;
}

interface InternalOpts {
	items: QueuedItem[];
	onAccept: (result: QueuedMessagesResult) => void;
	onCancel: () => void;
}

export class QueuedMessagesComponent extends Container {
	private items: QueuedItem[];
	private selected = 0;
	private listContainer: Container;
	private titleText: Text;

	constructor(private readonly opts: InternalOpts) {
		super();
		this.items = opts.items.slice();

		this.titleText = new Text(this.title(), 1, 0);
		this.addChild(this.titleText);
		this.listContainer = new Container();
		this.addChild(this.listContainer);
		this.addChild(new Spacer(1));
		this.addChild(
			new Text(theme.fg("dim", "↑/↓ select · Enter edit · Del remove · Tab switch mode · Esc cancel"), 1, 0),
		);
		this.refreshList();
	}

	handleInput(data: string): void {
		const kb = getKeybindings();
		if (kb.matches(data, "tui.select.up")) {
			this.selected = Math.max(0, this.selected - 1);
			this.refreshList();
			return;
		}
		if (kb.matches(data, "tui.select.down")) {
			this.selected = Math.min(Math.max(0, this.items.length - 1), this.selected + 1);
			this.refreshList();
			return;
		}
		if (data === "\x7f" || data === "\b" || data === "x" || data === "X" || data === "\x1b[3~") {
			// Backspace, Delete, x → remove
			if (this.items.length > 0) {
				this.items.splice(this.selected, 1);
				this.selected = Math.min(this.selected, Math.max(0, this.items.length - 1));
				this.refreshList();
				this.titleText.setText(this.title());
			}
			return;
		}
		if (data === "\t") {
			// Tab → toggle mode of selected
			if (this.items.length > 0) {
				const cur = this.items[this.selected];
				this.items[this.selected] = {
					...cur,
					mode: cur.mode === "steer" ? "followUp" : "steer",
				};
				this.refreshList();
			}
			return;
		}
		if (kb.matches(data, "tui.select.confirm")) {
			if (this.items.length === 0) {
				this.opts.onAccept({ kept: [] });
				return;
			}
			this.opts.onAccept({ kept: this.items, editIndex: this.selected });
			return;
		}
		if (kb.matches(data, "tui.select.cancel") || data === "\x03") {
			this.opts.onCancel();
		}
	}

	private title(): string {
		return theme.bold(theme.fg("accent", `queued (${this.items.length})`));
	}

	private refreshList(): void {
		this.listContainer.clear();
		if (this.items.length === 0) {
			this.listContainer.addChild(new Text(theme.fg("dim", "  (no queued messages)"), 1, 0));
			return;
		}
		const cols = process.stdout.columns ?? 80;
		const budget = Math.max(20, cols - 12);
		for (let i = 0; i < this.items.length; i++) {
			const item = this.items[i];
			const isSelected = i === this.selected;
			const num = `${i + 1}.`;
			const tag = item.mode === "steer" ? theme.fg("warning", "[steer]   ") : theme.fg("muted", "[followUp]");
			const flat = item.text.replace(/\s+/g, " ").trim();
			const line = truncateToWidth(flat, budget, "…");
			const prefix = isSelected ? theme.fg("accent", "▸ ") : "  ";
			const numStyled = isSelected ? theme.fg("accent", num) : theme.fg("dim", num);
			const lineStyled = isSelected ? theme.fg("accent", line) : theme.fg("text", line);
			this.listContainer.addChild(new Text(`${prefix}${numStyled} ${tag} ${lineStyled}`, 1, 0));
		}
	}
}

export interface ShowQueuedMessagesOptions {
	items: QueuedItem[];
}

export async function showQueuedMessages(
	tui: TUI,
	opts: ShowQueuedMessagesOptions,
): Promise<QueuedMessagesResult | null> {
	return new Promise((resolve) => {
		let handle: OverlayHandle | null = null;
		const finish = (result: QueuedMessagesResult | null): void => {
			handle?.hide();
			resolve(result);
		};
		const component = new QueuedMessagesComponent({
			items: opts.items,
			onAccept: (r) => finish(r),
			onCancel: () => finish(null),
		});
		handle = tui.showOverlay(component, { anchor: "center" });
		handle.focus();
	});
}
