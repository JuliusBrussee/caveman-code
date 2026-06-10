import { formatElapsed } from "../format-elapsed.js";
import { getSpinner, SPINNERS, type SpinnerName, type SpinnerVariant } from "../spinners.js";
import type { TUI } from "../tui.js";
import { Text } from "./text.js";

/**
 * Loader component that updates with a spinning animation.
 *
 * Uses the shared spinners library (`SPINNERS.breathe` by default). Pass
 * `variant: "scan" | "helix" | ...` to swap the frame set.
 */
export class Loader extends Text {
	private spinner: SpinnerVariant;
	private currentFrame = 0;
	private intervalId: NodeJS.Timeout | null = null;
	private ui: TUI | null = null;
	// Set once at construction so setVariant()'s stop/start never resets elapsed.
	private readonly startTime = Date.now();

	constructor(
		ui: TUI,
		private spinnerColorFn: (str: string) => string,
		private messageColorFn: (str: string) => string,
		private message: string = "Loading...",
		variant?: SpinnerName | SpinnerVariant,
		private showElapsed = false,
	) {
		super("", 1, 0);
		this.ui = ui;
		this.spinner = resolveVariant(variant);
		this.start();
	}

	render(width: number): string[] {
		return ["", ...super.render(width)];
	}

	start() {
		this.updateDisplay();
		this.intervalId = setInterval(() => {
			this.currentFrame = (this.currentFrame + 1) % this.spinner.frames.length;
			this.updateDisplay();
		}, this.spinner.interval);
	}

	stop() {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	setMessage(message: string) {
		this.message = message;
		this.updateDisplay();
	}

	setVariant(variant: SpinnerName | SpinnerVariant): void {
		this.stop();
		this.spinner = resolveVariant(variant);
		this.currentFrame = 0;
		this.start();
	}

	private updateDisplay() {
		const frame = this.spinner.frames[this.currentFrame];
		let line = `${this.spinnerColorFn(frame)} ${this.messageColorFn(this.message)}`;
		if (this.showElapsed) {
			const elapsed = formatElapsed(Date.now() - this.startTime);
			line += ` ${this.messageColorFn(`(${elapsed})`)}`;
		}
		this.setText(line);
		if (this.ui) {
			this.ui.requestRender();
		}
	}
}

function resolveVariant(input?: SpinnerName | SpinnerVariant): SpinnerVariant {
	if (!input) return SPINNERS.breathe;
	if (typeof input === "string") return getSpinner(input, "breathe");
	return input;
}
