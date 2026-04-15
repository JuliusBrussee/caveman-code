// T-004: Deterministic alphabetically-sorted tool schema serializer.
// T-006: Per-tool description edits isolate to tools-layer hash; strip paths/timestamps.
import { createHash } from "node:crypto";

export interface ToolSchema {
	name: string;
	description?: string;
	parameters?: unknown;
}

const ISO_TIMESTAMP_RE =
	/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g;
const ABSOLUTE_PATH_RE = /(?:\/(?:Users|home|tmp|var|opt)\/[^\s"'`]+)/g;

function scrub(text: string): string {
	return text.replace(ISO_TIMESTAMP_RE, "<ts>").replace(ABSOLUTE_PATH_RE, "<path>");
}

function sortKeysDeep(value: unknown): unknown {
	if (value === null || typeof value !== "object") {
		return typeof value === "string" ? scrub(value) : value;
	}
	if (Array.isArray(value)) {
		return value.map(sortKeysDeep);
	}
	const obj = value as Record<string, unknown>;
	const sorted: Record<string, unknown> = {};
	for (const key of Object.keys(obj).sort()) {
		sorted[key] = sortKeysDeep(obj[key]);
	}
	return sorted;
}

export function serializeToolSchemas(tools: ToolSchema[]): string {
	const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name));
	const normalized = sorted.map((tool) => ({
		description: tool.description ? scrub(tool.description) : "",
		name: tool.name,
		parameters: sortKeysDeep(tool.parameters ?? {}),
	}));
	return JSON.stringify(normalized);
}

export function toolSchemaHash(tools: ToolSchema[]): string {
	return createHash("sha256").update(serializeToolSchemas(tools)).digest("hex");
}
