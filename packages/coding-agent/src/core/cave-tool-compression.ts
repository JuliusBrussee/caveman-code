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
// Per-Tool Output Budgets (Flint Chipper)
// ============================================================================

interface ToolBudget {
	maxLines: number;
	headLines: number;
	tailLines: number;
}

const DEFAULT_TOOL_BUDGETS: Record<string, ToolBudget> = {
	bash: { maxLines: 80, headLines: 50, tailLines: 30 },
	read: { maxLines: 300, headLines: 200, tailLines: 100 },
	grep: { maxLines: 120, headLines: 80, tailLines: 40 },
	find: { maxLines: 60, headLines: 40, tailLines: 20 },
	ls: { maxLines: 60, headLines: 40, tailLines: 20 },
};

const FALLBACK_BUDGET: ToolBudget = { maxLines: 150, headLines: 100, tailLines: 50 };

/**
 * Get the output budget for a specific tool.
 * Custom budgets can override defaults.
 */
export function getToolBudget(toolName: string, customBudgets?: Record<string, ToolBudget>): ToolBudget {
	return customBudgets?.[toolName] ?? DEFAULT_TOOL_BUDGETS[toolName] ?? FALLBACK_BUDGET;
}

/**
 * Truncate text using per-tool budget (head+tail preservation).
 * Runs BEFORE the general cave compression pipeline.
 */
export function truncateWithToolBudget(
	text: string,
	toolName: string,
	customBudgets?: Record<string, ToolBudget>,
): string {
	const budget = getToolBudget(toolName, customBudgets);
	const lines = text.split("\n");
	if (lines.length <= budget.maxLines) {
		return text;
	}
	const omitted = lines.length - budget.headLines - budget.tailLines;
	const head = lines.slice(0, budget.headLines);
	const tail = lines.slice(lines.length - budget.tailLines);
	return [
		...head,
		"",
		`[... ${omitted} lines omitted (${toolName} budget: ${budget.maxLines}) ...]`,
		"",
		...tail,
	].join("\n");
}

/**
 * Apply per-tool budget truncation to content blocks.
 * Runs before compressCaveToolContentBlocks for compound compression.
 */
export function applyToolBudgetToContentBlocks(
	content: Array<{ type: string; text?: string; [key: string]: unknown }>,
	toolName: string,
	customBudgets?: Record<string, ToolBudget>,
): Array<{ type: string; text?: string; [key: string]: unknown }> {
	let changed = false;
	const result = content.map((block) => {
		if (block.type !== "text" || typeof block.text !== "string") {
			return block;
		}
		const truncated = truncateWithToolBudget(block.text, toolName, customBudgets);
		if (truncated === block.text) {
			return block;
		}
		changed = true;
		return { ...block, text: truncated };
	});
	return changed ? result : content;
}

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

// ============================================================================
// Read Deduplication (Cave Painting Diff)
// ============================================================================

interface ReadCacheEntry {
	/** Lightweight fingerprint: length + first 256 chars */
	fingerprint: string;
	/** Sequential read index when this file was first read */
	readIndex: number;
}

/**
 * Computes a lightweight fingerprint from text content.
 * Uses content length + first 256 chars — fast and sufficient for dedup.
 */
function fingerprintContent(text: string): string {
	return `${text.length}:${text.slice(0, 256)}`;
}

/**
 * Session-scoped cache for read result deduplication.
 * When the LLM re-reads an unchanged file, replaces full content with a one-line stub,
 * saving significant context tokens on repeated reads.
 *
 * Invalidated on write/edit to the same path.
 */
export class ReadDeduplicationCache {
	private cache = new Map<string, ReadCacheEntry>();
	private readCount = 0;

	/** Reset cache (call on session start or new branch). */
	reset(): void {
		this.cache.clear();
		this.readCount = 0;
	}

	/**
	 * Check a read result against the cache.
	 * Returns a stub string if content is unchanged, or undefined if new/changed.
	 * Side effect: updates the cache with the current content on first/changed read.
	 */
	checkRead(filePath: string, content: string): string | undefined {
		const fingerprint = fingerprintContent(content);
		const existing = this.cache.get(filePath);

		if (existing && existing.fingerprint === fingerprint) {
			return `[File unchanged since read #${existing.readIndex}. Content identical to prior read. Reference that context.]`;
		}

		// New or changed — update cache
		this.readCount++;
		this.cache.set(filePath, { fingerprint, readIndex: this.readCount });
		return undefined;
	}

	/**
	 * Invalidate cache entry when a file is written or edited.
	 */
	invalidate(filePath: string): void {
		this.cache.delete(filePath);
	}
}
