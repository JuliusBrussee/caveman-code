// T-126..T-130: verifier with best-of-N + executable ranking.

import type { LocalizerCandidate } from "./localizer.js";

export interface Candidate {
	id: string;
	diff: string;
	/** Source attributed to this candidate after the patch is applied. */
	patchedSource: string;
	/** Diff size in changed lines. */
	diffSize: number;
}

export interface VerifierConfig {
	n: number;
	maxReflexionDepth: number;
	runTest: (candidate: Candidate) => boolean;
}

export interface VerifierOutcome {
	winner: Candidate | null;
	passed: Candidate[];
	attempts: number;
	verdict: "ok" | "no_candidate_passes" | "budget_exceeded";
}

/** Best-of-N verifier: run tests against each candidate, pick the smallest
 *  diff that passes. Ties broken by deterministic smallest-diff key. */
export function verifyBestOfN(candidates: Candidate[], config: VerifierConfig): VerifierOutcome {
	if (candidates.length === 0) {
		return { winner: null, passed: [], attempts: 0, verdict: "no_candidate_passes" };
	}
	const top = candidates.slice(0, Math.max(1, config.n));
	const passed: Candidate[] = [];
	for (const c of top) {
		if (config.runTest(c)) passed.push(c);
	}
	if (passed.length === 0) {
		return { winner: null, passed: [], attempts: top.length, verdict: "no_candidate_passes" };
	}
	passed.sort((a, b) => {
		if (a.diffSize !== b.diffSize) return a.diffSize - b.diffSize;
		return a.id.localeCompare(b.id);
	});
	return { winner: passed[0], passed, attempts: top.length, verdict: "ok" };
}

/** T-130: Reflexion-lite single retry with depth ≤ 2 enforced. */
export interface ReflexionState {
	depth: number;
	roleTag: string;
}

export function canRetryReflexion(state: ReflexionState): boolean {
	return state.depth < 2;
}

export function incrementReflexion(state: ReflexionState): ReflexionState {
	if (state.depth >= 2) {
		throw new Error("reflexion: max depth 2 exceeded");
	}
	return { ...state, depth: state.depth + 1 };
}

// T-122, T-123: subagent context isolation + hard budget enforcement.
export interface SubagentBudget {
	maxInputTokens: number;
}

export interface SubagentResult<T> {
	verdict: "ok" | "budget_exceeded";
	summary: string;
	value?: T;
	inputTokens: number;
}

export function runSubagentWithBudget<T>(
	history: string[],
	budget: SubagentBudget,
	run: (history: readonly string[]) => T,
): SubagentResult<T> {
	const inputTokens = history.reduce((acc, s) => acc + Math.ceil(s.length / 4), 0);
	if (inputTokens > budget.maxInputTokens) {
		return {
			verdict: "budget_exceeded",
			summary: `<budget_exceeded: ${inputTokens} > ${budget.maxInputTokens}>`,
			inputTokens,
		};
	}
	const value = run([...history]);
	return {
		verdict: "ok",
		summary: `<subagent ok in=${inputTokens}>`,
		value,
		inputTokens,
	};
}

// T-124: ≤500-token structured summary.
export function clampSummaryToTokenLimit(text: string, maxTokens = 500): string {
	const maxChars = maxTokens * 4;
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars - 1)}…`;
}
