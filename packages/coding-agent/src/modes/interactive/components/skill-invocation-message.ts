import { type Component, Markdown, type MarkdownTheme, Text } from "@cave/tui";
import type { ParsedSkillBlock } from "../../../core/agent-session.js";
import { getMarkdownTheme, theme } from "../theme/theme.js";
import { keyText } from "./keybinding-hints.js";

/**
 * Component that renders a skill invocation message with collapsed/expanded state.
 * Collapsed: compact single line. Expanded: left-bordered content block.
 */
export class SkillInvocationMessageComponent implements Component {
	private expanded = false;
	private skillBlock: ParsedSkillBlock;
	private markdownTheme: MarkdownTheme;
	private currentContent?: Component;

	constructor(skillBlock: ParsedSkillBlock, markdownTheme: MarkdownTheme = getMarkdownTheme()) {
		this.skillBlock = skillBlock;
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
			// Left-bordered expanded content
			const prefix = theme.fg("customMessageLabel", "│") + " ";
			return this.currentContent.render(width - 2).map((line) => prefix + line);
		}
		return this.currentContent.render(width);
	}

	private updateDisplay(): void {
		if (this.expanded) {
			// Label + skill name header + full content
			const header = `**${this.skillBlock.name}**\n\n`;
			this.currentContent = new Markdown(header + this.skillBlock.content, 1, 0, this.markdownTheme);
		} else {
			// Compact single line
			const line =
				theme.fg("customMessageLabel", "[skill]") +
				theme.fg("dim", ` ${this.skillBlock.name}`) +
				theme.fg("dim", ` (${keyText("app.tools.expand")} to expand)`);
			this.currentContent = new Text(line, 1, 0);
		}
	}
}
