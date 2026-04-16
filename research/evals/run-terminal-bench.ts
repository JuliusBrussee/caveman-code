#!/usr/bin/env npx tsx
/**
 * Terminal-Bench head-to-head runner.
 *
 * Loops (agent × task), spawning `tb run` per (agent, task), parses each
 * results.json into an AgentRunRecord, computes the iso-quality slice across
 * all agents, and writes per-agent baseline JSONs into research/baselines/
 * plus a combined run report into research/results/.
 *
 * Usage:
 *   npx tsx research/evals/run-terminal-bench.ts \
 *     --agents cave,codex,claude \
 *     --tasks research/evals/terminal-bench/task-lists/tb-core-smoke.txt \
 *     --limit 3 \
 *     --output research/results/tb-smoke \
 *     --cap-wall-sec 600 \
 *     --max-total-dollars 50
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	type AgentRunRecord,
	computeIsoQuality,
	loadTbTaskIds,
	runTbInstance,
	tbResultsToBaseline,
} from "../../packages/agent/src/bench/index.js";

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

type Agent = "cave" | "codex" | "claude-code";

interface RunConfig {
	agents: Agent[];
	tasksPath: string;
	limit?: number;
	outputDir: string;
	capWallSeconds: number;
	maxTotalDollars: number;
	tbBinary: string;
	caveAgentImportPath: string;
	caveModel: string;
	codexModel: string;
	claudeModel: string;
	authMode: "subscription" | "api-key";
	qualityBandPp: number;
	dryRun: boolean;
}

function parseArgs(): RunConfig {
	const args = process.argv.slice(2);
	const config: RunConfig = {
		agents: ["cave", "codex", "claude-code"],
		tasksPath: resolve("research/evals/terminal-bench/task-lists/tb-core-smoke.txt"),
		outputDir: resolve("research/results/terminal-bench"),
		capWallSeconds: 600,
		maxTotalDollars: 50,
		tbBinary: resolve("research/evals/terminal-bench/.venv/bin/tb"),
		caveAgentImportPath: resolve("research/evals/terminal-bench/cave-tb-agent"),
		caveModel: "gpt-5.4",
		codexModel: "gpt-5.4",
		claudeModel: "claude-opus-4-7",
		authMode: "subscription",
		qualityBandPp: 5,
		dryRun: false,
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		switch (arg) {
			case "--agents":
				config.agents = args[++i].split(",").map(normalizeAgent);
				break;
			case "--tasks":
				config.tasksPath = resolve(args[++i]);
				break;
			case "--limit":
				config.limit = Number(args[++i]);
				break;
			case "--output":
				config.outputDir = resolve(args[++i]);
				break;
			case "--cap-wall-sec":
				config.capWallSeconds = Number(args[++i]);
				break;
			case "--max-total-dollars":
				config.maxTotalDollars = Number(args[++i]);
				break;
			case "--tb-binary":
				config.tbBinary = resolve(args[++i]);
				break;
			case "--cave-agent-path":
				config.caveAgentImportPath = resolve(args[++i]);
				break;
			case "--cave-model":
				config.caveModel = args[++i];
				break;
			case "--codex-model":
				config.codexModel = args[++i];
				break;
			case "--claude-model":
				config.claudeModel = args[++i];
				break;
			case "--auth-mode":
				config.authMode = args[++i] as RunConfig["authMode"];
				break;
			case "--quality-band":
				config.qualityBandPp = Number(args[++i]);
				break;
			case "--dry-run":
				config.dryRun = true;
				break;
			default:
				console.error(`Unknown arg: ${arg}`);
				process.exit(1);
		}
	}
	return config;
}

function normalizeAgent(name: string): Agent {
	const n = name.trim().toLowerCase();
	if (n === "cave") return "cave";
	if (n === "codex" || n === "codex-cli") return "codex";
	if (n === "claude" || n === "claude-code") return "claude-code";
	throw new Error(`Unknown agent: ${name}`);
}

// ---------------------------------------------------------------------------
// Per-agent invocation config
// ---------------------------------------------------------------------------

function agentKwargsFor(agent: Agent, config: RunConfig): Record<string, string> {
	switch (agent) {
		case "cave":
			return { model: config.caveModel };
		case "codex":
			return { model_name: config.codexModel };
		case "claude-code":
			return { model_name: config.claudeModel };
	}
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(msg: string): void {
	const ts = new Date().toISOString().slice(11, 19);
	console.log(`[${ts}] ${msg}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const config = parseArgs();
	const tasks = loadTbTaskIds(config.tasksPath);
	const limited = config.limit ? tasks.slice(0, config.limit) : tasks;

	log("=== Terminal-Bench Head-to-Head Runner ===");
	log(`Agents: ${config.agents.join(", ")}`);
	log(`Tasks: ${limited.length} from ${config.tasksPath}`);
	log(`Auth mode: ${config.authMode}`);
	log(`Wall cap: ${config.capWallSeconds}s/task | Total dollar cap: $${config.maxTotalDollars}`);

	if (config.dryRun) {
		log("DRY RUN — would execute:");
		for (const a of config.agents) {
			for (const t of limited) {
				console.log(`  ${a} × ${t.id}`);
			}
		}
		process.exit(0);
	}

	mkdirSync(config.outputDir, { recursive: true });
	const date = new Date().toISOString().slice(0, 10);
	const records: AgentRunRecord[] = [];
	let totalDollars = 0;
	let aborted = false;

	for (const agent of config.agents) {
		log("");
		log(`--- agent: ${agent} ---`);
		for (let i = 0; i < limited.length; i++) {
			if (totalDollars >= config.maxTotalDollars) {
				log(`Total dollar cap $${config.maxTotalDollars} reached; aborting remaining runs.`);
				aborted = true;
				break;
			}
			const task = limited[i];
			const agentOutDir = join(config.outputDir, agent);
			mkdirSync(agentOutDir, { recursive: true });

			log(`[${i + 1}/${limited.length}] ${agent} × ${task.id}`);
			const { record } = await runTbInstance({
				agent,
				taskId: task.id,
				outputDir: agentOutDir,
				tbBinary: config.tbBinary,
				capWallSeconds: config.capWallSeconds,
				agentKwargs: agentKwargsFor(agent, config),
				caveAgentImportPath: agent === "cave" ? config.caveAgentImportPath : undefined,
				env: {
					CAVE_BENCH_INSTANCE_CAP_DOLLARS: String(
						process.env.CAVE_BENCH_INSTANCE_CAP_DOLLARS ?? config.maxTotalDollars,
					),
				},
			});
			records.push(record);
			totalDollars += record.dollars ?? 0;

			const tokTotal = record.tokens.input + record.tokens.output + record.tokens.cacheRead + record.tokens.cacheWrite;
			log(
				`  ${record.resolved ? "PASS" : "FAIL"} | ${(record.wallTimeMs / 1000).toFixed(1)}s | ` +
					`${tokTotal} tok | turns=${record.turns}` +
					(record.dollars !== undefined ? ` | $${record.dollars.toFixed(4)}` : "") +
					(record.costCapFailure ? " | CAP" : "") +
					(record.notes ? ` | ${record.notes}` : ""),
			);
		}
		if (aborted) break;
	}

	// Iso-quality slice across all agents.
	const iso = computeIsoQuality(records, { qualityBandPp: config.qualityBandPp });

	// Per-agent baselines (drop into research/baselines/).
	const baselinesDir = resolve("research/baselines");
	mkdirSync(baselinesDir, { recursive: true });
	for (const agent of config.agents) {
		const isoEntry = iso.perAgent.find((p) => p.agent === agent);
		const baseline = tbResultsToBaseline(records, agent, {
			date,
			source: `terminal-bench live run (${config.authMode} mode)`,
			isoQualityResolvedCount: isoEntry?.resolvedCount,
			isoQualityTokensTotal: isoEntry?.tokensTotal,
		});
		// Mark each record as quality-gated so consumers can flag rows.
		for (const r of records) {
			if (r.agent === agent) r.qualityGated = iso.qualityGated;
		}
		const baselinePath = join(baselinesDir, `${agent}-terminal-bench.json`);
		writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
		log(`Wrote ${baselinePath}`);
	}

	// Combined run report.
	const reportPath = join(resolve("research/results"), `terminal-bench-${date}.json`);
	mkdirSync(resolve("research/results"), { recursive: true });
	const report = {
		date,
		benchmark: "terminal-bench" as const,
		authMode: config.authMode,
		config: {
			agents: config.agents,
			tasksPath: config.tasksPath,
			limit: limited.length,
			capWallSeconds: config.capWallSeconds,
			maxTotalDollars: config.maxTotalDollars,
			caveModel: config.caveModel,
			codexModel: config.codexModel,
			claudeModel: config.claudeModel,
			qualityBandPp: config.qualityBandPp,
		},
		isoQuality: iso,
		results: records,
		aggregate: {
			totalRuns: records.length,
			totalDollars,
			aborted,
		},
	};
	writeFileSync(reportPath, JSON.stringify(report, null, 2));

	log("");
	log("=== Results ===");
	for (const a of config.agents) {
		const own = records.filter((r) => r.agent === a);
		const passed = own.filter((r) => r.resolved).length;
		log(`  ${a}: ${passed}/${own.length} resolved | pass rate ${((iso.passRates[a] ?? 0) * 100).toFixed(1)}%`);
	}
	log(`Iso-quality intersection: ${iso.resolvedTaskIds.length} task(s)`);
	for (const p of iso.perAgent) {
		log(`  ${p.agent}: iso tokens/resolved = ${p.tokensPerResolved.toFixed(0)}`);
	}
	if (iso.qualityGated) {
		log(`WARNING: pass-rate gap exceeds ${config.qualityBandPp}pp band — headline number is quality-gated.`);
	}
	log(`Combined report: ${reportPath}`);
}

main().catch((err) => {
	console.error("Fatal:", err);
	process.exit(1);
});
