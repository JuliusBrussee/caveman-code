import { type Component, truncateToWidth, visibleWidth } from "@cavepi/pi-tui";
import { theme } from "../theme/theme.js";
import { keyText } from "./keybinding-hints.js";

export interface ActionBarState {
	isStreaming: boolean;
	thinkingLevel: string;
	modelName: string;
	toolsExpanded: boolean;
	caveModeEnabled: boolean;
	caveModeIntensity: string;
	queuedMessageCount: number;
	isBashMode: boolean;
	cavekitActive: boolean;
}

interface Chip {
	text: string;
	width: number;
}

function chip(key: string, value: string, valueColor: "accent" | "muted" | "dim" = "muted"): Chip {
	const text = `${theme.fg("dim", key)} ${theme.fg(valueColor, value)}`;
	const width = visibleWidth(text);
	return { text, width };
}

function labelChip(label: string, color: "accent" | "muted" | "dim" = "muted"): Chip {
	const text = theme.fg(color, label);
	const width = visibleWidth(text);
	return { text, width };
}

/**
 * Contextual action bar rendered between the editor and footer.
 * Shows keybinding hints and actions based on the current interaction state.
 */
export class ActionBarComponent implements Component {
	constructor(private stateAccessor: () => ActionBarState) {}

	invalidate(): void {
		// No cached state to invalidate - renders fresh from stateAccessor each time
	}

	render(width: number): string[] {
		const state = this.stateAccessor();
		const chips = this.buildChips(state);
		if (chips.length === 0) return [];

		const sep = ` ${theme.fg("border", "│")} `;
		const sepWidth = 3; // " │ "

		// Build the line by adding chips left-to-right until we run out of space
		const parts: string[] = [];
		let usedWidth = 1; // leading space

		for (let i = 0; i < chips.length; i++) {
			const c = chips[i]!;
			const needsSep = parts.length > 0;
			const addedWidth = c.width + (needsSep ? sepWidth : 0);

			if (usedWidth + addedWidth > width) break;

			if (needsSep) parts.push(sep);
			parts.push(c.text);
			usedWidth += addedWidth;
		}

		const line = ` ${parts.join("")}`;
		return [truncateToWidth(line, width, theme.fg("dim", "..."))];
	}

	private buildChips(state: ActionBarState): Chip[] {
		if (state.isStreaming) {
			return this.buildStreamingChips();
		}
		if (state.isBashMode) {
			return this.buildBashChips();
		}
		return this.buildIdleChips(state);
	}

	private buildStreamingChips(): Chip[] {
		return [
			chip(keyText("app.interrupt"), "stop", "accent"),
			chip(keyText("app.tools.expand"), "toggle tools"),
			chip(keyText("app.thinking.toggle"), "toggle thinking"),
		];
	}

	private buildBashChips(): Chip[] {
		return [
			chip("enter", "run"),
			labelChip("!! no-context"),
			chip(keyText("app.editor.external"), "external editor"),
			chip(keyText("app.interrupt"), "exit bash"),
		];
	}

	private buildIdleChips(state: ActionBarState): Chip[] {
		const chips: Chip[] = [];

		// Thinking level - colored by level
		const thinkingColor = state.thinkingLevel !== "off" ? "accent" : "muted";
		chips.push(chip(keyText("app.thinking.cycle"), state.thinkingLevel, thinkingColor));

		// Model
		chips.push(chip(keyText("app.model.cycleForward"), state.modelName));

		// Queued messages indicator
		if (state.queuedMessageCount > 0) {
			chips.push(chip(`${state.queuedMessageCount} queued`, `${keyText("app.message.dequeue")} edit`, "accent"));
		} else {
			// Tools toggle
			chips.push(chip(keyText("app.tools.expand"), state.toolsExpanded ? "tools:on" : "tools"));
		}

		// Cave mode
		if (state.caveModeEnabled) {
			chips.push(labelChip(`cave:${state.caveModeIntensity}`, "accent"));
		}

		// Cavekit commands when active
		if (state.cavekitActive) {
			chips.push(labelChip("/ck:progress", "dim"));
			chips.push(labelChip("/ck:check", "dim"));
			chips.push(labelChip("/ck:make", "dim"));
		} else {
			// Slash commands hint
			chips.push(labelChip("/ commands", "dim"));
		}

		return chips;
	}
}
