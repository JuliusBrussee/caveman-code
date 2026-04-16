#!/usr/bin/env npx tsx
/**
 * MicroBench runner for Cave CLI.
 *
 * Runs small, self-contained coding tasks through the Cave SDK and verifies
 * results via verify.sh scripts. Much faster and cheaper than SWE-bench.
 *
 * Usage:
 *   npx tsx research/evals/run-microbench.ts [options]
 *
 * Options:
 *   --limit <n>            Max tasks to run (default: all)
 *   --difficulty <level>   Filter: easy, medium, hard
 *   --language <lang>      Filter: python, typescript
 *   --cap <dollars>        Per-task cost cap (default: $0.50, env: CAVE_BENCH_INSTANCE_CAP_DOLLARS)
 *   --output <path>        Output dir (default: research/results)
 *   --provider <name>      LLM provider (default: openai-codex)
 *   --model <pattern>      Model pattern (default: gpt-5.4)
 *   --thinking <level>     Thinking level (default: high)
 *   --dry-run              List tasks without running
 */

import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
	loadMicroBenchTasks,
	type MicroBenchInstance,
} from "../../packages/agent/src/bench/microbench-dataset.js";
import {
	runBench,
	aggregateBench,
} from "../../packages/agent/src/bench/index.js";
import type { ThinkingLevel } from "../../packages/agent/src/index.js";
import { getModel } from "../../packages/ai/src/models.js";
import {
	createAgentSession,
} from "../../packages/coding-agent/src/core/sdk.js";
import { SessionManager } from "../../packages/coding-agent/src/core/session-manager.js";
import { SettingsManager } from "../../packages/coding-agent/src/core/settings-manager.js";

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

interface RunConfig {
	limit?: number;
	difficulty?: string;
	language?: string;
	capDollars: number;
	outputDir: string;
	provider: string;
	model: string;
	thinking: string;
	dryRun: boolean;
}

