// T-088, T-089: `cave trace <session>` terminal viewer with filter-by-type.

import type { TraceEvent } from "./types.js";

export interface ViewerOptions {
	filter?: string; // type or prefix
}

export function filterEvents(events: TraceEvent[], filter?: string): TraceEvent[] {
	if (!filter) return [...events].sort((a, b) => a.ts - b.ts || a.seq - b.seq);
	return events
		.filter((e) => e.type === filter || e.type.startsWith(filter))
		.sort((a, b) => a.ts - b.ts || a.seq - b.seq);
}

function fmtLlmRow(e: TraceEvent): string {
	const p = e.payload as {
		model?: string;
		inputTokens?: number;
		cachedInputTokens?: number;
		outputTokens?: number;
		dollars?: number;
	} | undefined;
	return `llm  ${p?.model ?? "?"} in=${p?.inputTokens ?? 0} cached=${p?.cachedInputTokens ?? 0} out=${p?.outputTokens ?? 0} $${(p?.dollars ?? 0).toFixed(4)}`;
}

function fmtToolRow(e: TraceEvent): string {
	const p = e.payload as { tool?: string; cacheState?: "hit" | "miss" } | undefined;
	return `tool ${p?.tool ?? "?"} cache=${p?.cacheState ?? "n/a"}`;
}

export function renderRow(event: TraceEvent): string {
	const prefix = `#${event.seq.toString().padStart(4, "0")} t${event.turn}`;
	switch (event.type) {
		case "llm_call":
			return `${prefix} ${fmtLlmRow(event)}`;
		case "tool_call":
		case "tool_cache_hit":
		case "tool_cache_miss":
			return `${prefix} ${fmtToolRow(event)}`;
		default:
			return `${prefix} ${event.type} ${JSON.stringify(event.payload ?? {})}`;
	}
}

export function renderTrace(events: TraceEvent[], opts: ViewerOptions = {}): string {
	return filterEvents(events, opts.filter).map(renderRow).join("\n");
}
