// Iso-quality slice for cross-agent benchmarks.
//
// Raw "average tokens per task" hides quality differences. The headline number
// for cave's tokens-per-resolved comparison is restricted to the intersection
// of tasks that *all* agents resolved. This file computes that subset.

import type { AgentRunRecord } from "./agent-run-record.js";

export interface IsoQualityPerAgent {
	agent: string;
	tokensTotal: number;
	resolvedCount: number;
	tokensPerResolved: number;
}

export interface IsoQualityResult {
	/** Task IDs every agent resolved. */
	resolvedTaskIds: string[];
	perAgent: IsoQualityPerAgent[];
	/** Pass rates indexed by agent. */
	passRates: Record<string, number>;
	/** Leader pass rate minus this agent's pass rate. */
	passRateGapToLeaderPp: Record<string, number>;
	/** True when the largest gap exceeds qualityBandPp. */
	qualityGated: boolean;
	qualityBandPp: number;
}

export interface IsoQualityOptions {
	/** Pass-rate band in percentage points (default: 5). */
	qualityBandPp?: number;
}

export function computeIsoQuality(records: AgentRunRecord[], opts: IsoQualityOptions = {}): IsoQualityResult {
	const qualityBandPp = opts.qualityBandPp ?? 5;
	const agents = [...new Set(records.map((r) => r.agent))].sort();

	const perAgentRecords: Record<string, AgentRunRecord[]> = {};
	for (const a of agents) {
		perAgentRecords[a] = records.filter((r) => r.agent === a);
	}

	// Resolved task ID sets per agent.
	const resolvedSets = agents.map((a) => new Set(perAgentRecords[a].filter((r) => r.resolved).map((r) => r.taskId)));

	// Intersection.
	const resolvedTaskIds =
		agents.length === 0 ? [] : [...resolvedSets[0]].filter((id) => resolvedSets.every((s) => s.has(id))).sort();

	// Per-agent iso-quality numbers restricted to intersection.
	const perAgent: IsoQualityPerAgent[] = agents.map((agent) => {
		const inSubset = perAgentRecords[agent].filter((r) => resolvedTaskIds.includes(r.taskId));
		let tokensTotal = 0;
		for (const r of inSubset) {
			tokensTotal += r.tokens.input + r.tokens.output + r.tokens.cacheRead + r.tokens.cacheWrite;
		}
		const resolvedCount = inSubset.length;
		return {
			agent,
			tokensTotal,
			resolvedCount,
			tokensPerResolved: resolvedCount > 0 ? tokensTotal / resolvedCount : 0,
		};
	});

	// Quality-gating: compare overall pass rates, not iso-quality counts (the
	// iso-quality subset tautologically has every agent at 100%).
	const passRates: Record<string, number> = {};
	for (const a of agents) {
		const total = perAgentRecords[a].length;
		const passed = perAgentRecords[a].filter((r) => r.resolved).length;
		passRates[a] = total > 0 ? passed / total : 0;
	}
	const leader = Math.max(0, ...Object.values(passRates));
	const passRateGapToLeaderPp: Record<string, number> = {};
	for (const a of agents) {
		passRateGapToLeaderPp[a] = (leader - passRates[a]) * 100;
	}
	const qualityGated = Object.values(passRateGapToLeaderPp).some((gap) => gap > qualityBandPp);

	return {
		resolvedTaskIds,
		perAgent,
		passRates,
		passRateGapToLeaderPp,
		qualityGated,
		qualityBandPp,
	};
}
