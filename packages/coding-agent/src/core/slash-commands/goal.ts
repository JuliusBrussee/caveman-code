/**
 * `/goal` slash command for interactive mode.
 *
 * Starts and manages durable autonomous goal loops, but launches the actual
 * driver in background so the current TUI session stays usable.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import {
	DEFAULT_COMPLETION_SENTINEL,
	DEFAULT_MAX_ITERATIONS,
	DEFAULT_MAX_NO_PROGRESS,
	DEFAULT_MAX_USD,
	DEFAULT_MAX_WALL_CLOCK_HOURS,
	type GoalFrontmatter,
	type GoalState,
	goalPaths,
	listGoals,
	newGoalId,
	parseGoalIdArg,
	readGoalMd,
	readLedger,
	readState,
	updateGoalFrontmatter,
	writeGoalMd,
	writeState,
} from "../goal-loop/goal-state.js";

export interface GoalSlashCommandIO {
	cwd: string;
	spawnDriver: (id: string) => void;
}

export interface GoalSlashCommandResult {
	exitCode: number;
	output: string;
}

interface StartFlags {
	text?: string;
	maxIterations: number;
	maxWallClockH: number;
	maxUsd: number;
	maxNoProgress: number;
	sentinel: string;
	model?: string;
	quiet: boolean;
}

const HELP_TEXT = `Goal loop commands:

  /goal <text>
  /goal start <text> [--max-iterations N] [--max-wall-clock-h H] [--max-usd D]
                    [--max-no-progress N] [--sentinel S] [--model M] [--quiet]
  /goal resume [<id>] [--force]
  /goal status [<id>]
  /goal cancel [<id>]
  /goal list

State lives in <cwd>/.cave/goal/<id>/.
Interactive mode launches driver in background so this session stays usable.`;

const SUBCOMMANDS = new Set(["start", "resume", "status", "cancel", "list", "help", "--help", "-h"]);

function tokenizeArgs(input: string): string[] {
	const tokens: string[] = [];
	const re = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|(\S+)/g;
	for (const match of input.matchAll(re)) {
		const quotedDouble = match[1];
		const quotedSingle = match[2];
		const bare = match[3];
		const token = quotedDouble ?? quotedSingle ?? bare;
		if (!token) continue;
		tokens.push(token.replace(/\\([\\"'])/g, "$1"));
	}
	return tokens;
}

function parseStartFlags(rest: string[]): StartFlags {
	const flags: StartFlags = {
		maxIterations: DEFAULT_MAX_ITERATIONS,
		maxWallClockH: DEFAULT_MAX_WALL_CLOCK_HOURS,
		maxUsd: DEFAULT_MAX_USD,
		maxNoProgress: DEFAULT_MAX_NO_PROGRESS,
		sentinel: DEFAULT_COMPLETION_SENTINEL,
		quiet: false,
	};
	const positional: string[] = [];

	for (let i = 0; i < rest.length; i++) {
		const arg = rest[i];
		switch (arg) {
			case "--max-iterations":
				flags.maxIterations = Number.parseInt(rest[++i] ?? "", 10);
				break;
			case "--max-wall-clock-h":
				flags.maxWallClockH = Number.parseFloat(rest[++i] ?? "");
				break;
			case "--max-usd":
				flags.maxUsd = Number.parseFloat(rest[++i] ?? "");
				break;
			case "--max-no-progress":
				flags.maxNoProgress = Number.parseInt(rest[++i] ?? "", 10);
				break;
			case "--sentinel":
				flags.sentinel = rest[++i] ?? "";
				break;
			case "--model":
				flags.model = rest[++i];
				break;
			case "--quiet":
				flags.quiet = true;
				break;
			default:
				if (arg?.startsWith("--")) {
					throw new Error(`Unknown flag: ${arg}`);
				}
				if (arg) positional.push(arg);
		}
	}

	flags.text = positional.join(" ").trim() || undefined;
	return flags;
}

function validateStartFlags(flags: StartFlags): string | undefined {
	if (!flags.text) {
		return "Goal text required. Example: /goal add unit tests for goal slash command";
	}
	if (!Number.isFinite(flags.maxIterations) || flags.maxIterations < 1) {
		return "--max-iterations must be >= 1";
	}
	if (!Number.isFinite(flags.maxWallClockH) || flags.maxWallClockH <= 0) {
		return "--max-wall-clock-h must be > 0";
	}
	if (!Number.isFinite(flags.maxUsd) || flags.maxUsd <= 0) {
		return "--max-usd must be > 0";
	}
	if (!Number.isFinite(flags.maxNoProgress) || flags.maxNoProgress < 1) {
		return "--max-no-progress must be >= 1";
	}
	if (!flags.sentinel.trim()) {
		return "--sentinel must not be blank";
	}
	return undefined;
}

function formatGoalStatus(cwd: string, id: string): GoalSlashCommandResult {
	const paths = goalPaths(cwd, id);
	if (!existsSync(paths.goalMd)) {
		return { exitCode: 1, output: `Goal ${id} not found at ${paths.goalMd}` };
	}

	const { frontmatter, body } = readGoalMd(paths.goalMd);
	const state = readState(paths);
	const ledger = readLedger(paths);
	const lines = [
		`Goal ${id}`,
		`Path: ${paths.root}`,
		`Status: ${state?.status ?? frontmatter.status}`,
		`Iterations: ${state?.iteration ?? 0}/${frontmatter.max_iterations}`,
		`Spend: $${ledger.usd.toFixed(4)}/$${frontmatter.max_usd.toFixed(4)}`,
		`Sentinel: ${frontmatter.completion_sentinel}`,
		"",
		"Goal:",
		body.trim() || "(empty)",
	];

	if (state?.failure_reason) {
		lines.push("", `Reason: ${state.failure_reason}`);
	}

	if (existsSync(paths.transcriptJsonl)) {
		const raw = readFileSync(paths.transcriptJsonl, "utf8").trim();
		if (raw) {
			const entries = raw
				.split(/\r?\n/)
				.slice(-5)
				.map((line) => {
					try {
						return JSON.parse(line) as {
							iter: number;
							exit_code: number;
							usd?: number;
							progress_signals?: string[];
							sentinel_seen?: boolean;
						};
					} catch {
						return undefined;
					}
				})
				.filter(Boolean);
			if (entries.length > 0) {
				lines.push("", "Recent iterations:");
				for (const entry of entries) {
					lines.push(
						`  iter ${entry!.iter}  exit=${entry!.exit_code}  $${(entry!.usd ?? 0).toFixed(4)}  ${(entry!.progress_signals ?? []).join(",") || "none"}  sentinel=${entry!.sentinel_seen ? "yes" : "no"}`,
					);
				}
			}
		}
	}

	return { exitCode: 0, output: lines.join("\n") };
}

function formatGoalList(cwd: string): GoalSlashCommandResult {
	const goals = listGoals(cwd);
	if (goals.length === 0) {
		return { exitCode: 0, output: "No goals in this project." };
	}

	const lines = ["Goals:"];
	for (const goal of goals) {
		const paths = goalPaths(cwd, goal.id);
		const state = readState(paths);
		const ledger = readLedger(paths);
		lines.push(
			`  ${goal.frontmatter.status.padEnd(9)} ${goal.id}  iter=${state?.iteration ?? 0}/${goal.frontmatter.max_iterations}  $${ledger.usd.toFixed(2)}`,
		);
	}
	return { exitCode: 0, output: lines.join("\n") };
}

function startGoal(rest: string[], io: GoalSlashCommandIO): GoalSlashCommandResult {
	let flags: StartFlags;
	try {
		flags = parseStartFlags(rest);
	} catch (error) {
		return { exitCode: 1, output: error instanceof Error ? error.message : String(error) };
	}

	const validationError = validateStartFlags(flags);
	if (validationError) {
		return { exitCode: 1, output: `${validationError}\n\n${HELP_TEXT}` };
	}

	const id = newGoalId();
	const paths = goalPaths(io.cwd, id);
	mkdirSync(paths.root, { recursive: true });

	const startedAt = new Date().toISOString();
	const frontmatter: GoalFrontmatter = {
		id,
		started_at: startedAt,
		max_iterations: flags.maxIterations,
		max_wall_clock_h: flags.maxWallClockH,
		max_usd: flags.maxUsd,
		max_no_progress: flags.maxNoProgress,
		completion_sentinel: flags.sentinel,
		status: "running",
		cwd: io.cwd,
		model: flags.model,
	};
	writeGoalMd(paths.goalMd, frontmatter, flags.text!);

	const state: GoalState = {
		iteration: 0,
		last_progress_iteration: 0,
		started_at: startedAt,
		last_heartbeat: startedAt,
		status: "running",
	};
	writeState(paths, state);

	try {
		io.spawnDriver(id);
	} catch (error) {
		return {
			exitCode: 1,
			output: `Goal ${id} created, but failed to launch driver: ${error instanceof Error ? error.message : String(error)}`,
		};
	}

	return {
		exitCode: 0,
		output: [
			`Goal ${id} created.`,
			`Path: ${paths.root}`,
			`Driver: background`,
			`Caps: ${flags.maxIterations} iter, ${flags.maxWallClockH}h, $${flags.maxUsd}`,
			`Edit: ${paths.goalMd}`,
			`Check: /goal status ${id}`,
		].join("\n"),
	};
}

function resumeGoal(rest: string[], io: GoalSlashCommandIO): GoalSlashCommandResult {
	let force = false;
	const positional: string[] = [];
	for (const arg of rest) {
		if (arg === "--force") force = true;
		else positional.push(arg);
	}

	const id = parseGoalIdArg(io.cwd, positional[0]);
	if (!id) {
		return { exitCode: 1, output: "No goal found to resume. Run /goal list." };
	}

	const paths = goalPaths(io.cwd, id);
	const state = readState(paths);
	if (state?.status === "done") {
		return { exitCode: 0, output: `Goal ${id} already completed.` };
	}
	if (state?.status === "running" && !force) {
		return {
			exitCode: 1,
			output: `Goal ${id} already marked running. Use /goal status ${id} or add --force.`,
		};
	}
	if (state?.status === "paused" && !force) {
		return {
			exitCode: 1,
			output: `Goal ${id} is paused. Add --force to continue.`,
		};
	}

	if (state) {
		state.status = "running";
		state.failure_reason = undefined;
		state.finished_at = undefined;
		state.last_heartbeat = new Date().toISOString();
		writeState(paths, state);
	}
	updateGoalFrontmatter(paths.goalMd, { status: "running" });

	try {
		io.spawnDriver(id);
	} catch (error) {
		return {
			exitCode: 1,
			output: `Failed to launch goal ${id}: ${error instanceof Error ? error.message : String(error)}`,
		};
	}

	return {
		exitCode: 0,
		output: `Resumed goal ${id} in background. Check progress with /goal status ${id}.`,
	};
}

function cancelGoal(rest: string[], io: GoalSlashCommandIO): GoalSlashCommandResult {
	const id = parseGoalIdArg(io.cwd, rest[0]);
	if (!id) {
		return { exitCode: 1, output: "No goal found." };
	}

	const paths = goalPaths(io.cwd, id);
	const state = readState(paths) ?? {
		iteration: 0,
		last_progress_iteration: 0,
		started_at: new Date().toISOString(),
		last_heartbeat: new Date().toISOString(),
		status: "running" as const,
	};
	state.status = "cancelled";
	state.finished_at = new Date().toISOString();
	state.failure_reason = "cancelled by user";
	writeState(paths, state);
	updateGoalFrontmatter(paths.goalMd, { status: "cancelled" });

	return {
		exitCode: 0,
		output: `Goal ${id} marked cancelled. Running driver, if any, will stop at next iteration boundary.`,
	};
}

export async function runGoalSlashCommand(args: string, io: GoalSlashCommandIO): Promise<GoalSlashCommandResult> {
	const argv = tokenizeArgs(args);
	if (argv.length === 0) {
		return { exitCode: 0, output: HELP_TEXT };
	}

	const head = argv[0]?.toLowerCase();
	if (!head) {
		return { exitCode: 0, output: HELP_TEXT };
	}

	if (head === "help" || head === "--help" || head === "-h") {
		return { exitCode: 0, output: HELP_TEXT };
	}
	if (head === "list") {
		return formatGoalList(io.cwd);
	}
	if (head === "status") {
		const id = parseGoalIdArg(io.cwd, argv[1]);
		if (!id) return { exitCode: 1, output: "No goal found." };
		return formatGoalStatus(io.cwd, id);
	}
	if (head === "cancel") {
		return cancelGoal(argv.slice(1), io);
	}
	if (head === "resume") {
		return resumeGoal(argv.slice(1), io);
	}
	if (head === "start") {
		return startGoal(argv.slice(1), io);
	}

	if (SUBCOMMANDS.has(head)) {
		return { exitCode: 0, output: HELP_TEXT };
	}

	return startGoal(argv, io);
}
