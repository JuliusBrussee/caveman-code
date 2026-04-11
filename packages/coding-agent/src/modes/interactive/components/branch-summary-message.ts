import { type Component, Markdown, type MarkdownTheme, Text } from "@cave/tui";
import type { BranchSummaryMessage } from "../../../core/messages.js";
import { getMarkdownTheme, theme } from "../theme/theme.js";
import { keyText } from "./keybinding-hints.js";

/**
 * Compact branch summary — collapsed single line, expanded with left border.
 */
export class BranchSummaryMessageComponent implements Component {
	private expanded = false;
	private message: BranchSummaryMessage;
	private markdownTheme: MarkdownTheme;
	private currentContent?: Component;

	constructor(message: BranchSummaryMessage, markdownTheme: MarkdownTheme = getMarkdownTheme()) {
		this.message = message;
		this.markdownTheme = markdownTheme;
		this.updateDisplay();
	}

	setExpanded(expanded: boolean): void {
		this.expanded = expanded;
		this.updateDisplay();
	}

	invalidate(): void {
		this.currentContent?.invalidate?.();
		this.updateDisplay();
	}

	render(width: number): string[] {
		if (!this.currentContent) return [];

		if (this.expanded) {
			const prefix = theme.fg("customMessageLabel", "│") + " ";
			return this.currentContent.render(width - 2).map((line) => prefix + line);
		}
		return this.currentContent.render(width);
	}

	private updateDisplay(): void {
		if (this.expanded) {
			const header = "**Branch Summary**\n\n";
			this.currentContent = new Markdown(header + this.message.summary, 1, 0, this.markdownTheme);
		} else {
			const line =
				theme.fg("customMessageLabel", "[branch]") +
				theme.fg("dim", " Branch summary") +
				theme.fg("dim", ` (${keyText("app.tools.expand")} to expand)`);
			this.currentContent = new Text(line, 1, 0);
		}
	}
}
