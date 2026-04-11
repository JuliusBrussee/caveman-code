/**
 * Stone Tablet — Structured output compression for cave mode.
 *
 * Detects JSON/XML in bash tool output and applies semantic compression
 * before line-count truncation. Extracts relevant keys based on the
 * originating command, compresses arrays, and strips namespace boilerplate.
 *
 * Runs AFTER per-tool budget truncation (Flint Chipper),
 * BEFORE general cave compression (compressCaveToolContentBlocks).
 */

// ============================================================================
// Format Detection
// ============================================================================

type OutputFormat = "json" | "xml" | "text";

/**
 * Detect whether text is JSON, XML, or plain text.
 * Only triggers on outputs > 50 lines to avoid compressing small results.
 */
export function detectOutputFormat(text: string): OutputFormat {
	const lines = text.split("\n");
	if (lines.length <= 50) return "text";

	const trimmed = text.trimStart();

	// JSON: starts with { or [
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		try {
			JSON.parse(trimmed);
			return "json";
		} catch {
			// Could be truncated JSON — check if first line parses or looks like JSON
			if (/^\s*[[{]/.test(trimmed) && /[}\]]\s*$/.test(text.trimEnd())) {
				return "json";
			}
		}
	}

	// XML: starts with < and isn't HTML
	if (trimmed.startsWith("<?xml") || (trimmed.startsWith("<") && !trimmed.startsWith("<!DOCTYPE html"))) {
		if (trimmed.includes("</") || trimmed.includes("/>")) {
			return "xml";
		}
	}

	return "text";
}

// ============================================================================
// Command Hint Extraction
// ============================================================================

/** Keywords commonly associated with specific JSON keys in CLI output. */
const COMMAND_KEY_HINTS: Record<string, string[]> = {
	"docker inspect": ["State", "Config", "NetworkSettings", "Mounts", "HostConfig"],
	"docker ps": ["Names", "Status", "Ports", "Image"],
	"npm ls": ["name", "version", "dependencies"],
	"package.json": ["name", "version", "scripts", "dependencies", "devDependencies"],
	tsconfig: ["compilerOptions", "include", "exclude"],
	kubectl: ["metadata", "spec", "status"],
	"aws ": ["Arn", "Name", "Status", "State", "Id"],
};

/**
 * Extract likely relevant key names from the command that produced the output.
 */
function extractKeyHints(commandHint?: string): Set<string> {
	const hints = new Set<string>();
	if (!commandHint) return hints;

	const lower = commandHint.toLowerCase();
	for (const [pattern, keys] of Object.entries(COMMAND_KEY_HINTS)) {
		if (lower.includes(pattern.toLowerCase())) {
			for (const key of keys) hints.add(key);
		}
	}

	return hints;
}

// ============================================================================
// JSON Compression
// ============================================================================

/** Maximum depth to traverse when compressing JSON. */
const MAX_DEPTH = 4;

/** Maximum array elements to keep before stubbing. */
const MAX_ARRAY_ELEMENTS = 3;

/**
 * Compress a parsed JSON value, keeping relevant keys and stubbing deep/large structures.
 */
function compressValue(value: unknown, relevantKeys: Set<string>, depth: number): unknown {
	if (depth > MAX_DEPTH) {
		if (Array.isArray(value)) return `[Array(${value.length})]`;
		if (typeof value === "object" && value !== null) return `{Object(${Object.keys(value).length} keys)}`;
		return value;
	}

	if (Array.isArray(value)) {
		if (value.length <= MAX_ARRAY_ELEMENTS) {
			return value.map((item) => compressValue(item, relevantKeys, depth + 1));
		}
		const kept = value.slice(0, MAX_ARRAY_ELEMENTS).map((item) => compressValue(item, relevantKeys, depth + 1));
		return [...kept, `... ${value.length - MAX_ARRAY_ELEMENTS} more items (${value.length} total)`];
	}

	if (typeof value === "object" && value !== null) {
		const obj = value as Record<string, unknown>;
		const keys = Object.keys(obj);

		// If we have relevant key hints, prioritize those
		if (relevantKeys.size > 0 && depth <= 1) {
			const result: Record<string, unknown> = {};
			let kept = 0;
			const omitted: string[] = [];

			for (const key of keys) {
				if (relevantKeys.has(key)) {
					result[key] = compressValue(obj[key], relevantKeys, depth + 1);
					kept++;
				} else {
					omitted.push(key);
				}
			}

			// Always keep some keys even without hints
			if (kept === 0) {
				// No hints matched — keep first 5 keys
				for (const key of keys.slice(0, 5)) {
					result[key] = compressValue(obj[key], relevantKeys, depth + 1);
				}
				if (keys.length > 5) {
					result["..."] = `${keys.length - 5} more keys omitted`;
				}
			} else if (omitted.length > 0) {
				result["..."] =
					`${omitted.length} keys omitted: ${omitted.slice(0, 5).join(", ")}${omitted.length > 5 ? "..." : ""}`;
			}

			return result;
		}

		// No hints or deeper level — keep first 8 keys
		const maxKeys = 8;
		if (keys.length <= maxKeys) {
			const result: Record<string, unknown> = {};
			for (const key of keys) {
				result[key] = compressValue(obj[key], relevantKeys, depth + 1);
			}
			return result;
		}

		const result: Record<string, unknown> = {};
		for (const key of keys.slice(0, maxKeys)) {
			result[key] = compressValue(obj[key], relevantKeys, depth + 1);
		}
		result["..."] = `${keys.length - maxKeys} more keys omitted`;
		return result;
	}

	// Truncate long string values
	if (typeof value === "string" && value.length > 200) {
		return `${value.slice(0, 200)}... (${value.length} chars)`;
	}

	return value;
}

