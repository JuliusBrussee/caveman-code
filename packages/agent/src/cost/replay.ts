// T-090: `cave replay <rollout>` deterministic re-execution with --apply gate.
//
// Replays the LLM-call sequence captured in a trace JSONL. Without --apply
// (dryRun=true), no workdir mutation happens — we just report what would
// run. With --apply, tool calls are dispatched against the workdir.

import type { TraceEvent } from "./types.js";

export interface ReplayOptions {
	dryRun: boolean;
	/** Called for every LLM call encountered. */
	onLlmCall?: (event: TraceEvent) => void;
	/** Called for every tool call encountered. Invoked only if !dryRun. */
	onToolCall?: (event: TraceEvent) => void;
}

export interface ReplayResult {
	llmCalls: number;
	toolCallsPlanned: number;
	toolCallsExecuted: number;
	dryRun: boolean;
}

export function replay(events: TraceEvent[], opts: ReplayOptions): ReplayResult {
	const ordered = [...events].sort((a, b) => a.seq - b.seq);
	let llmCalls = 0;
	let toolCallsPlanned = 0;
	let toolCallsExecuted = 0;
	for (const event of ordered) {
		if (event.type === "llm_call") {
			llmCalls++;
			opts.onLlmCall?.(event);
			continue;
		}
		if (event.type === "tool_call") {
			toolCallsPlanned++;
			if (!opts.dryRun) {
				opts.onToolCall?.(event);
				toolCallsExecuted++;
			}
		}
	}
	return {
		llmCalls,
		toolCallsPlanned,
		toolCallsExecuted,
		dryRun: opts.dryRun,
	};
}
