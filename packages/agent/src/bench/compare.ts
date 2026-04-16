// Cross-system token/cost comparison for coding agent benchmarks.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface BaselineData {
	system: string;
	benchmark: "swebench" | "microbench";
	date: string;
	source: string;
	resolvedCount: number;
	totalInstances: number;
	inputTokensTotal: number;
	outputTokensTotal: number;
	cacheReadTokensTotal?: number;
	dollarsTotal: number;
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
	const totalTokens = b.inputTokensTotal + b.outputTokensTotal;
	const resolved = b.resolvedCount || 1; // avoid /0

	return {
		system: b.system,
		benchmark: b.benchmark,
		resolvedRate: b.totalInstances > 0 ? b.resolvedCount / b.totalInstances : 0,
		tokensPerResolved: totalTokens / resolved,
		costPerResolved: b.dollarsTotal / resolved,
		tokenEfficiencyRatio: totalTokens > 0 ? (b.resolvedCount / totalTokens) * 1_000_000 : 0,
		cacheReadRatio:
			b.cacheReadTokensTotal !== undefined
				? b.cacheReadTokensTotal / (b.inputTokensTotal + b.cacheReadTokensTotal || 1)
				: undefined,
		outputTokenRatio: totalTokens > 0 ? b.outputTokensTotal / totalTokens : 0,
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

export function formatComparisonTable(report: ComparisonReport): string {
	const lines: string[] = [];

	lines.push("=== Cross-System Comparison ===");
	lines.push("");

	// Header
	lines.push(
		`| ${pad("System", 14)} | ${pad("Bench", 10)} | ${rpad("Resolved", 10)} | ${rpad("Tok/Resolved", 13)} | ${rpad("$/Resolved", 11)} | ${rpad("Eff (res/Mtok)", 15)} | ${rpad("Cache%", 7)} |`,
	);
	lines.push(
		`|${"-".repeat(16)}|${"-".repeat(12)}|${"-".repeat(12)}|${"-".repeat(15)}|${"-".repeat(13)}|${"-".repeat(17)}|${"-".repeat(9)}|`,
	);

	for (const row of report.rows) {
		const cacheStr = row.cacheReadRatio !== undefined ? pct(row.cacheReadRatio) : "n/a";
		lines.push(
			`| ${pad(row.system, 14)} | ${pad(row.benchmark, 10)} | ${rpad(pct(row.resolvedRate), 10)} | ${rpad(kTokens(row.tokensPerResolved), 13)} | ${rpad(dollars(row.costPerResolved), 11)} | ${rpad(row.tokenEfficiencyRatio.toFixed(2), 15)} | ${rpad(cacheStr, 7)} |`,
		);
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
