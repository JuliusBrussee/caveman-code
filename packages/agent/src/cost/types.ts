// T-034, T-036: CostEntry + trace event shape.

export interface CostEntry {
	turnIndex: number;
	model: string;
	provider: string;
	inputTokens: number;
	cachedInputTokens: number;
	cacheWriteTokens: number;
	outputTokens: number;
	dollarsEstimated: number;
}

export type TraceEventType =
	| "llm_call"
	| "tool_call"
	| "tool_cache_hit"
	| "tool_cache_miss"
	| "cost_cap_turn"
	| "cost_cap_session"
	| "compression_fallback"
	| "subagent_start"
	| "subagent_end";

export interface TraceEvent {
	type: TraceEventType;
	/** Session-relative turn index. */
	turn: number;
	/** Monotonic sequence number. */
	seq: number;
	/** Wall-clock timestamp for display only. Cache keys must not depend on it. */
	ts: number;
	/** Arbitrary event payload. */
	payload: unknown;
}
