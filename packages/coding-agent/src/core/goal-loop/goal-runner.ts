/**
 * Goal-loop driver. Spawns `cave -p --mode json` per iteration with the
 * iteration prompt on stdin, parses the JSON event stream, and updates state.
 *
 * Termination ranking (matches the design doc):
 *   1. completion sentinel in the iteration's last assistant text  → done
 *   2. iteration cap                                                → failed
 *   3. wall-clock cap                                               → failed
 *   4. $ cap (from ledger)                                          → failed
 *   5. consecutive no-progress iterations cap                       → paused
 *   6. SIGINT / cancel.json sentinel                                → cancelled
 */

import { type ChildProcessWithoutNullStreams, execSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveCurrentCaveInvocation } from "../../utils/cave-invocation.js";
import { buildIterPrompt, detectSentinel, extractSummaryTail } from "./goal-prompts.js";
import {
	acquireLock,
	appendTranscript,
	type GoalLedger,
	type GoalPaths,
	type GoalState,
	heartbeatLock,
	readGoalMd,
	readLedger,
	readState,
	readSummary,
	releaseLock,
	type TranscriptEntry,
	updateGoalFrontmatter,
	writeLedger,
	writeState,
	writeSummary,
} from "./goal-state.js";

export interface RunGoalOptions {
	cwd: string;
	id: string;
	paths: GoalPaths;
	caveCommand: string;
	caveArgsPrefix: string[];
	model?: string;
	verbose?: boolean;
	signal?: AbortSignal;
}

interface IterOutcome {
	exitCode: number;
	stopReason?: string;
	assistantText: string;
	rawOutput: string;
	usage: {
		usd: number;
		input: number;
		output: number;
		cacheCreate: number;
		cacheRead: number;
	};
}

const PROGRESS_NONE = "no-progress";
const ITERATION_GAP_MS = 2_000;

