/**
 * Live A/B Benchmark (Tier 3)
 *
 * Runs identical coding tasks with cave mode OFF vs ON,
 * compares token usage AND task success.
 *
 * Requires ANTHROPIC_API_KEY (or another provider key) to run.
 * Estimated cost: ~$0.60-$2.40 per full suite run.
 *
 * Run: ANTHROPIC_API_KEY=sk-... npx vitest run test/benchmarks/live-ab.bench.ts
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, describe, it, expect } from "vitest";
import { type ABResult, type TaskResult, formatABResults } from "./live-ab-report.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const TASKS_DIR = join(__dirname, "tasks");

// ============================================================================
// Gate: skip if no API key
// ============================================================================

const HAS_API_KEY = !!(
	process.env.ANTHROPIC_API_KEY ||
	process.env.OPENAI_API_KEY ||
	process.env.GOOGLE_API_KEY
);

// ============================================================================
// Helpers
// ============================================================================

interface TaskConfig {
	id: string;
	name: string;
	dir: string;
	prompt: string;
	hasSetup: boolean;
}

function discoverTasks(): TaskConfig[] {
	if (!existsSync(TASKS_DIR)) return [];

	return readdirSync(TASKS_DIR)
		.filter((d) => d.startsWith("t"))
		.sort()
		.map((dir) => {
			const fullDir = join(TASKS_DIR, dir);
			const promptPath = join(fullDir, "prompt.txt");
			if (!existsSync(promptPath)) return null;

			return {
				id: dir,
				name: dir.replace(/^t\d+-/, ""),
				dir: fullDir,
				prompt: readFileSync(promptPath, "utf-8").trim(),
				hasSetup: existsSync(join(fullDir, "setup")),
			};
		})
		.filter(Boolean) as TaskConfig[];
}

function createTempDir(taskId: string): string {
	const dir = join(tmpdir(), `cave-bench-${taskId}-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function setupTask(task: TaskConfig, tempDir: string): void {
	if (task.hasSetup) {
		const setupDir = join(task.dir, "setup");
		cpSync(setupDir, tempDir, { recursive: true });
	}
}

function verifyTask(task: TaskConfig, tempDir: string): boolean {
	const verifyScript = join(task.dir, "verify.sh");
	if (!existsSync(verifyScript)) return true; // No verify = assume pass

	try {
		execSync(`bash "${verifyScript}"`, { cwd: tempDir, timeout: 10000, stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}

function runAgent(
	prompt: string,
	cwd: string,
	caveMode: boolean,
): { tokens: TaskResult["tokens"]; cost: number; turns: number; durationMs: number } {
	const start = Date.now();

	// Build cave CLI command
	// Use print mode (-p) for single-shot execution
	// Use --output json to capture events including usage data
	const caveCmd = process.env.CAVE_BIN ?? "cave";
	const args = [
		caveCmd,
		"-p",
		JSON.stringify(prompt),
		"--output", "json",
	];

	if (caveMode) {
		args.push("--cave-mode", "full");
	}

	const env: Record<string, string> = {
		...process.env as Record<string, string>,
		// Prevent interactive prompts
		CI: "1",
	};

	try {
		const result = execSync(args.join(" "), {
			cwd,
			timeout: 120000, // 2 min per task
			env,
			stdio: ["pipe", "pipe", "pipe"],
			maxBuffer: 10 * 1024 * 1024, // 10MB
		});

		const output = result.toString("utf-8");
		const durationMs = Date.now() - start;

		// Parse JSON events from output to extract usage
		let totalInput = 0;
		let totalOutput = 0;
		let totalCacheRead = 0;
		let totalCacheWrite = 0;
		let totalCost = 0;
		let turns = 0;

		for (const line of output.split("\n")) {
			if (!line.trim()) continue;
			try {
				const event = JSON.parse(line);
				if (event.type === "message_end" && event.message?.role === "assistant") {
					turns++;
					const usage = event.message.usage;
					if (usage) {
						totalInput += usage.input ?? 0;
						totalOutput += usage.output ?? 0;
						totalCacheRead += usage.cacheRead ?? 0;
						totalCacheWrite += usage.cacheWrite ?? 0;
						totalCost += usage.cost?.total ?? 0;
					}
				}
			} catch {
				// Not JSON, skip
			}
		}

		return {
			tokens: {
				input: totalInput,
				output: totalOutput,
				cacheRead: totalCacheRead,
				cacheWrite: totalCacheWrite,
				total: totalInput + totalOutput,
			},
			cost: totalCost,
			turns,
			durationMs,
		};
	} catch (error) {
		const durationMs = Date.now() - start;
		return {
			tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			cost: 0,
			turns: 0,
			durationMs,
		};
	}
}

// ============================================================================
// Tests
// ============================================================================

const tasks = discoverTasks();
const results: ABResult[] = [];

describe.skipIf(!HAS_API_KEY)("Live A/B Benchmark", () => {
	for (const task of tasks) {
		describe(task.id, () => {
			let offResult: TaskResult;
			let onResult: TaskResult;

			it(`runs with cave mode OFF`, { timeout: 180000 }, () => {
				const tempDir = createTempDir(`${task.id}-off`);
				try {
					setupTask(task, tempDir);
					const run = runAgent(task.prompt, tempDir, false);
					const success = verifyTask(task, tempDir);

					offResult = {
						taskId: task.id,
						taskName: task.name,
						caveMode: { enabled: false },
						success,
						turns: run.turns,
						tokens: run.tokens,
						cost: run.cost,
						durationMs: run.durationMs,
					};
				} finally {
					rmSync(tempDir, { recursive: true, force: true });
				}
			});

			it(`runs with cave mode ON (full)`, { timeout: 180000 }, () => {
				const tempDir = createTempDir(`${task.id}-on`);
				try {
					setupTask(task, tempDir);
					const run = runAgent(task.prompt, tempDir, true);
					const success = verifyTask(task, tempDir);

					onResult = {
						taskId: task.id,
						taskName: task.name,
						caveMode: { enabled: true, intensity: "full" },
						success,
						turns: run.turns,
						tokens: run.tokens,
						cost: run.cost,
						durationMs: run.durationMs,
					};
				} finally {
					rmSync(tempDir, { recursive: true, force: true });
				}
			});

			it("collects A/B comparison", () => {
				if (!offResult || !onResult) return;

				const tokenSavingsPercent =
					offResult.tokens.total > 0
						? ((offResult.tokens.total - onResult.tokens.total) / offResult.tokens.total) * 100
						: 0;

				const costSavingsPercent =
					offResult.cost > 0 ? ((offResult.cost - onResult.cost) / offResult.cost) * 100 : 0;

				let qualityDelta = 0;
				if (offResult.success && !onResult.success) qualityDelta = -1;
				if (!offResult.success && onResult.success) qualityDelta = 1;

				results.push({
					taskId: task.id,
					taskName: task.name,
					off: offResult,
					on: onResult,
					tokenSavingsPercent,
					costSavingsPercent,
					qualityDelta,
				});
			});
		});
	}
});

describe.skipIf(HAS_API_KEY)("Live A/B Benchmark (skipped)", () => {
	it("skipped — set ANTHROPIC_API_KEY to run live benchmarks", () => {
		console.log("  Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY to run live A/B benchmarks.");
	});
});

// ============================================================================
// Report
// ============================================================================

afterAll(() => {
	if (results.length === 0) return;
	console.log("\n" + formatABResults(results) + "\n");
});
