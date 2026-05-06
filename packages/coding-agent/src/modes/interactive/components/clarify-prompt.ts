import { Container, getKeybindings, type OverlayHandle, Spacer, Text, type TUI } from "@cave/tui";
import { theme } from "../theme/theme.js";

export interface ClarifyPromptOptions {
	question: string;
	choices?: string[];
	allowFreeText?: boolean;
}

interface InternalOpts extends ClarifyPromptOptions {
	onSubmit: (answer: string) => void;
	onCancel: () => void;
}

type Mode = "choice" | "typing";

const OTHER_LABEL = "Other (type your answer)";

export class ClarifyPromptComponent extends Container {
	private mode: Mode = "choice";
	private selected = 0;
	private buffer = "";
	private listContainer: Container;
	private inputText: Text;
	private hintText: Text;
	private effectiveChoices: string[];

	constructor(private readonly opts: InternalOpts) {
		super();
		const choices = opts.choices ?? [];
		const allowFree = opts.allowFreeText ?? choices.length === 0;
		this.effectiveChoices =
			choices.length === 0 ? [OTHER_LABEL] : allowFree ? [...choices, OTHER_LABEL] : [...choices];

		this.addChild(new Text(theme.bold(`ask ${opts.question}`), 1, 0));
		this.addChild(new Spacer(1));
		this.listContainer = new Container();
		this.addChild(this.listContainer);
		this.inputText = new Text("", 3, 0);
		this.hintText = new Text("", 1, 0);
		this.addChild(this.inputText);
		this.addChild(new Spacer(1));
		this.addChild(this.hintText);
		this.refresh();
		// If we only have OTHER (no choices given), jump straight to typing.
		if (this.effectiveChoices.length === 1 && this.effectiveChoices[0] === OTHER_LABEL) {
			this.mode = "typing";
			this.refresh();
		}
	}

	handleInput(data: string): void {
		const kb = getKeybindings();
		if (this.mode === "choice") {
			if (kb.matches(data, "tui.select.up")) {
				this.selected = Math.max(0, this.selected - 1);
				this.refresh();
				return;
			}
			if (kb.matches(data, "tui.select.down")) {
				this.selected = Math.min(this.effectiveChoices.length - 1, this.selected + 1);
				this.refresh();
				return;
			}
			// 1-9 quick keys
			if (data.length === 1 && data >= "1" && data <= "9") {
				const idx = Number.parseInt(data, 10) - 1;
				if (idx < this.effectiveChoices.length) {
					this.selected = idx;
					this.commitChoice();
					return;
				}
			}
			if (kb.matches(data, "tui.select.confirm")) {
				this.commitChoice();
				return;
			}
			if (kb.matches(data, "tui.select.cancel") || data === "\x03") {
				this.opts.onCancel();
				return;
			}
			return;
		}

		// typing mode
		if (kb.matches(data, "tui.select.confirm")) {
			const value = this.buffer.trim();
			if (value.length > 0) this.opts.onSubmit(value);
			return;
		}
		if (data === "\x7f" || data === "\b") {
			this.buffer = this.buffer.slice(0, -1);
			this.refresh();
			return;
		}
		if (kb.matches(data, "tui.select.cancel")) {
			// Esc returns to choice list when choices exist; otherwise cancel.
			if (this.effectiveChoices.length > 1) {
				this.mode = "choice";
				this.buffer = "";
				this.refresh();
				return;
			}
			this.opts.onCancel();
			return;
		}
		if (data === "\x03") {
			this.opts.onCancel();
			return;
		}
		if (data.length === 1 && data.charCodeAt(0) >= 0x20 && data.charCodeAt(0) !== 0x7f) {
			this.buffer += data;
			this.refresh();
		}
	}

	private commitChoice(): void {
		const choice = this.effectiveChoices[this.selected];
		if (choice === OTHER_LABEL) {
			this.mode = "typing";
			this.refresh();
			return;
		}
		this.opts.onSubmit(choice);
	}

	private refresh(): void {
		this.listContainer.clear();
		if (this.mode === "choice") {
			for (let i = 0; i < this.effectiveChoices.length; i++) {
				const isSelected = i === this.selected;
				const prefix = isSelected ? theme.fg("accent", "▸ ") : "  ";
				const numStyled = theme.fg("dim", `${i + 1}.`);
				const labelStyled = isSelected
					? theme.fg("accent", this.effectiveChoices[i])
					: theme.fg("text", this.effectiveChoices[i]);
				this.listContainer.addChild(new Text(`${prefix}${numStyled} ${labelStyled}`, 1, 0));
			}
			this.inputText.setText("");
			this.hintText.setText(theme.fg("dim", "↑/↓ select · Enter confirm · 1-9 quick · Esc cancel"));
			return;
		}
		// typing
		const echo = this.buffer.length > 0 ? this.buffer : theme.fg("dim", "(type your answer)");
		this.inputText.setText(`> ${echo}`);
		this.hintText.setText(
			theme.fg(
				"dim",
				this.effectiveChoices.length > 1
					? "Enter submit · Backspace edit · Esc back to choices"
					: "Enter submit · Backspace edit · Esc cancel",
			),
		);
	}
}

export async function promptClarify(tui: TUI, opts: ClarifyPromptOptions): Promise<string | null> {
	return new Promise((resolve) => {
		let handle: OverlayHandle | null = null;
		const finish = (answer: string | null): void => {
			handle?.hide();
			resolve(answer);
		};
		const component = new ClarifyPromptComponent({
			...opts,
			onSubmit: (s) => finish(s),
			onCancel: () => finish(null),
		});
		handle = tui.showOverlay(component, { anchor: "center" });
		handle.focus();
	});
}
