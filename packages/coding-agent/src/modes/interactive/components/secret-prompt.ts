import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { Container, getKeybindings, type OverlayHandle, Spacer, Text, type TUI, visibleWidth } from "@cave/tui";
import { theme } from "../theme/theme.js";

export interface SecretPromptOptions {
	prompt: string;
	hint?: string;
	/** When set, audit-log the prompt event (not the value) under this label. */
	auditLabel?: string;
	/** Where to write audit entries; default ~/.cave/audit.log */
	auditPath?: string;
	/** Mask character; default • */
	maskChar?: string;
}

interface InternalOpts extends SecretPromptOptions {
	onSubmit: (value: string) => void;
	onCancel: () => void;
}

export class SecretPromptComponent extends Container {
	private buffer = "";
	private inputText: Text;
	private maskChar: string;

	constructor(private readonly opts: InternalOpts) {
		super();
		this.maskChar = opts.maskChar ?? "•";

		this.addChild(new Text(theme.fg("border", doubleBorderTop()), 0, 0));
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.bold(opts.prompt), 1, 0));
		if (opts.hint) {
			this.addChild(new Text(theme.fg("muted", opts.hint), 3, 0));
		}
		this.addChild(new Spacer(1));
		this.inputText = new Text("", 3, 0);
		this.addChild(this.inputText);
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("dim", "Enter submit · Backspace edit · Esc cancel · ^C cancel"), 1, 0));
		this.addChild(new Text(theme.fg("border", doubleBorderBottom()), 0, 0));
		this.refresh();
	}

	handleInput(data: string): void {
		const kb = getKeybindings();
		if (kb.matches(data, "tui.select.confirm")) {
			const value = this.buffer;
			this.buffer = "";
			if (this.opts.auditLabel) auditEvent(this.opts.auditPath, this.opts.auditLabel);
			this.opts.onSubmit(value);
			return;
		}
		if (kb.matches(data, "tui.select.cancel") || data === "\x03") {
			this.buffer = "";
			this.opts.onCancel();
			return;
		}
		// Backspace (\x7f) or DEL (\b)
		if (data === "\x7f" || data === "\b") {
			this.buffer = this.buffer.slice(0, -1);
			this.refresh();
			return;
		}
		// Filter to printable single chars (no escapes, no kitty-style sequences)
		if (data.length === 1 && data.charCodeAt(0) >= 0x20 && data.charCodeAt(0) !== 0x7f) {
			this.buffer += data;
			this.refresh();
		}
	}

	private refresh(): void {
		const masked = this.buffer.length > 0 ? this.maskChar.repeat(visibleWidth(this.buffer)) : "";
		const display = masked.length > 0 ? theme.fg("accent", masked) : theme.fg("dim", "(empty)");
		this.inputText.setText(display);
	}
}

export async function promptSecret(tui: TUI, opts: SecretPromptOptions): Promise<string | null> {
	return new Promise((resolve) => {
		let handle: OverlayHandle | null = null;
		const cleanup = (value: string | null): void => {
			handle?.hide();
			resolve(value);
		};
		const component = new SecretPromptComponent({
			...opts,
			onSubmit: (v) => cleanup(v),
			onCancel: () => cleanup(null),
		});
		handle = tui.showOverlay(component, { anchor: "center" });
		handle.focus();
	});
}

function auditEvent(auditPath: string | undefined, label: string): void {
	const path = auditPath ?? defaultAuditPath();
	try {
		mkdirSync(dirname(path), { recursive: true });
		const line = `${new Date().toISOString()} secret-prompt label=${JSON.stringify(label)} value=<redacted>\n`;
		appendFileSync(path, line);
	} catch {
		// Auditing is best-effort.
	}
}

function defaultAuditPath(): string {
	const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
	return join(home, ".cave", "audit.log");
}

function doubleBorderTop(): string {
	return "╔════════════════════════════════════════════════╗";
}

function doubleBorderBottom(): string {
	return "╚════════════════════════════════════════════════╝";
}
