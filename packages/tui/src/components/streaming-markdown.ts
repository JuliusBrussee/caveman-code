import type { Component } from "../tui.js";
import { type DefaultTextStyle, Markdown, type MarkdownTheme } from "./markdown.js";

/**
 * Markdown renderer for chunked, in-flight assistant text.
 *
 * Wraps Markdown so partial content renders cleanly even while half-formed
 * tokens (open fences, unfinished bold, dangling link brackets) are still
 * arriving. Once the stream finalizes, swap in the canonical render via
 * `finalize()`.
 */
export class StreamingMarkdown implements Component {
	private inner: Markdown;
	private rawBuffer = "";
	private finalized = false;

	constructor(
		initial: string,
		private readonly paddingX: number,
		private readonly paddingY: number,
		private readonly theme: MarkdownTheme,
		private readonly defaultTextStyle?: DefaultTextStyle,
	) {
		this.inner = new Markdown(balancePartial(initial), paddingX, paddingY, theme, defaultTextStyle);
		this.rawBuffer = initial;
	}

	/** Append a streamed chunk and update the render. */
	append(chunk: string): void {
		if (this.finalized) {
			this.rawBuffer += chunk;
			this.inner.setText(this.rawBuffer);
			return;
		}
		this.rawBuffer += chunk;
		this.inner.setText(balancePartial(this.rawBuffer));
	}

	/** Replace the entire buffer (e.g. when retrying). */
	setText(text: string): void {
		this.rawBuffer = text;
		if (this.finalized) {
			this.inner.setText(text);
		} else {
			this.inner.setText(balancePartial(text));
		}
	}

	/**
	 * Mark the stream complete and swap to the canonical full markdown render.
	 * Subsequent appends (rare) keep the canonical render path.
	 */
	finalize(canonical?: string): void {
		this.finalized = true;
		if (canonical !== undefined) {
			this.rawBuffer = canonical;
		}
		this.inner.setText(this.rawBuffer);
	}

	getRawText(): string {
		return this.rawBuffer;
	}

	invalidate(): void {
		this.inner.invalidate();
	}

	render(width: number): string[] {
		return this.inner.render(width);
	}
}

/**
 * Balance partial markdown so the in-flight render doesn't trip over
 * unfinished syntax. Conservative: no semantic re-parsing, just close the
 * obvious cases (fences, runs of ** / * / ~~, dangling [ ).
 */
export function balancePartial(text: string): string {
	let working = text;

	// Trim a trailing dangling link prefix like "see [the docs" or "see [docs](".
	// We only strip the unbalanced opening so the partial render shows the
	// preceding prose without an angry render of brackets.
	const lastOpenBracket = working.lastIndexOf("[");
	if (lastOpenBracket !== -1) {
		const tail = working.slice(lastOpenBracket);
		const closingBracket = tail.indexOf("]");
		const openParen = closingBracket !== -1 ? tail.indexOf("(", closingBracket) : -1;
		const closingParen = openParen !== -1 ? tail.indexOf(")", openParen) : -1;
		if (closingBracket === -1 || (openParen !== -1 && closingParen === -1)) {
			working = working.slice(0, lastOpenBracket);
		}
	}

	// Close an open fenced code block. We count fence lines (``` at line start,
	// possibly with lang). Odd count → still inside a fence → append a closing
	// fence so the render terminates cleanly.
	const fenceLines = working.split("\n").filter((line) => /^\s{0,3}```/.test(line));
	if (fenceLines.length % 2 === 1) {
		// If the last fence opener is mid-line (no trailing newline), add one.
		if (!working.endsWith("\n")) working += "\n";
		working += "```\n";
	}

	// Strip trailing odd-count strong markers ** that haven't been closed.
	if (countOutsideCode(working, "**") % 2 === 1) {
		working = stripTrailingMarker(working, "**");
	}
	// Same for ~~ (strikethrough).
	if (countOutsideCode(working, "~~") % 2 === 1) {
		working = stripTrailingMarker(working, "~~");
	}
	// Single * is ambiguous (lists, italics); leave it alone.

	return working;
}

function countOutsideCode(text: string, marker: string): number {
	// Naive: count occurrences of `marker` outside backtick spans. Good enough
	// for the partial-balance use case — false positives only mean we leave a
	// run open, which the renderer already tolerates.
	let count = 0;
	let inCode = false;
	let i = 0;
	while (i < text.length) {
		const ch = text[i];
		if (ch === "`") {
			inCode = !inCode;
			i += 1;
			continue;
		}
		if (!inCode && text.startsWith(marker, i)) {
			count += 1;
			i += marker.length;
			continue;
		}
		i += 1;
	}
	return count;
}

function stripTrailingMarker(text: string, marker: string): string {
	const idx = text.lastIndexOf(marker);
	if (idx === -1) return text;
	return text.slice(0, idx);
}
