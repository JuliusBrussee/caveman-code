// T-034, T-035: per-provider pricing table + user override.

export interface ModelPrice {
	/** $ per 1M input tokens (uncached). */
	inputPerMillion: number;
	/** $ per 1M cached input tokens. */
	cachedInputPerMillion: number;
	/** $ per 1M cache-write tokens. */
	cacheWritePerMillion: number;
	/** $ per 1M output tokens. */
	outputPerMillion: number;
}

export type PricingTable = Record<string, ModelPrice>;

export const DEFAULT_PRICING: PricingTable = {
	"claude-opus-4-6": {
		inputPerMillion: 15.0,
		cachedInputPerMillion: 1.5,
		cacheWritePerMillion: 18.75,
		outputPerMillion: 75.0,
	},
	"claude-sonnet-4-6": {
		inputPerMillion: 3.0,
		cachedInputPerMillion: 0.3,
		cacheWritePerMillion: 3.75,
		outputPerMillion: 15.0,
	},
	"claude-haiku-4-5": {
		inputPerMillion: 1.0,
		cachedInputPerMillion: 0.1,
		cacheWritePerMillion: 1.25,
		outputPerMillion: 5.0,
	},
	"gpt-5": {
		inputPerMillion: 10.0,
		cachedInputPerMillion: 5.0,
		cacheWritePerMillion: 10.0,
		outputPerMillion: 30.0,
	},
};

export class PricingResolver {
	private table: PricingTable;

	constructor(initial: PricingTable = DEFAULT_PRICING) {
		this.table = { ...initial };
	}

	override(model: string, price: ModelPrice): void {
		this.table[model] = price;
	}

	bulkOverride(overrides: PricingTable): void {
		for (const [model, price] of Object.entries(overrides)) {
			this.table[model] = price;
		}
	}

	priceOf(model: string): ModelPrice | undefined {
		return this.table[model];
	}

	estimateDollars(
		model: string,
		input: number,
		cachedInput: number,
		cacheWrite: number,
		output: number,
	): number {
		const p = this.table[model];
		if (!p) return 0;
		return (
			(input * p.inputPerMillion) / 1_000_000 +
			(cachedInput * p.cachedInputPerMillion) / 1_000_000 +
			(cacheWrite * p.cacheWritePerMillion) / 1_000_000 +
			(output * p.outputPerMillion) / 1_000_000
		);
	}
}
