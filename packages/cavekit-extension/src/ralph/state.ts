/**
 * Ralph Loop state management.
 *
 * Tracks loop iteration, phase (build/review), findings history,
 * and provides convergence / ceiling detection.
 */

import type { ExtensionAPI, ExtensionContext } from "cave";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FindingsSummary {
	iteration: number;
	critical: number;
	high: number;
	medium: number;
	low: number;
	total: number;
	timestamp: string;
}

export interface RalphState {
	active: boolean;
	sessionId: string;
	iteration: number;
	maxIterations: number;
	phase: "build" | "review";
	baseBranch: string;
	findingsHistory: FindingsSummary[];
	startedAt: string;
	kitDomain: string | null;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const RALPH_ENTRY_TYPE = "ralph-state";

export function createInitialState(options: {
	sessionId: string;
	baseBranch: string;
	maxIterations?: number;
	kitDomain?: string;
}): RalphState {
	return {
		active: true,
		sessionId: options.sessionId,
		iteration: 0,
		maxIterations: options.maxIterations ?? 10,
		phase: "build",
		baseBranch: options.baseBranch,
		findingsHistory: [],
		startedAt: new Date().toISOString(),
		kitDomain: options.kitDomain ?? null,
	};
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export function persistState(pi: ExtensionAPI, state: RalphState): void {
	pi.appendEntry(RALPH_ENTRY_TYPE, state);
}

export function restoreState(ctx: ExtensionContext): RalphState | null {
	const entries = ctx.sessionManager.getEntries();

	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i] as { type: string; customType?: string; data?: unknown };
		if (entry.type === "custom" && entry.customType === RALPH_ENTRY_TYPE) {
			return (entry.data as RalphState) ?? null;
		}
	}

	return null;
}

// ---------------------------------------------------------------------------
// Convergence detection
// ---------------------------------------------------------------------------

/** Minimum review iterations before convergence analysis is meaningful. */
const MIN_REVIEWS_FOR_CONVERGENCE = 3;

/**
 * Returns true when findings are trending downward — total is non-increasing
 * across the last 3 reviews and at least one decreased.
 */
export function isConverging(state: RalphState): boolean {
	const history = state.findingsHistory;
	if (history.length < MIN_REVIEWS_FOR_CONVERGENCE) return false;

	const recent = history.slice(-MIN_REVIEWS_FOR_CONVERGENCE);
	let anyDecreased = false;

	for (let i = 1; i < recent.length; i++) {
		if (recent[i].total > recent[i - 1].total) return false;
		if (recent[i].total < recent[i - 1].total) anyDecreased = true;
	}

	return anyDecreased;
}

/**
 * Returns true when findings have plateaued — same total for 3+ consecutive reviews.
 */
export function isCeiling(state: RalphState): boolean {
	const history = state.findingsHistory;
	if (history.length < MIN_REVIEWS_FOR_CONVERGENCE) return false;

	const recent = history.slice(-MIN_REVIEWS_FOR_CONVERGENCE);
	return recent.every((s) => s.total === recent[0].total);
}

/**
 * Returns true when the loop can be considered complete:
 * no critical or high findings in the most recent review.
 */
export function isClean(state: RalphState): boolean {
	const latest = state.findingsHistory[state.findingsHistory.length - 1];
	if (!latest) return false;
	return latest.critical === 0 && latest.high === 0;
}

/**
 * Returns a convergence label for the forge widget.
 */
export function convergenceLabel(state: RalphState): string {
	if (state.findingsHistory.length === 0) return "awaiting review";
	if (isClean(state)) return "hardened";
	if (isCeiling(state)) return "ceiling — consider adjusting strategy";
	if (isConverging(state)) return "converging";
	return "forging";
}
