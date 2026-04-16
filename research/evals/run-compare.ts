#!/usr/bin/env npx tsx
/**
 * Cross-system comparison tool for Cave CLI benchmarks.
 *
 * Loads cave benchmark results and external system baselines,
 * then produces a comparison table showing token efficiency,
 * cost per resolved task, and cache hit rates.
 *
 * Usage:
 *   npx tsx research/evals/run-compare.ts [options]
 *
 * Options:
 *   --cave-results <path>   Path to cave results JSON (auto-finds latest if omitted)
 *   --baselines-dir <path>  Directory with baseline JSONs (default: research/baselines/)
 *   --benchmark <type>      Filter: swebench or microbench
 *   --format <json|table>   Output format (default: table)
 *   --output <path>         Write JSON report to file
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	loadBaselinesFromDir,
	resultsToBaseline,
	compareSystemsJSON,
	formatComparisonTable,
	type BaselineData,
} from "../../packages/agent/src/bench/compare.js";

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

interface CompareConfig {
	caveResultsPath?: string;
	baselinesDir: string;
	benchmark?: string;
	format: "json" | "table";
	outputPath?: string;
}

function parseArgs(): CompareConfig {
	const args = process.argv.slice(2);
	const config: CompareConfig = {
		baselinesDir: resolve("research/baselines"),
		format: "table",
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		switch (arg) {
			case "--cave-results":
				config.caveResultsPath = resolve(args[++i]);
				break;
			case "--baselines-dir":
				config.baselinesDir = resolve(args[++i]);
				break;
			case "--benchmark":
				config.benchmark = args[++i];
				break;
			case "--format":
				config.format = args[++i] as "json" | "table";
				break;
			case "--output":
				config.outputPath = resolve(args[++i]);
				break;
			default:
				console.error(`Unknown arg: ${arg}`);
				process.exit(1);
		}
	}
	return config;
}

// ---------------------------------------------------------------------------
// Auto-find latest results
// ---------------------------------------------------------------------------

function findLatestResults(dir: string, benchmark?: string): string | null {
	if (!existsSync(dir)) return null;

	const prefix = benchmark === "microbench" ? "microbench-" : "swebench-";
	const files = readdirSync(dir)
		.filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
		.sort()
		.reverse();

	return files.length > 0 ? join(dir, files[0]) : null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
	const config = parseArgs();

	// Load cave results
	let caveResultsPath = config.caveResultsPath;
	if (!caveResultsPath) {
		caveResultsPath = findLatestResults(resolve("research/results"), config.benchmark);
		if (!caveResultsPath) {
			console.error("No cave results found. Run bench:micro or bench:swebench first, or specify --cave-results.");
			process.exit(1);
		}
		console.log(`Auto-detected results: ${caveResultsPath}`);
	}

	const caveResults = JSON.parse(readFileSync(caveResultsPath, "utf-8"));
	const caveBenchmark = caveResults.benchmark ?? "swebench";
	const effectiveBenchmark = config.benchmark ?? caveBenchmark;

	// Convert cave results to baseline format
	const caveBaseline = resultsToBaseline(caveResults, "cave");

	// Load external baselines
	const externalBaselines = loadBaselinesFromDir(config.baselinesDir, effectiveBenchmark);

	if (externalBaselines.length === 0) {
		console.log(`No external baselines found for "${effectiveBenchmark}" in ${config.baselinesDir}`);
		console.log("Showing cave results only.\n");
	}

	// Combine all systems
	const allSystems: BaselineData[] = [caveBaseline, ...externalBaselines];

	// Generate comparison
	const report = compareSystemsJSON(allSystems);

	if (config.format === "json") {
		const json = JSON.stringify(report, null, 2);
		if (config.outputPath) {
			writeFileSync(config.outputPath, json);
			console.log(`Report written to ${config.outputPath}`);
		} else {
			console.log(json);
		}
	} else {
		const table = formatComparisonTable(report);
		console.log(table);

		if (config.outputPath) {
			writeFileSync(config.outputPath, JSON.stringify(report, null, 2));
			console.log(`\nJSON report also written to ${config.outputPath}`);
		}
	}
}

main();
