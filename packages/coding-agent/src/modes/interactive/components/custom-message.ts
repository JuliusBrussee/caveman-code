import type { TextContent } from "@cave/ai";
import { type Component, Container, Markdown, type MarkdownTheme, Text } from "@cave/tui";
import type { MessageRenderer } from "../../../core/extensions/types.js";
import type { CustomMessage } from "../../../core/messages.js";
import { getMarkdownTheme, theme } from "../theme/theme.js";

/**
 * Component that renders a custom message entry from extensions.
 * Uses left-border style consistent with other message types.
 */
export class CustomMessageComponent implements Component {
	private message: CustomMessage<unknown>;
	private customRenderer?: MessageRenderer;
	private markdownTheme: MarkdownTheme;
	private _expanded = false;
	private currentContent?: Component;

	constructor(
		message: CustomMessage<unknown>,
		customRenderer?: MessageRenderer,
		markdownTheme: MarkdownTheme = getMarkdownTheme(),
	) {
		this.message = message;
		this.customRenderer = customRenderer;
		this.markdownTheme = markdownTheme;
		this.rebuild();
	}

	setExpanded(expanded: boolean): void {
		if (this._expanded !== expanded) {
			this._expanded = expanded;
			this.rebuild();
		}
	}

	invalidate(): void {
		this.currentContent?.invalidate?.();
		this.rebuild();
	}

	render(width: number): string[] {
		if (!this.currentContent) return [];

		// Custom renderers handle their own styling
		if (this.customRenderer) {
			return this.currentContent.render(width);
		}

		// Default rendering: left-bordered
		const prefix = theme.fg("customMessageLabel", "│") + " ";
		return this.currentContent.render(width - 2).map((line) => prefix + line);
	}

	private rebuild(): void {
		// Try custom renderer first
		if (this.customRenderer) {
			try {
				const component = this.customRenderer(this.message, { expanded: this._expanded }, theme);
				if (component) {
					this.currentContent = component;
					return;
				}
			} catch {
				// Fall through to default rendering
			}
		}

		// Default rendering: label + content
		const container = new Container();
		const label = theme.fg("customMessageLabel", `[${this.message.customType}]`);
		container.addChild(new Text(label, 0, 0));

		let text: string;
		if (typeof this.message.content === "string") {
			text = this.message.content;
		} else {
			text = this.message.content
				.filter((c): c is TextContent => c.type === "text")
				.map((c) => c.text)
				.join("\n");
		}

		container.addChild(new Markdown(text, 0, 0, this.markdownTheme));
		this.currentContent = container;
	}
}