/**
 * Compress JSON text using semantic extraction.
 * Keeps relevant keys based on command context, stubs arrays and deep structures.
 */
export function compressJson(text: string, commandHint?: string): string {
	const trimmed = text.trim();
	let parsed: unknown;

	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return text; // Not valid JSON — pass through
	}

	const relevantKeys = extractKeyHints(commandHint);
	const compressed = compressValue(parsed, relevantKeys, 0);
	const result = JSON.stringify(compressed, null, 2);
	const originalLines = text.split("\n").length;
	const resultLines = result.split("\n").length;

	if (resultLines >= originalLines * 0.6) {
		// Compression didn't help much — return original
		return text;
	}

	const retainedInfo =
		relevantKeys.size > 0 ? `Keys retained: ${[...relevantKeys].join(", ")}` : "Top-level keys retained";

	return `${result}\n\n[JSON compressed: ${resultLines} of ${originalLines} lines. ${retainedInfo}]`;
}

// ============================================================================
// XML Compression
// ============================================================================

/**
 * Compress XML text by stripping namespace boilerplate and collapsing repetitive elements.
 */
export function compressXml(text: string): string {
	const lines = text.split("\n");
	const originalCount = lines.length;

	const result: string[] = [];
	let repetitionCount = 0;
	let lastTagName = "";
	let skipping = false;

	for (const line of lines) {
		// Strip xmlns namespace declarations
		const cleaned = line.replace(/\s+xmlns(?::\w+)?="[^"]*"/g, "");

		// Detect repetitive sibling elements
		const tagMatch = cleaned.match(/^\s*<(\w+)[\s>]/);
		if (tagMatch) {
			const tagName = tagMatch[1]!;
			if (tagName === lastTagName) {
				repetitionCount++;
				if (repetitionCount > 3) {
					if (!skipping) {
						result.push(`    ... (repeated <${tagName}> elements)`);
						skipping = true;
					}
					continue;
				}
			} else {
				if (skipping) {
					result.push(`    [${repetitionCount} total <${lastTagName}> elements]`);
					skipping = false;
				}
				lastTagName = tagName;
				repetitionCount = 1;
			}
		}

		result.push(cleaned);
	}

	if (skipping) {
		result.push(`    [${repetitionCount} total <${lastTagName}> elements]`);
	}

	const resultCount = result.length;
	if (resultCount >= originalCount * 0.6) {
		return text; // Not enough compression
	}

	return `${result.join("\n")}\n\n[XML compressed: ${resultCount} of ${originalCount} lines]`;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Apply structured output compression to text content.
 * Returns the original text if content is not structured or compression is minimal.
 *
 * @param text - The tool output text
 * @param toolName - The tool that produced the output (only "bash" triggers compression)
 * @param commandHint - The bash command that produced the output (for JSON key extraction)
 */
export function compressStructuredOutput(text: string, toolName: string, commandHint?: string): string {
	// Only compress bash output — other tools have domain-specific formats
	if (toolName !== "bash") return text;

	const format = detectOutputFormat(text);

	switch (format) {
		case "json":
			return compressJson(text, commandHint);
		case "xml":
			return compressXml(text);
		case "text":
			return text;
	}
}

/**
 * Apply structured compression to content blocks.
 * Runs between per-tool budgets (Flint Chipper) and general cave compression.
 */
export function applyStructuredCompressionToContentBlocks(
	content: Array<{ type: string; text?: string; [key: string]: unknown }>,
	toolName: string,
	commandHint?: string,
): Array<{ type: string; text?: string; [key: string]: unknown }> {
	if (toolName !== "bash") return content;

	let changed = false;
	const result = content.map((block) => {
		if (block.type !== "text" || typeof block.text !== "string") {
			return block;
		}
		const compressed = compressStructuredOutput(block.text, toolName, commandHint);
		if (compressed === block.text) {
			return block;
		}
		changed = true;
		return { ...block, text: compressed };
	});
	return changed ? result : content;
}
