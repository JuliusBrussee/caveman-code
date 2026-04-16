// T-136: tokens-vs-resolved chart generator.

export interface SystemDatapoint {
	name: string;
	inputTokensTotal: number;
	outputTokensTotal: number;
	cacheReadTokensTotal?: number;
	resolvedCount: number;
	totalInstances: number;
	dollarsTotal?: number;
}

export interface PlotSpec {
	title: string;
	xAxis: string;
	yAxis: string;
	series: Array<{
		name: string;
		points: Array<{ x: number; y: number }>;
	}>;
}

export function buildTokensVsResolvedSpec(systems: SystemDatapoint[]): PlotSpec {
	return {
		title: "Tokens vs. Resolved",
		xAxis: "Total tokens (input + output)",
		yAxis: "Resolved rate",
		series: [
			{
				name: "systems",
				points: systems.map((s) => ({
					x: s.inputTokensTotal + s.outputTokensTotal,
					y: s.totalInstances === 0 ? 0 : s.resolvedCount / s.totalInstances,
				})),
			},
		],
	};
}

export function requireTwoComparisonSystems(systems: SystemDatapoint[]): void {
	if (systems.length < 2) {
		throw new Error("plot: requires ≥2 comparison systems");
	}
}

export function buildCostVsResolvedSpec(systems: SystemDatapoint[]): PlotSpec {
	return {
		title: "Cost vs. Resolved",
		xAxis: "Total cost ($)",
		yAxis: "Resolved rate",
		series: [
			{
				name: "systems",
				points: systems
					.filter((s) => s.dollarsTotal !== undefined)
					.map((s) => ({
						x: s.dollarsTotal!,
						y: s.totalInstances === 0 ? 0 : s.resolvedCount / s.totalInstances,
					})),
			},
		],
	};
}
