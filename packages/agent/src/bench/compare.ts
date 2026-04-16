// Cross-system token/cost comparison for coding agent benchmarks.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface BaselineData {
	system: string;
	benchmark: "swebench" | "microbench" | "terminal-bench";
	date: string;
	source: string;
	resolvedCount: number;
	totalInstances: number;
	inputTokensTotal: number;
	outputTokensTotal: number;
	cacheReadTokensTotal?: number;
	cacheWriteTokensTotal?: number;
	dollarsTotal: number;
	/** Mean conversation turns / agent steps (terminal-bench only). */
	meanTurns?: number;
	/** Mean wall-clock per task in ms (terminal-bench only). */
	meanWallTimeMs?: number;
	/** Iso-quality intersection size used to compute the headline number. */
	isoQualityResolvedCount?: number;
	/** Sum of total tokens for this agent restricted to the iso-quality intersection. */
	isoQualityTokensTotal?: number;
	/** Average token-verification delta across rows (subscription mode: ≤5%; api-key: ≤2%). */
	tokensVerificationDeltaPct?: number;
}

export interface ComparisonRow {
	system: string;
	benchmark: string;
	resolvedRate: number;
	tokensPerResolved: number;
	costPerResolved: number;
	/** Resolved tasks per million tokens consumed. */
	tokenEfficiencyRatio: number;
	/** cacheRead / (input + cacheRead) — undefined if no cache data. */
	cacheReadRatio?: number;
	/** output / (input + output). */
	outputTokenRatio: number;
	/** Iso-quality tokens-per-resolved (terminal-bench headline number). */
	isoQualityTokensPerResolved?: number;
	meanTurns?: number;
	meanWallTimeMs?: number;
	tokensVerificationDeltaPct?: number;
}

export interface ComparisonReport {
	date: string;
	benchmarks: string[];
	rows: ComparisonRow[];
	/** Each system normalized against cave (cave = 1.0). */
	relativeToCave: Array<{
		system: string;
		tokenEfficiency: number;
		costEfficiency: number;
	}>;
}

export function loadBaseline(filePath: string): BaselineData {
	const raw = JSON.parse(readFileSync(filePath, "utf-8"));
	const required = [
		"system",
		"benchmark",
		"date",
		"source",
		"resolvedCount",
		"totalInstances",
		"inputTokensTotal",
		"outputTokensTotal",
		"dollarsTotal",
	];
	for (const key of required) {
		if (raw[key] === undefined) {
			throw new Error(`Baseline ${filePath}: missing required field "${key}"`);
		}
	}
	return raw as BaselineData;
}

export function loadBaselinesFromDir(dir: string, benchmark?: string): BaselineData[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith(".json"))
		.map((f) => loadBaseline(join(dir, f)))
		.filter((b) => !benchmark || b.benchmark === benchmark);
}

/**
 * Convert a cave results JSON (swebench or microbench format) to BaselineData.
 * Sums tokens from per-instance traces if available.
 */
export function resultsToBaseline(results: any, system = "cave"): BaselineData {
	const benchmark: "swebench" | "microbench" = results.benchmark ?? "swebench";
	const agg = results.aggregate;

	let inputTokensTotal = 0;
	let outputTokensTotal = 0;
	let cacheReadTokensTotal = 0;
	let hasCacheData = false;

	if (Array.isArray(results.results)) {
		for (const r of results.results) {
			if (r.tokens) {
				inputTokensTotal += r.tokens.input ?? 0;
				outputTokensTotal += r.tokens.output ?? 0;
				if (r.tokens.cacheRead !== undefined) {
					cacheReadTokensTotal += r.tokens.cacheRead;
					hasCacheData = true;
				}
			}
		}
	}

	return {
		system,
		benchmark,
		date: results.date ?? new Date().toISOString().slice(0, 10),
		source: "measured",
		resolvedCount: agg.resolved,
		totalInstances: agg.total,
		inputTokensTotal,
		outputTokensTotal,
		...(hasCacheData ? { cacheReadTokensTotal } : {}),
		dollarsTotal: agg.dollarsTotal,
	};
}

