// T-083, T-084, T-085: per-turn + per-session cost caps.

import type { CostEntry } from "./types.js";

export interface CapConfig {
	perTurnDollars?: number;
	perSessionDollars?: number;
}

export type CapEvent =
	| { type: "cost_cap_turn"; turn: number; dollars: number; cap: number }
	| { type: "cost_cap_session"; dollars: number; cap: number };

export type CapListener = (event: CapEvent) => void;

export class CostCapTracker {
	private turnTotals = new Map<number, number>();
	private sessionTotal = 0;
	private turnCapTriggered = new Set<number>();
	private sessionCapTriggered = false;
	private readonly listeners: CapListener[] = [];
	private confirmationRequired = false;
	private pendingTurnCap: number | undefined;

	constructor(private readonly config: CapConfig = {}) {}

	onEvent(listener: CapListener): void {
		this.listeners.push(listener);
	}

	/** Called with the incremental cost of an LLM call mid-stream.
	 *  Returns true if the call should be cancelled immediately. */
	recordIncremental(entry: Pick<CostEntry, "turnIndex" | "dollarsEstimated">): boolean {
		const turnTotal = (this.turnTotals.get(entry.turnIndex) ?? 0) + entry.dollarsEstimated;
		this.turnTotals.set(entry.turnIndex, turnTotal);
		this.sessionTotal += entry.dollarsEstimated;

		const { perTurnDollars, perSessionDollars } = this.config;
		if (
			perTurnDollars !== undefined &&
			turnTotal >= perTurnDollars &&
			!this.turnCapTriggered.has(entry.turnIndex)
		) {
			this.turnCapTriggered.add(entry.turnIndex);
			this.pendingTurnCap = entry.turnIndex;
			this.confirmationRequired = true;
			for (const l of this.listeners) {
				l({
					type: "cost_cap_turn",
					turn: entry.turnIndex,
					dollars: turnTotal,
					cap: perTurnDollars,
				});
			}
			return true;
		}
		if (
			perSessionDollars !== undefined &&
			this.sessionTotal >= perSessionDollars &&
			!this.sessionCapTriggered
		) {
			this.sessionCapTriggered = true;
			for (const l of this.listeners) {
				l({ type: "cost_cap_session", dollars: this.sessionTotal, cap: perSessionDollars });
			}
			return true;
		}
		return false;
	}

	turnTotal(turnIndex: number): number {
		return this.turnTotals.get(turnIndex) ?? 0;
	}

	sessionSpent(): number {
		return this.sessionTotal;
	}

	/** T-084: next turn must have user confirmation if a cap fired. */
	requiresConfirmation(): boolean {
		return this.confirmationRequired;
	}

	acknowledgeConfirmation(): void {
		this.confirmationRequired = false;
		if (this.pendingTurnCap !== undefined) this.turnCapTriggered.delete(this.pendingTurnCap);
		this.pendingTurnCap = undefined;
	}

	isSessionCapped(): boolean {
		return this.sessionCapTriggered;
	}
}
