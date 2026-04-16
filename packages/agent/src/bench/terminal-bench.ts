// Terminal-Bench harness wrapper.
//
// Spawns `tb run --agent <a> --task-id <id> --output-path <dir>` per
// (agent × task), parses the resulting results.json into AgentRunRecord, and
// enforces wall-time + cost caps. Codex CLI and Claude Code adapters ship with
// TB; the cave adapter lives at research/evals/terminal-bench/cave-tb-agent/.

import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentRunRecord, AgentRunTokens } from "./agent-run-record.js";

export interface TerminalBenchInstance {
	id: string;
}

export interface RunTbInstanceOptions {
	agent: "cave" | "codex" | "claude-code";
	taskId: string;
	outputDir: string;
	/** Path to the terminal-bench virtualenv binary (e.g. `.venv/bin/tb`). */
	tbBinary: string;
	/** Hard wall-time cap; on expiry the process tree is killed. */
	capWallSeconds: number;
	/** Optional --agent-kwarg pairs (e.g. model=gpt-5.4). */
	agentKwargs?: Record<string, string>;
	/** Path to the local cave-tb-agent package for --agent-import-path. */
	caveAgentImportPath?: string;
	/** Extra env vars merged onto process.env (auth tokens, API keys). */
	env?: Record<string, string>;
}

export interface RunTbInstanceResult {
	record: AgentRunRecord;
	resultsJsonPath?: string;
	rawStdout: string;
	rawStderr: string;
}

/**
 * Load TB task IDs from a newline-separated file. Lines starting with `#` and
 * blank lines are ignored.
 */
export function loadTbTaskIds(filePath: string): TerminalBenchInstance[] {
	if (!existsSync(filePath)) {
		throw new Error(`Terminal-Bench task list not found: ${filePath}`);
	}
	const lines = readFileSync(filePath, "utf-8").split("\n");
	const ids: TerminalBenchInstance[] = [];
	for (const raw of lines) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		ids.push({ id: line });
	}
	return ids;
}

/**
 * Spawn a single `tb run` invocation, kill its tree on timeout, then parse the
 * agent's results.json into an AgentRunRecord.
 */