function toRow(b: BaselineData): ComparisonRow {
	// Cave splits prompt tokens into non-cached (input) + cached (cacheRead).
	// External baselines report total prompt tokens in inputTokensTotal.
	// Total prompt = input + cacheRead; total all = prompt + output.
	const promptTokens = b.inputTokensTotal + (b.cacheReadTokensTotal ?? 0);
	const totalTokens = promptTokens + b.outputTokensTotal;
	const resolved = b.resolvedCount || 1; // avoid /0

	let isoQualityTokensPerResolved: number | undefined;
	if (b.isoQualityTokensTotal !== undefined && b.isoQualityResolvedCount && b.isoQualityResolvedCount > 0) {
		isoQualityTokensPerResolved = b.isoQualityTokensTotal / b.isoQualityResolvedCount;
	}

	return {
		system: b.system,
		benchmark: b.benchmark,
		resolvedRate: b.totalInstances > 0 ? b.resolvedCount / b.totalInstances : 0,
		tokensPerResolved: totalTokens / resolved,
		costPerResolved: b.dollarsTotal / resolved,
		tokenEfficiencyRatio: totalTokens > 0 ? (b.resolvedCount / totalTokens) * 1_000_000 : 0,
		cacheReadRatio: b.cacheReadTokensTotal !== undefined ? b.cacheReadTokensTotal / (promptTokens || 1) : undefined,
		outputTokenRatio: totalTokens > 0 ? b.outputTokensTotal / totalTokens : 0,
		isoQualityTokensPerResolved,
		meanTurns: b.meanTurns,
		meanWallTimeMs: b.meanWallTimeMs,
		tokensVerificationDeltaPct: b.tokensVerificationDeltaPct,
	};
}

export function compareSystemsJSON(systems: BaselineData[]): ComparisonReport {
	const rows = systems.map(toRow);
	const benchmarks = [...new Set(systems.map((s) => s.benchmark))];
	const caveRow = rows.find((r) => r.system === "cave");

	const relativeToCave = rows.map((r) => ({
		system: r.system,
		tokenEfficiency:
			caveRow && caveRow.tokenEfficiencyRatio > 0 ? r.tokenEfficiencyRatio / caveRow.tokenEfficiencyRatio : 1,
		costEfficiency: caveRow && caveRow.costPerResolved > 0 ? caveRow.costPerResolved / r.costPerResolved : 1,
	}));

	return {
		date: new Date().toISOString().slice(0, 10),
		benchmarks,
		rows,
		relativeToCave,
	};
}

// ---------------------------------------------------------------------------
// Terminal table formatter
// ---------------------------------------------------------------------------

function pad(s: string, w: number): string {
	return s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length);
}

function rpad(s: string, w: number): string {
	return s.length >= w ? s.slice(0, w) : " ".repeat(w - s.length) + s;
}

function pct(n: number): string {
	return `${(n * 100).toFixed(1)}%`;
}

function dollars(n: number): string {
	return `$${n.toFixed(2)}`;
}

function kTokens(n: number): string {
	return `${(n / 1000).toFixed(0)}k`;
}

export interface FormatComparisonOptions {
	/** Subscription mode hides the dollar column ("all on plan; tokens are the unit"). */
	authMode?: "subscription" | "api-key";
	/** Quality-band footer flag. Surfaced when iso-quality slice was gated. */
	qualityGated?: boolean;
	/** Number of tasks in the iso-quality intersection (footer). */
	isoQualityCount?: number;
}

