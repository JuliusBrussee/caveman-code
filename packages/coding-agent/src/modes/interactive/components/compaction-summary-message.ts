import { type Component, Markdown, type MarkdownTheme, Text } from "@cave/tui";
import type { CompactionSummaryMessage } from "../../../core/messages.js";
import { getMarkdownTheme, theme } from "../theme/theme.js";
import { keyText } from "./keybinding-hints.js";

/**
 * Compact compaction summary — collapsed single line, expanded with left border.
 */
export class CompactionSummaryMessageComponent implements Component {
	private expanded = false;
	private message: CompactionSummaryMessage;
	private markdownTheme: MarkdownTheme;
	private currentContent?: Component;

	constructor(message: CompactionSummaryMessage, markdownTheme: MarkdownTheme = getMarkdownTheme()) {
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
		const tokenStr = this.message.tokensBefore.toLocaleString();

		if (this.expanded) {
			const header = `**Compacted from ${tokenStr} tokens**\n\n`;
			this.currentContent = new Markdown(header + this.message.summary, 1, 0, this.markdownTheme);
		} else {
			const line =
				theme.fg("customMessageLabel", "[compaction]") +
				theme.fg("dim", ` ${tokenStr} tokens`) +
				theme.fg("dim", ` (${keyText("app.tools.expand")} to expand)`);
			this.currentContent = new Text(line, 1, 0);
		}
	}
}
