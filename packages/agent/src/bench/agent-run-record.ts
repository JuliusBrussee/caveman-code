// Normalized per-(agent, task) run record for cross-agent benchmarks like
// Terminal-Bench. Used by run-terminal-bench.ts and aggregated into
// BaselineData via tbResultsToBaseline().

import type { BaselineData } from "./compare.js";

export type TokensVerifiedBy = "cli-event" | "usage-api" | "tokenizer-recount" | "both" | "none";

export interface AgentRunTokens {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
}

export interface AgentRunRecord {
	agent: string;
	taskId: string;
	resolved: boolean;
	tokens: AgentRunTokens;
	tokensVerifiedBy: TokensVerifiedBy;
	/** |cli - cross-check| / cli, percent. Undefined when no cross-check ran. */
	tokensVerificationDeltaPct?: number;
	/** True when the headline number on this row sits outside the quality band. */
	qualityGated: boolean;
	/** Optional dollar cost (only meaningful in API-key mode). */
	dollars?: number;
	/** Wall-clock time in ms. */
	wallTimeMs: number;
	/** Conversation turns / agent steps. */
	turns: number;
	/** Hit a cost or wall-time cap. */
	costCapFailure?: boolean;
	/** Free-form notes (e.g. parse errors, fallback paths). */
	notes?: string;
}

export interface TbResultsToBaselineOptions {
	/** Override report date (default: today). */
	date?: string;
	/** Override source string. */
	source?: string;
	/** Iso-quality intersection size for the footer. */
	isoQualityResolvedCount?: number;
	/** Sum of total tokens across iso-quality intersection for this agent. */
	isoQualityTokensTotal?: number;
}

/**
 * Aggregate AgentRunRecord[] for a single agent into BaselineData. The output
 * drops straight into the existing comparison table machinery in compare.ts.
 */
export function tbResultsToBaseline(
	records: AgentRunRecord[],
	agent: string,
	opts: TbResultsToBaselineOptions = {},
): BaselineData {
	const own = records.filter((r) => r.agent === agent);

	let inputTokensTotal = 0;
	let outputTokensTotal = 0;
	let cacheReadTokensTotal = 0;
	let cacheWriteTokensTotal = 0;
	let dollarsTotal = 0;
	let meanTurnsAcc = 0;
	let meanWallAcc = 0;
	let resolvedCount = 0;
	let deltaAcc = 0;
	let deltaCount = 0;

	for (const r of own) {
		inputTokensTotal += r.tokens.input;
		outputTokensTotal += r.tokens.output;
		cacheReadTokensTotal += r.tokens.cacheRead;
		cacheWriteTokensTotal += r.tokens.cacheWrite;
		dollarsTotal += r.dollars ?? 0;
		meanTurnsAcc += r.turns;
		meanWallAcc += r.wallTimeMs;
		if (r.resolved) resolvedCount++;
		if (r.tokensVerificationDeltaPct !== undefined) {
			deltaAcc += r.tokensVerificationDeltaPct;
			deltaCount++;
		}
	}

	const totalInstances = own.length;
	const date = opts.date ?? new Date().toISOString().slice(0, 10);

	return {
		system: agent,
		benchmark: "terminal-bench",
		date,
		source: opts.source ?? "measured",
		resolvedCount,
		totalInstances,
		inputTokensTotal,
		outputTokensTotal,
		cacheReadTokensTotal: cacheReadTokensTotal > 0 ? cacheReadTokensTotal : undefined,
		cacheWriteTokensTotal: cacheWriteTokensTotal > 0 ? cacheWriteTokensTotal : undefined,
		dollarsTotal,
		meanTurns: totalInstances > 0 ? meanTurnsAcc / totalInstances : 0,
		meanWallTimeMs: totalInstances > 0 ? meanWallAcc / totalInstances : 0,
		isoQualityResolvedCount: opts.isoQualityResolvedCount,
		isoQualityTokensTotal: opts.isoQualityTokensTotal,
		tokensVerificationDeltaPct: deltaCount > 0 ? deltaAcc / deltaCount : undefined,
	};
}