export function formatComparisonTable(report: ComparisonReport, options: FormatComparisonOptions = {}): string {
	const lines: string[] = [];
	const isTb = report.benchmarks.includes("terminal-bench");
	const showDollars = !(isTb && options.authMode === "subscription");

	lines.push("=== Cross-System Comparison ===");
	lines.push("");

	// Header — for terminal-bench, lead with the iso-quality headline column;
	// otherwise the SWE-bench/microbench tables stay byte-identical.
	const benchWidth = isTb ? 14 : 10;
	let header = `| ${pad("System", 14)} | ${pad("Bench", benchWidth)} |`;
	let rule = `|${"-".repeat(16)}|${"-".repeat(benchWidth + 2)}|`;
	if (isTb) {
		header += ` ${rpad("Iso Tok/Res", 12)} |`;
		rule += `${"-".repeat(14)}|`;
	}
	header += ` ${rpad("Resolved", 10)} | ${rpad("Tok/Resolved", 13)} | ${rpad("$/Resolved", 11)} | ${rpad("Eff (res/Mtok)", 15)} | ${rpad("Cache%", 7)} |`;
	rule += `${"-".repeat(12)}|${"-".repeat(15)}|${"-".repeat(13)}|${"-".repeat(17)}|${"-".repeat(9)}|`;
	if (isTb) {
		header += ` ${rpad("Turns", 6)} | ${rpad("Wall", 7)} |`;
		rule += `${"-".repeat(8)}|${"-".repeat(9)}|`;
	}
	lines.push(header);
	lines.push(rule);

	for (const row of report.rows) {
		const cacheStr = row.cacheReadRatio !== undefined ? pct(row.cacheReadRatio) : "n/a";
		// Per-row badge when token verification delta exceeds 2% (terminal-bench only).
		const deltaBadge =
			isTb && row.tokensVerificationDeltaPct !== undefined && row.tokensVerificationDeltaPct > 0.02 ? " *" : "";
		const systemLabel = pad(`${row.system}${deltaBadge}`, 14);
		let line = `| ${systemLabel} | ${pad(row.benchmark, benchWidth)} |`;
		if (isTb) {
			const iso = row.isoQualityTokensPerResolved !== undefined ? kTokens(row.isoQualityTokensPerResolved) : "n/a";
			line += ` ${rpad(iso, 12)} |`;
		}
		// In subscription-mode terminal-bench the dollar column is meaningless
		// (everyone is on a plan); blank it but keep alignment so the SWE-bench
		// / microbench tables remain byte-identical.
		const costStr = showDollars ? dollars(row.costPerResolved) : "—";
		line += ` ${rpad(pct(row.resolvedRate), 10)} | ${rpad(kTokens(row.tokensPerResolved), 13)} | ${rpad(costStr, 11)} | ${rpad(row.tokenEfficiencyRatio.toFixed(2), 15)} | ${rpad(cacheStr, 7)} |`;
		if (isTb) {
			const turns = row.meanTurns !== undefined ? row.meanTurns.toFixed(1) : "n/a";
			const wall = row.meanWallTimeMs !== undefined ? `${(row.meanWallTimeMs / 1000).toFixed(1)}s` : "n/a";
			line += ` ${rpad(turns, 6)} | ${rpad(wall, 7)} |`;
		}
		lines.push(line);
	}

	// Footer for terminal-bench: iso-quality count + quality-gating warning +
	// verification-delta badge legend.
	if (isTb) {
		lines.push("");
		if (options.isoQualityCount !== undefined) {
			lines.push(`Iso-quality intersection: ${options.isoQualityCount} task(s) resolved by every agent.`);
		}
		if (options.qualityGated) {
			lines.push(
				"WARNING: pass rates differ by more than the quality band — headline number is quality-gated, not like-for-like.",
			);
		}
		const anyDeltaFlagged = report.rows.some(
			(r) => r.tokensVerificationDeltaPct !== undefined && r.tokensVerificationDeltaPct > 0.02,
		);
		if (anyDeltaFlagged) {
			lines.push("`*` after system name = token-verification delta > 2%; investigate parser before publishing.");
		}
		if (!showDollars) {
			lines.push("All agents authenticated via subscription plan; tokens are the cost-attributable unit.");
		}
	}

	// Relative section
	const caveRelative = report.relativeToCave.find((r) => r.system !== "cave");
	if (caveRelative) {
		lines.push("");
		lines.push("--- Relative to Cave ---");
		lines.push("");
		lines.push(`| ${pad("System", 14)} | ${rpad("Token Eff", 10)} | ${rpad("Cost Eff", 10)} |`);
		lines.push(`|${"-".repeat(16)}|${"-".repeat(12)}|${"-".repeat(12)}|`);

		for (const rel of report.relativeToCave) {
			const tokEff =
				rel.tokenEfficiency >= 1 ? `${rel.tokenEfficiency.toFixed(2)}x` : `${rel.tokenEfficiency.toFixed(2)}x`;
			const costEff =
				rel.costEfficiency >= 1 ? `${rel.costEfficiency.toFixed(2)}x` : `${rel.costEfficiency.toFixed(2)}x`;
			lines.push(`| ${pad(rel.system, 14)} | ${rpad(tokEff, 10)} | ${rpad(costEff, 10)} |`);
		}

		lines.push("");
		lines.push("Token Eff >1 = cave resolves more per token. Cost Eff >1 = cave cheaper per resolve.");
	}

	return lines.join("\n");
}