function parseRunArgs(): RunConfig {
	const args = process.argv.slice(2);
	const config: RunConfig = {
		capDollars: Number(process.env.CAVE_BENCH_INSTANCE_CAP_DOLLARS) || 0.5,
		outputDir: resolve("research/results"),
		provider: "openai-codex",
		model: "gpt-5.4",
		thinking: "high",
		dryRun: false,
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		switch (arg) {
			case "--limit":
				config.limit = Number(args[++i]);
				break;
			case "--difficulty":
				config.difficulty = args[++i];
				break;
			case "--language":
				config.language = args[++i];
				break;
			case "--cap":
				config.capDollars = Number(args[++i]);
				break;
			case "--output":
				config.outputDir = resolve(args[++i]);
				break;
			case "--provider":
				config.provider = args[++i];
				break;
			case "--model":
				config.model = args[++i];
				break;
			case "--thinking":
				config.thinking = args[++i];
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

// ---------------------------------------------------------------------------
// Task setup
// ---------------------------------------------------------------------------

function copySetupFiles(instance: MicroBenchInstance, workDir: string): void {
	if (instance.setupDir) {
		cpSync(instance.setupDir, workDir, { recursive: true });
	}
}

function verifyTask(instance: MicroBenchInstance, workDir: string): boolean {
	try {
		execSync(`bash "${instance.verifyScript}"`, {
			cwd: workDir,
			timeout: 30_000,
			stdio: "pipe",
		});
		return true;
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// MicroBench prompt
// ---------------------------------------------------------------------------

const MICROBENCH_SYSTEM_ADDENDUM = [
	"You are solving a small coding task. You MUST use tools:",
	"1. Use `read` and `grep` to explore the working directory",
	"2. Use `edit` or `write` to apply changes to files",
	"3. Use `bash` to run tests or check your work",
	"Make minimal, targeted changes. Do not add extra features.",
].join("\n");

// ---------------------------------------------------------------------------
// Run cave session on a single task
// ---------------------------------------------------------------------------

interface TaskResult {
	durationMs: number;
	cost: number;
	toolCalls: number;
	tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
	error?: string;
}

async function runCaveOnTask(
	instance: MicroBenchInstance,
	workDir: string,
	config: RunConfig,
): Promise<TaskResult> {
	const start = Date.now();

	try {
		const model = getModel(config.provider as any, config.model as any);
		if (!model) {
			throw new Error(`Model not found: ${config.provider}/${config.model}`);
		}

		const settingsManager = SettingsManager.create(workDir);
		settingsManager.setCaveModeEnabled(true);
		settingsManager.setCaveModeIntensity("ultra");
		settingsManager.setCaveModeToolCompression(true);
		settingsManager.setCaveModeMLCompression(true);

		const { session } = await createAgentSession({
			cwd: workDir,
			model,
			thinkingLevel: config.thinking as ThinkingLevel,
			settingsManager,
			sessionManager: SessionManager.inMemory(workDir),
		});

		await new Promise((r) => setTimeout(r, 100));

		const basePrompt = session.systemPrompt;
		session.agent.state.systemPrompt = `${basePrompt}\n\n${MICROBENCH_SYSTEM_ADDENDUM}`;

		let toolCallCount = 0;
		session.subscribe((event) => {
			if ("type" in event && event.type === "tool_call_start") {
				toolCallCount++;
			}
		});

		log("  Running agent...");
		await session.prompt(instance.problem_statement, { expandPromptTemplates: false });

		const stats = session.getSessionStats();

		return {
			durationMs: Date.now() - start,
			cost: stats.cost,
			toolCalls: stats.toolCalls,
			tokens: {
				input: stats.tokens.input,
				output: stats.tokens.output,
				cacheRead: stats.tokens.cacheRead,
				cacheWrite: stats.tokens.cacheWrite,
			},
		};
	} catch (error) {
		return {
			durationMs: Date.now() - start,
			cost: 0,
			toolCalls: 0,
			tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			error: error instanceof Error ? error.message : String(error),
		};
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
	const config = parseRunArgs();
	const tasksDir = resolve("research/evals/microbench/tasks");

	log("=== MicroBench Runner for Cave CLI ===");
	log(`Provider: ${config.provider} | Model: ${config.model} | Thinking: ${config.thinking} | Cap: $${config.capDollars}/task`);

	const instances = loadMicroBenchTasks(tasksDir, {
		difficulty: config.difficulty,
		language: config.language,
		limit: config.limit,
	});

	log(`Loaded ${instances.length} tasks`);

	if (config.dryRun) {
		log("DRY RUN — tasks:");
		for (const inst of instances) {
			console.log(`  ${inst.id} [${inst.meta.difficulty}] [${inst.meta.language}] — ${inst.problem_statement.slice(0, 80)}...`);
		}
		process.exit(0);
	}

	mkdirSync(config.outputDir, { recursive: true });
	const date = new Date().toISOString().slice(0, 10);
	const predictionsPath = join(config.outputDir, "microbench-predictions.jsonl");
	const resultsPath = join(config.outputDir, `microbench-${date}.json`);
	const tracesDir = join(config.outputDir, "traces");
	mkdirSync(tracesDir, { recursive: true });

	writeFileSync(predictionsPath, "");

	const modelLabel = `cave:${config.provider}:${config.model}:${config.thinking}`;

	log("Starting benchmark run...");
	log("");

	let totalCost = 0;
	const results = await runBench(instances, {
		perInstanceCapDollars: config.capDollars,
		runInstance: async (instance) => {
			const microInstance = instance as MicroBenchInstance;
			const idx = instances.indexOf(microInstance) + 1;
			log(`[${idx}/${instances.length}] ${microInstance.id} [${microInstance.meta.difficulty}]`);

			const workDir = join(tmpdir(), `cave-micro-${microInstance.id}-${Date.now()}`);
			mkdirSync(workDir, { recursive: true });

			try {
				copySetupFiles(microInstance, workDir);

				const result = await runCaveOnTask(microInstance, workDir, config);
				totalCost += result.cost;

				const resolved = !result.error && verifyTask(microInstance, workDir);

				// Write prediction
				appendFileSync(predictionsPath, JSON.stringify({
					instance_id: microInstance.id,
					model_name_or_path: modelLabel,
					resolved,
					difficulty: microInstance.meta.difficulty,
					language: microInstance.meta.language,
				}) + "\n");

				// Save trace
				const traceFile = join(tracesDir, `${microInstance.id}.json`);
				writeFileSync(traceFile, JSON.stringify({
					instance_id: microInstance.id,
					difficulty: microInstance.meta.difficulty,
					language: microInstance.meta.language,
					duration_ms: result.durationMs,
					cost: result.cost,
					tool_calls: result.toolCalls,
					tokens: result.tokens,
					error: result.error ?? null,
					resolved,
				}, null, 2));

				log(`  ${resolved ? "PASS" : "FAIL"} | ${(result.durationMs / 1000).toFixed(1)}s | $${result.cost.toFixed(4)} | ${result.toolCalls} tools${result.error ? ` | ERROR: ${result.error}` : ""}`);

				return {
					resolved,
					attempts: 1,
					dollarsSpent: result.cost,
					durationMs: result.durationMs,
					traces: [traceFile],
				};
			} finally {
				if (!process.env.CAVE_BENCH_KEEP_WORKDIRS) {
					try { rmSync(workDir, { recursive: true, force: true }); } catch {}
				} else {
					log(`  Keeping workdir: ${workDir}`);
				}
			}
		},
	});

	const agg = aggregateBench(results);

	// Collect per-instance token data for the results file
	const detailedResults = results.map((r, i) => ({
		...r,
		difficulty: instances[i].meta.difficulty,
		language: instances[i].meta.language,
		// Read tokens back from trace file
		tokens: (() => {
			try {
				const trace = JSON.parse(readFileSync(r.traces[0], "utf-8"));
				return trace.tokens;
			} catch {
				return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
			}
		})(),
	}));

	const report = {
		date,
		benchmark: "microbench" as const,
		model: modelLabel,
		config: {
			provider: config.provider,
			model: config.model,
			thinking: config.thinking,
			capDollars: config.capDollars,
			compression: "ultra+tool+ml",
		},
		aggregate: agg,
		results: detailedResults,
	};

	writeFileSync(resultsPath, JSON.stringify(report, null, 2));

	log("");
	log("=== Results ===");
	log(`Tasks: ${agg.total}`);
	log(`Passed: ${agg.resolved}/${agg.total} (${(agg.resolvedRate * 100).toFixed(1)}%)`);
	log(`Cost cap failures: ${agg.capFailures}`);
	log(`Total cost: $${totalCost.toFixed(2)}`);
	log("");
	log(`Results: ${resultsPath}`);
	log(`Traces:  ${tracesDir}/`);
}

main().catch((err) => {
	console.error("Fatal:", err);
	process.exit(1);
});
