/**
 * Cave mode tool result compression.
 *
 * Post-processes tool output text before it enters the conversation context:
 * - Strips ANSI escape codes
 * - Collapses consecutive blank lines into a single blank line
 * - Truncates very long outputs with head+tail preservation
 *
 * Only active when cave mode tool compression is enabled (default: true).
 * Never alters exit codes or error status — only the content text is modified.
 */

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of lines before truncation kicks in. */
const MAX_LINES = 500;

/** Number of lines to keep from the head of truncated output. */
const HEAD_LINES = 200;

/** Number of lines to keep from the tail of truncated output. */
const TAIL_LINES = 100;

// ============================================================================
// ANSI stripping
// ============================================================================

// Matches ANSI/VT100 escape sequences: ESC [ ... m, ESC [ ... A/B/C/D, etc.
const ANSI_ESCAPE_RE =
	// eslint-disable-next-line no-control-regex
	/[\u001b\u009b](?:[@-Z\\-_]|\[[0-9;]*[ -/]*[@-~]|[@-_][0-9;]*[@-~]?|[@-_]|[0-9;]*m)/g;

/**
 * Strip ANSI escape codes from a string.
 */
export function stripAnsi(text: string): string {
	return text.replace(ANSI_ESCAPE_RE, "");
}

// ============================================================================
// Blank line collapsing
// ============================================================================

/**
 * Collapse 3+ consecutive blank lines into a single blank line.
 * Preserves intentional double-blank spacing (e.g., between paragraphs).
 */
export function collapseBlankLines(text: string): string {
	return text.replace(/(\r?\n){3,}/g, "\n\n");
}

// ============================================================================
// Truncation with head+tail preservation
// ============================================================================

/**
 * Truncate text to at most MAX_LINES lines, preserving HEAD_LINES from the
 * start and TAIL_LINES from the end with a truncation marker in between.
 */
export function truncateLongOutput(text: string): string {
	const lines = text.split("\n");
	if (lines.length <= MAX_LINES) {
		return text;
	}

	const omitted = lines.length - HEAD_LINES - TAIL_LINES;
	const head = lines.slice(0, HEAD_LINES);
	const tail = lines.slice(lines.length - TAIL_LINES);

	return [...head, "", `[... ${omitted} lines omitted (cave mode truncation) ...]`, "", ...tail].join("\n");
}

// ============================================================================
// Main compressor
// ============================================================================

/**
 * Apply all cave mode compression steps to a tool output text.
 *
 * Steps (in order):
 * 1. Strip ANSI escape codes
 * 2. Collapse consecutive blank lines
 * 3. Truncate long outputs with head+tail preservation
 */
export function compressCaveToolOutput(text: string): string {
	let out = stripAnsi(text);
	out = collapseBlankLines(out);
	out = truncateLongOutput(out);
	return out;
}

// ============================================================================
// Content block processor
// ============================================================================

/**
 * Process an array of tool result content blocks.
 * Only text blocks are compressed; image blocks pass through unchanged.
 * Returns the same array reference when no changes are made.
 */
export function compressCaveToolContentBlocks(
	content: Array<{ type: string; text?: string; [key: string]: unknown }>,
): Array<{ type: string; text?: string; [key: string]: unknown }> {
	let changed = false;
	const result = content.map((block) => {
		if (block.type !== "text" || typeof block.text !== "string") {
			return block;
		}
		const compressed = compressCaveToolOutput(block.text);
		if (compressed === block.text) {
			return block;
		}
		changed = true;
		return { ...block, text: compressed };
	});
	return changed ? result : content;
}
