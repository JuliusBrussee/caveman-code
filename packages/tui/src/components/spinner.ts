import { getSpinner, SPINNERS, type SpinnerName, type SpinnerVariant } from "../spinners.js";
import type { TUI } from "../tui.js";
import { Text } from "./text.js";

export interface SpinnerOptions {
	variant?: SpinnerName | SpinnerVariant;
	colorFn?: (text: string) => string;
	message?: string;
	messageColorFn?: (text: string) => string;
	paddingX?: number;
	paddingY?: number;
}

/**
 * Standalone spinner that drives its own animation timer.
 *
 * Subclasses Text so it composes inside any Container that already renders Text.
 * Call dispose() (or removeChild on the parent) to release the timer.
 */
export class Spinner extends Text {
	private spinner: SpinnerVariant;
	private colorFn: (text: string) => string;
	private messageColorFn: (text: string) => string;
	private message: string;
	private currentFrame = 0;
	private intervalId: NodeJS.Timeout | null = null;
	private ui: TUI | null;

	constructor(ui: TUI | null, options: SpinnerOptions = {}) {
		super("", options.paddingX ?? 1, options.paddingY ?? 0);
		this.ui = ui;
		this.spinner = resolveVariant(options.variant);
		this.colorFn = options.colorFn ?? identity;
		this.messageColorFn = options.messageColorFn ?? identity;
		this.message = options.message ?? "";
		this.start();
	}

	setVariant(variant: SpinnerName | SpinnerVariant): void {
		this.stop();
		this.spinner = resolveVariant(variant);
		this.currentFrame = 0;
		this.start();
	}

	setMessage(message: string): void {
		this.message = message;
		this.updateDisplay();
	}

	setColorFn(fn: (text: string) => string): void {
		this.colorFn = fn;
		this.updateDisplay();
	}

	start(): void {
		if (this.intervalId) return;
		this.updateDisplay();
		this.intervalId = setInterval(() => {
			this.currentFrame = (this.currentFrame + 1) % this.spinner.frames.length;
			this.updateDisplay();
		}, this.spinner.interval);
	}

	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	dispose(): void {
		this.stop();
	}

	private updateDisplay(): void {
		const frame = this.spinner.frames[this.currentFrame];
		const composed = this.message
			? `${this.colorFn(frame)} ${this.messageColorFn(this.message)}`
			: this.colorFn(frame);
		this.setText(composed);
		this.ui?.requestRender();
	}
}

function identity(text: string): string {
	return text;
}

function resolveVariant(input?: SpinnerName | SpinnerVariant): SpinnerVariant {
	if (!input) return SPINNERS.breathe;
	if (typeof input === "string") return getSpinner(input, "breathe");
	return input;
}
