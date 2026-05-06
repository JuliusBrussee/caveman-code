import { Container, getKeybindings, type OverlayHandle, Spacer, Text, type TUI } from "@cave/tui";
import { theme } from "../theme/theme.js";

export interface ConfirmPromptOptions {
	question: string;
	detail?: string;
	danger?: boolean;
	defaultAnswer?: "yes" | "no";
}

interface InternalOpts extends ConfirmPromptOptions {
	onChoose: (answer: "yes" | "no") => void;
}

const ANSWERS: ReadonlyArray<{ value: "yes" | "no"; label: string }> = [
	{ value: "no", label: "No" },
	{ value: "yes", label: "Yes" },
];

export class ConfirmPromptComponent extends Container {
	private selectedIndex: number;
	private listContainer: Container;

	constructor(private readonly opts: InternalOpts) {
		super();
		const defaultIdx = ANSWERS.findIndex((a) => a.value === (opts.defaultAnswer ?? "no"));
		this.selectedIndex = Math.max(0, defaultIdx);
		const borderColor = opts.danger ? "error" : "warning";

		this.addChild(new Text(theme.fg(borderColor, doubleBorderTop()), 0, 0));
		this.addChild(new Spacer(1));
		this.addChild(new Text(`${opts.danger ? "⛔" : "▸"}  ${theme.bold(opts.question)}`, 1, 0));
		if (opts.detail) {
			this.addChild(new Text(theme.fg("muted", opts.detail), 3, 0));
		}
		this.addChild(new Spacer(1));

		this.listContainer = new Container();
		this.addChild(this.listContainer);
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("dim", "↑/↓ select · Enter confirm · Y/N quick · Esc cancel"), 1, 0));
		this.addChild(new Text(theme.fg(borderColor, doubleBorderBottom()), 0, 0));
		this.updateList();
	}

	handleInput(data: string): void {
		const kb = getKeybindings();
		if (kb.matches(data, "tui.select.up")) {
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
			this.updateList();
			return;
		}
		if (kb.matches(data, "tui.select.down")) {
			this.selectedIndex = Math.min(ANSWERS.length - 1, this.selectedIndex + 1);
			this.updateList();
			return;
		}
		if (kb.matches(data, "tui.select.confirm")) {
			this.opts.onChoose(ANSWERS[this.selectedIndex].value);
			return;
		}
		if (data === "y" || data === "Y") {
			this.opts.onChoose("yes");
			return;
		}
		if (data === "n" || data === "N") {
			this.opts.onChoose("no");
			return;
		}
		if (kb.matches(data, "tui.select.cancel") || data === "\x03") {
			this.opts.onChoose("no");
		}
	}

	private updateList(): void {
		this.listContainer.clear();
		for (let i = 0; i < ANSWERS.length; i++) {
			const a = ANSWERS[i];
			const isSelected = i === this.selectedIndex;
			const prefix = isSelected ? theme.fg("accent", "▸ ") : "  ";
			const label = isSelected ? theme.fg("accent", a.label) : theme.fg("text", a.label);
			this.listContainer.addChild(new Text(`${prefix}${label}`, 1, 0));
		}
	}
}

export async function showConfirmPrompt(tui: TUI, opts: ConfirmPromptOptions): Promise<"yes" | "no"> {
	return new Promise((resolve) => {
		let handle: OverlayHandle | null = null;
		const finish = (answer: "yes" | "no"): void => {
			handle?.hide();
			resolve(answer);
		};
		const component = new ConfirmPromptComponent({ ...opts, onChoose: finish });
		handle = tui.showOverlay(component, { anchor: "center" });
		handle.focus();
	});
}

function doubleBorderTop(): string {
	return "╔════════════════════════════════════════════════╗";
}

function doubleBorderBottom(): string {
	return "╚════════════════════════════════════════════════╝";
}
