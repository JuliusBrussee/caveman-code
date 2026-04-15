// T-101, T-102, T-103: edit tools surface — edit, apply_sr_diff, edit_symbol.
//
// Registry exposes stable metadata for all three. Hunk payload shape is
// uniform so the review UI (T-118) can consume without per-tool logic.

import { createHash } from "node:crypto";

export interface Hunk {
	before: string;
	after: string;
	lineRange: [number, number];
}

export interface DiffPayload {
	file: string;
	hunks: Hunk[];
}

export interface EditToolDescriptor {
	name: "edit" | "apply_sr_diff" | "edit_symbol";
	description: string;
	intendedUse: string;
	schema: unknown;
}

export const EDIT_TOOLS: readonly EditToolDescriptor[] = [
	{
		name: "edit",
		description: "Simple search/replace with single unambiguous match (like existing edit).",
		intendedUse: "Small, obvious edits where the search string is unique.",
		schema: {
			type: "object",
			properties: {
				file: { type: "string" },
				old_string: { type: "string" },
				new_string: { type: "string" },
			},
			required: ["file", "old_string", "new_string"],
		},
	},
	{
		name: "apply_sr_diff",
		description: "Exact-match search/replace producing structured no_match/ambiguous diagnostics.",
		intendedUse: "Batched edits where matches might be ambiguous and need structured feedback.",
		schema: {
			type: "object",
			properties: {
				file: { type: "string" },
				search: { type: "string" },
				replace: { type: "string" },
			},
			required: ["file", "search", "replace"],
		},
	},
	{
		name: "edit_symbol",
		description: "Replace a symbol's body by qualified name, preserving signature.",
		intendedUse: "Surgical function/class body replacement without risking signature drift.",
		schema: {
			type: "object",
			properties: {
				file: { type: "string" },
				qualified_name: { type: "string" },
				new_body: { type: "string" },
			},
			required: ["file", "qualified_name", "new_body"],
		},
	},
] as const;

/** T-103: byte-stable schema snapshot. */
export function editToolsSchemaHash(): string {
	const serialized = JSON.stringify(
		EDIT_TOOLS.map((t) => ({
			description: t.description,
			intended_use: t.intendedUse,
			name: t.name,
			schema: sortKeysDeep(t.schema),
		})),
	);
	return createHash("sha256").update(serialized).digest("hex");
}

function sortKeysDeep(value: unknown): unknown {
	if (value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map(sortKeysDeep);
	const obj = value as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const k of Object.keys(obj).sort()) out[k] = sortKeysDeep(obj[k]);
	return out;
}

/** Build a uniform diff payload from an edit result. */
export function toDiffPayload(
	file: string,
	beforeSource: string,
	afterSource: string,
	lineRange: [number, number],
): DiffPayload {
	return {
		file,
		hunks: [{ before: beforeSource, after: afterSource, lineRange }],
	};
}