export function runTbInstance(opts: RunTbInstanceOptions): Promise<RunTbInstanceResult> {
	return new Promise((resolveP) => {
		const args: string[] = [
			"run",
			"--task-id",
			opts.taskId,
			"--output-path",
			opts.outputDir,
			"--global-timeout-sec",
			String(opts.capWallSeconds),
			"--agent-timeout-sec",
			String(Math.max(60, opts.capWallSeconds - 60)),
		];

		if (opts.agent === "cave" && opts.caveAgentImportPath) {
			args.push("--agent-import-path", opts.caveAgentImportPath);
		} else {
			args.push("--agent", opts.agent === "claude-code" ? "claude-code" : opts.agent);
		}
		for (const [k, v] of Object.entries(opts.agentKwargs ?? {})) {
			args.push("--agent-kwarg", `${k}=${v}`);
		}

		const start = Date.now();
		const child = spawn(opts.tbBinary, args, {
			cwd: process.cwd(),
			env: { ...process.env, ...(opts.env ?? {}) },
			stdio: ["pipe", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (d) => {
			stdout += d.toString("utf-8");
		});
		child.stderr?.on("data", (d) => {
			stderr += d.toString("utf-8");
		});

		// Kill the whole tree on hard cap (1.1x TB-level cap to give TB its own
		// chance to clean up first).
		const hardCapMs = Math.ceil(opts.capWallSeconds * 1100);
		const timer = setTimeout(() => {
			try {
				if (child.pid) process.kill(-child.pid, "SIGKILL");
				else child.kill("SIGKILL");
			} catch {
				try {
					child.kill("SIGKILL");
				} catch {}
			}
		}, hardCapMs);

		child.on("close", (code) => {
			clearTimeout(timer);
			const wallTimeMs = Date.now() - start;
			const parsed = parseResultsJson(opts.outputDir, opts.taskId);
			const record: AgentRunRecord = {
				agent: opts.agent,
				taskId: opts.taskId,
				resolved: parsed?.resolved ?? false,
				tokens: parsed?.tokens ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				tokensVerifiedBy: "cli-event",
				qualityGated: false,
				dollars: parsed?.dollars,
				wallTimeMs,
				turns: parsed?.turns ?? 0,
				costCapFailure: code !== 0 && wallTimeMs >= hardCapMs - 500 ? true : undefined,
				notes: parsed ? undefined : `tb exit=${code}; results.json not parsed`,
			};
			resolveP({
				record,
				resultsJsonPath: parsed?.path,
				rawStdout: stdout,
				rawStderr: stderr,
			});
		});
	});
}

interface ParsedResults {
	path: string;
	resolved: boolean;
	tokens: AgentRunTokens;
	dollars?: number;
	turns?: number;
}

/**
 * TB writes results to `<outputDir>/<run-name>/<task-id>/results.json`. We
 * walk the output dir and pick the file whose path includes the task id.
 */
function parseResultsJson(outputDir: string, taskId: string): ParsedResults | undefined {
	const candidate = findResultsJson(outputDir, taskId);
	if (!candidate) return undefined;
	try {
		const json = JSON.parse(readFileSync(candidate, "utf-8"));
		return {
			path: candidate,
			resolved: extractResolved(json),
			tokens: extractTokens(json),
			dollars: extractDollars(json),
			turns: extractTurns(json),
		};
	} catch {
		return undefined;
	}
}

function findResultsJson(root: string, taskId: string): string | undefined {
	if (!existsSync(root)) return undefined;
	const stack: string[] = [root];
	while (stack.length > 0) {
		const cur = stack.pop()!;
		let entries: { name: string; isDirectory: () => boolean }[];
		try {
			entries = readdirSync(cur, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const e of entries) {
			const full = join(cur, e.name);
			if (e.isDirectory()) {
				stack.push(full);
			} else if (e.name === "results.json" && full.includes(taskId)) {
				return full;
			}
		}
	}
	return undefined;
}

function extractResolved(json: unknown): boolean {
	if (!json || typeof json !== "object") return false;
	const j = json as Record<string, unknown>;
	if (typeof j.resolved === "boolean") return j.resolved;
	if (typeof j.is_resolved === "boolean") return j.is_resolved;
	if (typeof j.passed === "boolean") return j.passed;
	if (typeof j.success === "boolean") return j.success;
	const reward = j.reward;
	if (typeof reward === "number") return reward > 0;
	const verdict = j.verdict;
	if (typeof verdict === "string") return verdict.toLowerCase() === "pass";
	return false;
}

function extractTokens(json: unknown): AgentRunTokens {
	const empty: AgentRunTokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
	if (!json || typeof json !== "object") return empty;
	const j = json as Record<string, unknown>;
	const usage = (j.usage ?? j.tokens ?? j.token_usage) as Record<string, unknown> | undefined;
	if (!usage) return empty;
	const get = (...keys: string[]): number => {
		for (const k of keys) {
			const v = usage[k];
			if (typeof v === "number") return v;
		}
		return 0;
	};
	return {
		input: get("input", "input_tokens", "prompt_tokens"),
		output: get("output", "output_tokens", "completion_tokens"),
		cacheRead: get("cache_read", "cache_read_input_tokens", "cacheRead"),
		cacheWrite: get("cache_write", "cache_creation_input_tokens", "cacheWrite"),
	};
}

function extractDollars(json: unknown): number | undefined {
	if (!json || typeof json !== "object") return undefined;
	const j = json as Record<string, unknown>;
	const candidates = [j.cost, j.dollars, j.total_cost, j.usd];
	for (const c of candidates) {
		if (typeof c === "number") return c;
	}
	return undefined;
}

function extractTurns(json: unknown): number | undefined {
	if (!json || typeof json !== "object") return undefined;
	const j = json as Record<string, unknown>;
	const candidates = [j.turns, j.num_turns, j.steps, j.n_steps];
	for (const c of candidates) {
		if (typeof c === "number") return c;
	}
	return undefined;
}