const captureRepoSignal = (cwd: string): string => {
	try {
		const status = execSync("git status --porcelain=v1", {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		const head = execSync("git rev-parse HEAD", {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		return createHash("sha1").update(`${head}\n${status}`).digest("hex");
	} catch {
		return "no-git";
	}
};

const formatUsd = (n: number): string => `$${n.toFixed(4)}`;

const writeIterOutput = (paths: GoalPaths, iter: number, payload: { stdout: string; assistant: string }): void => {
	const dir = join(paths.iterationsDir, String(iter));
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "stdout.jsonl"), payload.stdout);
	writeFileSync(join(dir, "assistant.txt"), payload.assistant);
};

const runIteration = (opts: RunGoalOptions, prompt: string, maxTurns: number, model?: string): Promise<IterOutcome> => {
	return new Promise((resolve) => {
		const args = [...opts.caveArgsPrefix, "-p", "--mode", "json", "--max-turns", String(maxTurns)];
		if (model) {
			args.push("--model", model);
		}
		// Pass goal id via env so child can mark sessions if it wants to.
		const env = { ...process.env, CAVE_GOAL_ID: opts.id };
		const child: ChildProcessWithoutNullStreams = spawn(opts.caveCommand, args, {
			cwd: opts.cwd,
			env,
			stdio: ["pipe", "pipe", "pipe"],
		});

		let stdout = "";
		let pending = "";
		let assistantText = "";
		let stopReason: string | undefined;
		const usage = { usd: 0, input: 0, output: 0, cacheCreate: 0, cacheRead: 0 };

		const onData = (chunk: Buffer) => {
			const text = chunk.toString("utf8");
			stdout += text;
			if (opts.verbose) {
				process.stdout.write(text);
			}
			pending += text;
			let nl = pending.indexOf("\n");
			while (nl >= 0) {
				const line = pending.slice(0, nl);
				pending = pending.slice(nl + 1);
				nl = pending.indexOf("\n");
				const trimmed = line.trim();
				if (!trimmed.startsWith("{")) continue;
				try {
					const evt = JSON.parse(trimmed) as Record<string, unknown>;
					const type = typeof evt.type === "string" ? evt.type : "";
					if (type === "message_end" || type === "turn_end") {
						const message = evt.message as Record<string, unknown> | undefined;
						if (message) {
							if (typeof message.stopReason === "string") {
								stopReason = message.stopReason;
							}
							const content = message.content as Array<Record<string, unknown>> | undefined;
							if (Array.isArray(content)) {
								for (const block of content) {
									if (block?.type === "text" && typeof block.text === "string") {
										assistantText = block.text;
									}
								}
							}
							const u = message.usage as Record<string, unknown> | undefined;
							if (u) {
								if (typeof u.inputTokens === "number") usage.input += u.inputTokens;
								if (typeof u.outputTokens === "number") usage.output += u.outputTokens;
								if (typeof u.cacheCreateInputTokens === "number") usage.cacheCreate += u.cacheCreateInputTokens;
								if (typeof u.cacheReadInputTokens === "number") usage.cacheRead += u.cacheReadInputTokens;
								if (typeof u.dollars === "number") usage.usd += u.dollars;
								if (typeof u.totalUsd === "number") usage.usd = u.totalUsd;
							}
						}
					}
				} catch {
					// ignore non-JSON or partial lines
				}
			}
		};

		child.stdout.on("data", onData);
		child.stderr.on("data", (chunk: Buffer) => {
			if (opts.verbose) process.stderr.write(chunk);
		});

		const onAbort = () => {
			child.kill("SIGTERM");
		};
		opts.signal?.addEventListener("abort", onAbort);

		child.on("close", (code) => {
			opts.signal?.removeEventListener("abort", onAbort);
			resolve({
				exitCode: code ?? 1,
				stopReason,
				assistantText,
				rawOutput: stdout,
				usage,
			});
		});

		child.stdin.end(prompt);
	});
};

const sleep = (ms: number, signal?: AbortSignal): Promise<void> => {
	return new Promise((resolve) => {
		const t = setTimeout(resolve, ms);
		signal?.addEventListener("abort", () => {
			clearTimeout(t);
			resolve();
		});
	});
};

export interface RunGoalResult {
	finalStatus: GoalState["status"];
	iterations: number;
	usd: number;
	reason: string;
}

export const runGoal = async (opts: RunGoalOptions): Promise<RunGoalResult> => {
	const { paths } = opts;
	const owner = `pid:${process.pid}`;
	const lockResult = acquireLock(paths, owner);
	if (!lockResult.ok) {
		throw new Error(
			`Goal ${opts.id} is already locked by pid ${lockResult.held.pid} on ${lockResult.held.host} (heartbeat ${lockResult.held.heartbeat_at}). Wait or steal after ${Math.floor(5)}min idle.`,
		);
	}

	const state: GoalState =
		readState(paths) ??
		({
			iteration: 0,
			last_progress_iteration: 0,
			started_at: new Date().toISOString(),
			last_heartbeat: new Date().toISOString(),
			status: "running",
		} satisfies GoalState);
	state.status = "running";
	writeState(paths, state);

	const finish = (status: GoalState["status"], reason: string, ledger: GoalLedger): RunGoalResult => {
		state.status = status;
		state.finished_at = new Date().toISOString();
		state.failure_reason = status === "done" ? undefined : reason;
		writeState(paths, state);
		updateGoalFrontmatter(paths.goalMd, { status });
		releaseLock(paths);
		return { finalStatus: status, iterations: state.iteration, usd: ledger.usd, reason };
	};

	let lastSignal = captureRepoSignal(opts.cwd);
	let consecutiveNoProgress = 0;

	while (true) {
		if (opts.signal?.aborted) {
			const ledger = readLedger(paths);
			return finish("cancelled", "aborted by user", ledger);
		}

		const { frontmatter, body: goalBody } = readGoalMd(paths.goalMd);

		// Re-check caps each iter from frontmatter (user may have edited GOAL.md).
		const ledger = readLedger(paths);
		const wallClockHours = (Date.now() - new Date(state.started_at).getTime()) / (1000 * 60 * 60);

		if (state.iteration >= frontmatter.max_iterations) {
			return finish("failed", `iteration cap reached (${frontmatter.max_iterations})`, ledger);
		}
		if (wallClockHours >= frontmatter.max_wall_clock_h) {
			return finish("failed", `wall-clock cap reached (${frontmatter.max_wall_clock_h}h)`, ledger);
		}
		if (ledger.usd >= frontmatter.max_usd) {
			return finish(
				"failed",
				`budget cap reached (${formatUsd(ledger.usd)} >= ${formatUsd(frontmatter.max_usd)})`,
				ledger,
			);
		}
		if (consecutiveNoProgress >= frontmatter.max_no_progress) {
			return finish(
				"paused",
				`no progress for ${consecutiveNoProgress} iterations — run \`cave goal resume ${opts.id} --force\` to continue`,
				ledger,
			);
		}

		// Heartbeat lock so other instances see we're alive.
		heartbeatLock(paths, owner);

		const iterNum = state.iteration + 1;
		const prompt = buildIterPrompt({
			goalBody,
			summary: readSummary(paths),
			iteration: iterNum,
			maxIterations: frontmatter.max_iterations,
			sentinel: frontmatter.completion_sentinel,
		});

		const iterStart = new Date().toISOString();
		if (opts.verbose) {
			process.stderr.write(
				`\n──── goal=${opts.id} iter ${iterNum}/${frontmatter.max_iterations}  spend=${formatUsd(ledger.usd)}/${formatUsd(frontmatter.max_usd)} ────\n`,
			);
		}

		const outcome = await runIteration(opts, prompt, 50, opts.model ?? frontmatter.model);
		const iterEnd = new Date().toISOString();

		writeIterOutput(paths, iterNum, { stdout: outcome.rawOutput, assistant: outcome.assistantText });

		const sentinelSeen = detectSentinel(outcome.assistantText, frontmatter.completion_sentinel);

		// Update ledger.
		const newLedger: GoalLedger = {
			usd: ledger.usd + outcome.usage.usd,
			input_tokens: ledger.input_tokens + outcome.usage.input,
			output_tokens: ledger.output_tokens + outcome.usage.output,
			cache_create_tokens: ledger.cache_create_tokens + outcome.usage.cacheCreate,
			cache_read_tokens: ledger.cache_read_tokens + outcome.usage.cacheRead,
			iterations: ledger.iterations + 1,
			last_iter_usd: outcome.usage.usd,
		};
		writeLedger(paths, newLedger);

		// Detect progress: repo signal change OR new output (lower-quality fallback).
		const newSignal = captureRepoSignal(opts.cwd);
		const progressSignals: string[] = [];
		if (newSignal !== lastSignal) progressSignals.push("repo-changed");
		if (sentinelSeen) progressSignals.push("sentinel");
		if (progressSignals.length > 0) {
			state.last_progress_iteration = iterNum;
			state.last_progress_signal = progressSignals.join("+");
			consecutiveNoProgress = 0;
		} else {
			progressSignals.push(PROGRESS_NONE);
			consecutiveNoProgress += 1;
		}
		lastSignal = newSignal;

		// Update rolling summary from tail of assistant text.
		writeSummary(paths, extractSummaryTail(outcome.assistantText));

		const transcript: TranscriptEntry = {
			iter: iterNum,
			started_at: iterStart,
			ended_at: iterEnd,
			exit_code: outcome.exitCode,
			stop_reason: outcome.stopReason,
			sentinel_seen: sentinelSeen,
			usd: outcome.usage.usd,
			input_tokens: outcome.usage.input,
			output_tokens: outcome.usage.output,
			progress_signals: progressSignals,
			last_assistant_excerpt: extractSummaryTail(outcome.assistantText, 400),
		};
		appendTranscript(paths, transcript);

		state.iteration = iterNum;
		state.last_heartbeat = new Date().toISOString();
		writeState(paths, state);

		if (sentinelSeen) {
			return finish("done", `sentinel emitted at iter ${iterNum}`, newLedger);
		}

		if (outcome.exitCode !== 0 && opts.verbose) {
			process.stderr.write(`iter ${iterNum} child exited code=${outcome.exitCode} — continuing\n`);
		}

		await sleep(ITERATION_GAP_MS, opts.signal);
	}
};

export const resolveGoalInvocation = (): { caveCommand: string; caveArgsPrefix: string[] } => {
	const invocation = resolveCurrentCaveInvocation();
	return {
		caveCommand: invocation.command,
		caveArgsPrefix: invocation.argsPrefix,
	};
};
