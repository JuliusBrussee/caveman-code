import { type Component, Markdown, type MarkdownTheme } from "@cave/tui";
import { getMarkdownTheme, theme } from "../theme/theme.js";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

/**
 * Component that renders a user message with a left accent border.
 */
export class UserMessageComponent implements Component {
	private markdown: Markdown;

	constructor(text: string, markdownTheme: MarkdownTheme = getMarkdownTheme()) {
		this.markdown = new Markdown(text, 1, 0, markdownTheme);
	}

	invalidate(): void {
		this.markdown.invalidate();
	}

	render(width: number): string[] {
		const prefix = theme.fg("accent", "│") + " ";
		const contentLines = this.markdown.render(width - 2);
		const lines = contentLines.map((line) => prefix + line);

		if (lines.length > 0) {
			lines[0] = OSC133_ZONE_START + lines[0];
			lines[lines.length - 1] = lines[lines.length - 1] + OSC133_ZONE_END + OSC133_ZONE_FINAL;
		}
		return lines;
	}
}
