// T-086, T-087: /cost slash command live panel with hit-rate formula.

export interface CostPanelState {
	sessionDollars: number;
	inputTokens: number;
	cachedInputTokens: number;
	uncachedInputTokens: number;
	outputTokens: number;
	cachedToolResults: number;
	hitRate: number;
}

export class CostPanel {
	private state: CostPanelState = {
		sessionDollars: 0,
		inputTokens: 0,
		cachedInputTokens: 0,
		uncachedInputTokens: 0,
		outputTokens: 0,
		cachedToolResults: 0,
		hitRate: 0,
	};

	record(update: Partial<CostPanelState>): void {
		if (update.sessionDollars !== undefined) this.state.sessionDollars = update.sessionDollars;
		if (update.inputTokens !== undefined) this.state.inputTokens += update.inputTokens;
		if (update.cachedInputTokens !== undefined)
			this.state.cachedInputTokens += update.cachedInputTokens;
		if (update.uncachedInputTokens !== undefined)
			this.state.uncachedInputTokens += update.uncachedInputTokens;
		if (update.outputTokens !== undefined) this.state.outputTokens += update.outputTokens;
		if (update.cachedToolResults !== undefined)
			this.state.cachedToolResults = update.cachedToolResults;
		const total = this.state.cachedInputTokens + this.state.uncachedInputTokens;
		this.state.hitRate = total === 0 ? 0 : this.state.cachedInputTokens / total;
	}

	snapshot(): CostPanelState {
		return { ...this.state };
	}

	render(): string {
		const s = this.state;
		const pct = (s.hitRate * 100).toFixed(1);
		return [
			`$${s.sessionDollars.toFixed(4)} spent`,
			`input: ${s.inputTokens} (${s.cachedInputTokens} cached / ${s.uncachedInputTokens} uncached)`,
			`output: ${s.outputTokens}`,
			`tool cache hits: ${s.cachedToolResults}`,
			`prompt cache hit rate: ${pct}%`,
		].join("\n");
	}
}
