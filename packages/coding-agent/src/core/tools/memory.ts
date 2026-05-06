/**
 * memory_search / memory_save — native cave tools wrapping the active
 * `MemoryProvider` (cavemem when available, FilesProvider fallback).
 *
 * Auto-injection of recent recall happens in `agent-session._buildMemoryTransform`
 * each turn. These tools let the LLM expand a hit, query a different topic, or
 * write a fact mid-turn without taking the user-driven `/memory` slash route.
 */

import type { AgentTool, memory as memoryNs } from "@cave/agent";
import { Text } from "@cave/tui";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

type MemoryProvider = memoryNs.MemoryProvider;

const memorySearchSchema = Type.Object({
	query: Type.String({ description: "Free-text search query (BM25 + embedding hybrid when cavemem is available)." }),
	limit: Type.Optional(Type.Number({ description: "Max hits to return (default 5, hard cap 20)." })),
});

const memorySaveSchema = Type.Object({
	content: Type.String({ description: "Fact body to persist. One observation per call." }),
	kind: Type.Optional(
		Type.String({
			description:
				"Observation kind. Defaults to 'fact'. Use 'lesson' for behavioural rules, 'episodic' for raw events.",
		}),
	),
});

export type MemorySearchInput = Static<typeof memorySearchSchema>;
export type MemorySaveInput = Static<typeof memorySaveSchema>;

export interface MemorySearchDetails {
	hitCount: number;
	available: boolean;
}

export interface MemorySaveDetails {
	id?: number;
	available: boolean;
}

const HARD_LIMIT = 20;

function previewLine(hit: memoryNs.MemoryHit): string {
	const head = `#${hit.id}`;
	const score = typeof hit.score === "number" ? ` (score=${hit.score.toFixed(2)})` : "";
	const kind = hit.kind ? ` [${hit.kind}]` : "";
	const ts = hit.ts ? ` ${hit.ts}` : "";
	const preview = (hit.preview ?? "").replace(/\s+/g, " ").trim();
	return `${head}${kind}${score}${ts} — ${preview}`.slice(0, 240);
}

export function createMemorySearchToolDefinition(
	provider: MemoryProvider,
): ToolDefinition<typeof memorySearchSchema, MemorySearchDetails> {
	return {
		name: "memory_search",
		label: "memory_search",
		description:
			"Search persistent memory (prior cave sessions + saved facts). Prefer this over re-running `grep`/`read` for topics you may have explored before. The auto-injected `<memory-recall>` block already shows top hits each turn — use this tool to expand a hit, query a different topic, or paginate.",
		promptSnippet: "Search persistent memory (prior sessions + saved facts)",
		promptGuidelines: [
			"Before grepping or reading files for context the user may have already discussed in a prior session, run `memory_search` with the topic — it is far cheaper than tool I/O.",
			"The `<memory-recall>` block above is auto-generated from the current chat-state. To explore an unrelated topic, call `memory_search` explicitly.",
		],
		parameters: memorySearchSchema,
		async execute(_id, { query, limit }) {
			const available = await provider.isAvailable().catch(() => false);
			if (!available) {
				return {
					content: [
						{
							type: "text" as const,
							text: "Memory backend unavailable; install `cavemem` or initialise `.cave/memory/`.",
						},
					],
					details: { hitCount: 0, available: false },
				};
			}
			const k = Math.max(1, Math.min(HARD_LIMIT, limit ?? 5));
			const hits = await provider.search(query, { limit: k }).catch((e) => {
				return [
					{ id: -1, preview: `search error: ${e instanceof Error ? e.message : String(e)}` },
				] as memoryNs.MemoryHit[];
			});
			if (hits.length === 0) {
				return {
					content: [{ type: "text" as const, text: `No memory hits for: ${query}` }],
					details: { hitCount: 0, available: true },
				};
			}
			const lines = hits.map(previewLine);
			return {
				content: [{ type: "text" as const, text: `Top ${hits.length} hit(s):\n${lines.join("\n")}` }],
				details: { hitCount: hits.length, available: true },
			};
		},
		renderCall(args, theme) {
			const head = theme.fg("toolTitle", theme.bold("memory_search"));
			const q = (args.query ?? "").slice(0, 80);
			return new Text(`${head} ${theme.fg("accent", `"${q}"`)}`, 0, 0);
		},
		renderResult(result, _options, theme) {
			const details = result.details as MemorySearchDetails | undefined;
			if (!details?.available) return new Text(theme.fg("warning", "(memory unavailable)"), 0, 0);
			return new Text(theme.fg("toolOutput", `${details.hitCount} hit(s)`), 0, 0);
		},
	};
}

export function createMemorySaveToolDefinition(
	provider: MemoryProvider,
): ToolDefinition<typeof memorySaveSchema, MemorySaveDetails> {
	return {
		name: "memory_save",
		label: "memory_save",
		description:
			"Persist a fact to memory (kind defaults to 'fact'). Use sparingly — only for facts the user is likely to want recalled in future sessions. Don't echo conversation; cavemem hooks already capture episodic events.",
		promptSnippet: "Save a fact to persistent memory",
		parameters: memorySaveSchema,
		async execute(_id, { content, kind }) {
			const available = await provider.isAvailable().catch(() => false);
			if (!available) {
				return {
					content: [
						{
							type: "text" as const,
							text: "Memory backend unavailable; install `cavemem` or initialise `.cave/memory/`.",
						},
					],
					details: { available: false },
				};
			}
			const id = await provider.save(content, kind ?? "fact").catch((e) => {
				throw new Error(`memory_save failed: ${e instanceof Error ? e.message : String(e)}`);
			});
			return {
				content: [
					{ type: "text" as const, text: id !== undefined ? `Saved as #${id}` : "Saved (id not surfaced)" },
				],
				details: { id, available: true },
			};
		},
		renderCall(args, theme) {
			const head = theme.fg("toolTitle", theme.bold("memory_save"));
			const preview = (args.content ?? "").replace(/\s+/g, " ").slice(0, 80);
			return new Text(`${head} ${theme.fg("dim", preview)}`, 0, 0);
		},
		renderResult(result, _options, theme) {
			const details = result.details as MemorySaveDetails | undefined;
			if (!details?.available) return new Text(theme.fg("warning", "(memory unavailable)"), 0, 0);
			return new Text(theme.fg("success", details.id !== undefined ? `→ #${details.id}` : "→ saved"), 0, 0);
		},
	};
}

export interface MemoryTools {
	search: AgentTool<typeof memorySearchSchema>;
	save: AgentTool<typeof memorySaveSchema>;
	searchDef: ToolDefinition<typeof memorySearchSchema, MemorySearchDetails>;
	saveDef: ToolDefinition<typeof memorySaveSchema, MemorySaveDetails>;
}

/** Build the pair of tools bound to a single provider instance. */
export function createMemoryTools(provider: MemoryProvider): MemoryTools {
	const searchDef = createMemorySearchToolDefinition(provider);
	const saveDef = createMemorySaveToolDefinition(provider);
	return {
		searchDef,
		saveDef,
		search: wrapToolDefinition(searchDef),
		save: wrapToolDefinition(saveDef),
	};
}
