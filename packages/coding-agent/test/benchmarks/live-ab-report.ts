/**
 * Live A/B Report Formatter
 *
 * Formats benchmark results as markdown tables.
 */

export interface TaskResult {
	taskId: string;
	taskName: string;
	caveMode: { enabled: boolean; intensity?: string };
	success: boolean;
	turns: number;
	tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
	cost: number;
	durationMs: number;
}

export interface ABResult {
	taskId: string;
	taskName: string;
	off: TaskResult;
	on: TaskResult;
	tokenSavingsPercent: number;
	costSavingsPercent: number;
	qualityDelta: number; // 0 = same, -1 = cave mode worse, +1 = cave mode better
}

export function formatABResults(results: ABResult[]): string {
	const lines: string[] = [];

	lines.push("=== Live A/B Benchmark Results ===\n");

	// Per-task detail table
	lines.push("| Task | Mode | Input Tok | Output Tok | Total Tok | Cost     | Turns | Pass? |");
	lines.push("|------|------|-----------|------------|-----------|----------|-------|-------|");

	for (const result of results) {
		const name = result.taskName.slice(0, 20).padEnd(20);
		// OFF row
		lines.push(
			`| ${name} | OFF  | ${fmt(result.off.tokens.input)} | ${fmt(result.off.tokens.output)} | ${fmt(result.off.tokens.total)} | $${result.off.cost.toFixed(4).padStart(7)} | ${String(result.off.turns).padStart(5)} | ${result.off.success ? "yes" : "NO "}   |`,
		);
		// ON row
		lines.push(
			`| ${"".padEnd(20)} | ON   | ${fmt(result.on.tokens.input)} | ${fmt(result.on.tokens.output)} | ${fmt(result.on.tokens.total)} | $${result.on.cost.toFixed(4).padStart(7)} | ${String(result.on.turns).padStart(5)} | ${result.on.success ? "yes" : "NO "}   |`,
		);
	}

	// Summary table
	lines.push("\n--- Summary ---\n");
	lines.push("| Task                 | Token Savings | Cost Savings | Quality |");
	lines.push("|----------------------|---------------|--------------|---------|");

	let totalOffTokens = 0;
	let totalOnTokens = 0;
	let totalOffCost = 0;
	let totalOnCost = 0;
	let offPass = 0;
	let onPass = 0;

	for (const result of results) {
		const name = result.taskName.slice(0, 20).padEnd(20);
		const tokenSav = `${result.tokenSavingsPercent > 0 ? "-" : "+"}${Math.abs(result.tokenSavingsPercent).toFixed(1)}%`.padStart(13);
		const costSav = `${result.costSavingsPercent > 0 ? "-" : "+"}${Math.abs(result.costSavingsPercent).toFixed(1)}%`.padStart(12);
		const quality =
			result.qualityDelta === 0 ? "same" : result.qualityDelta > 0 ? "better" : "worse";

		lines.push(`| ${name} | ${tokenSav} | ${costSav} | ${quality.padStart(7)} |`);

		totalOffTokens += result.off.tokens.total;
		totalOnTokens += result.on.tokens.total;
		totalOffCost += result.off.cost;
		totalOnCost += result.on.cost;
		if (result.off.success) offPass++;
		if (result.on.success) onPass++;
	}

	const avgTokenSavings =
		totalOffTokens > 0 ? ((totalOffTokens - totalOnTokens) / totalOffTokens) * 100 : 0;
	const avgCostSavings =
		totalOffCost > 0 ? ((totalOffCost - totalOnCost) / totalOffCost) * 100 : 0;

	lines.push("|----------------------|---------------|--------------|---------|");
	lines.push(
		`| ${"AVERAGE".padEnd(20)} | ${`-${avgTokenSavings.toFixed(1)}%`.padStart(13)} | ${`-${avgCostSavings.toFixed(1)}%`.padStart(12)} |         |`,
	);

	lines.push(`\nQuality: OFF passed ${offPass}/${results.length}, ON passed ${onPass}/${results.length}`);
	lines.push(
		`Tokens: OFF ${totalOffTokens.toLocaleString()} total, ON ${totalOnTokens.toLocaleString()} total (${avgTokenSavings.toFixed(1)}% savings)`,
	);
	lines.push(
		`Cost: OFF $${totalOffCost.toFixed(4)}, ON $${totalOnCost.toFixed(4)} (${avgCostSavings.toFixed(1)}% savings)`,
	);

	return lines.join("\n");
}

function fmt(n: number): string {
	return n.toLocaleString().padStart(9);
}
