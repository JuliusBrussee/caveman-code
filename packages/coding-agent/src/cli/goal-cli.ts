/**
 * `cave goal …` subcommand handler. Drives the autonomous goal loop with
 * fresh-process-per-iteration spawning of `cave -p`.
 *
 * Subcommands:
 *   start "<text>"  [--max-iterations N] [--max-wall-clock-h H] [--max-usd D]
 *                   [--max-no-progress N] [--sentinel S] [--model M] [--quiet]
 *   resume [<id>]   [--force]    Re-run loop on most-recent / named goal.
 *   status [<id>]                Show state, ledger, last few transcript entries.
 *   cancel [<id>]                Mark cancelled (driver, if running, exits at next iter boundary).
 *   list                         List all goals under cwd.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import chalk from "chalk";
import { resolveGoalInvocation, runGoal } from "../core/goal-loop/goal-runner.js";
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
	readLedger,
	readState,
	updateGoalFrontmatter,
	writeGoalMd,
	writeState,
} from "../core/goal-loop/goal-state.js";

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

const printHelp = (): void => {
	console.log(`${chalk.bold("cave goal")} — autonomous goal loop (Ralph-style)

${chalk.bold("Usage:")}
  cave goal start "<goal text>" [flags]
  cave goal resume [<id>] [--force]
  cave goal status [<id>]
  cave goal cancel [<id>]
  cave goal list

${chalk.bold("start flags:")}
  --max-iterations N        default ${DEFAULT_MAX_ITERATIONS}
  --max-wall-clock-h H      default ${DEFAULT_MAX_WALL_CLOCK_HOURS}
  --max-usd D               default ${DEFAULT_MAX_USD}
  --max-no-progress N       default ${DEFAULT_MAX_NO_PROGRESS}
  --sentinel S              default "${DEFAULT_COMPLETION_SENTINEL}"
  --model PATTERN           override model passed to each iter's \`cave -p\`
  --quiet                   suppress per-iter child stdout

${chalk.bold("State:")}
  Stored in <cwd>/.cave/goal/<id>/. Goal text lives in GOAL.md and may be
  edited mid-run; the next iteration re-reads it.

${chalk.bold("Termination:")}
  1. Model emits sentinel  → status=done
  2. Iteration / wall-clock / $ caps  → status=failed
  3. ${DEFAULT_MAX_NO_PROGRESS} consecutive iterations w/ no repo change  → status=paused
`);
};

const parseStartFlags = (rest: string[]): StartFlags => {
	const f: StartFlags = {
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
				f.maxIterations = Number.parseInt(rest[++i], 10);
				break;
			case "--max-wall-clock-h":
				f.maxWallClockH = Number.parseFloat(rest[++i]);
				break;
			case "--max-usd":
				f.maxUsd = Number.parseFloat(rest[++i]);
				break;
			case "--max-no-progress":
				f.maxNoProgress = Number.parseInt(rest[++i], 10);
				break;
			case "--sentinel":
				f.sentinel = rest[++i];
				break;
			case "--model":
				f.model = rest[++i];
				break;
			case "--quiet":
				f.quiet = true;
				break;
			default:
				if (arg.startsWith("--")) {
					console.error(chalk.red(`Unknown flag: ${arg}`));
					process.exit(2);
				}
				positional.push(arg);
		}
	}
	f.text = positional.join(" ").trim() || undefined;
	return f;
};

const handleStart = async (rest: string[]): Promise<number> => {
	const flags = parseStartFlags(rest);
	if (!flags.text) {
		console.error(chalk.red('Error: goal text is required.\nExample: cave goal start "add unit tests for foo.ts"'));
		return 2;
	}
	const cwd = process.cwd();
	const id = newGoalId();
	const paths = goalPaths(cwd, id);
	mkdirSync(paths.root, { recursive: true });
	const frontmatter: GoalFrontmatter = {
		id,
		started_at: new Date().toISOString(),
		max_iterations: flags.maxIterations,
		max_wall_clock_h: flags.maxWallClockH,
		max_usd: flags.maxUsd,
		max_no_progress: flags.maxNoProgress,
		completion_sentinel: flags.sentinel,
		status: "running",
		cwd,
		model: flags.model,
	};
	writeGoalMd(paths.goalMd, frontmatter, flags.text);
	const state: GoalState = {
		iteration: 0,
		last_progress_iteration: 0,
		started_at: frontmatter.started_at,
		last_heartbeat: frontmatter.started_at,
		status: "running",
	};
	writeState(paths, state);

	console.log(chalk.cyan(`Goal ${chalk.bold(id)} created at ${paths.root}`));
	console.log(chalk.dim(`  caps: ${flags.maxIterations} iters, ${flags.maxWallClockH}h, $${flags.maxUsd}`));
	console.log(chalk.dim(`  edit: ${paths.goalMd}`));
	console.log("");

	return runDriver(cwd, id, !flags.quiet);
};

const handleResume = async (rest: string[]): Promise<number> => {
	const cwd = process.cwd();
	let force = false;
	const positional: string[] = [];
	for (const a of rest) {
		if (a === "--force") force = true;
		else positional.push(a);
	}
	const id = parseGoalIdArg(cwd, positional[0]);
	if (!id) {
		console.error(chalk.red("No goal found to resume. Run `cave goal list`."));
		return 2;
	}
	const paths = goalPaths(cwd, id);
	const state = readState(paths);
	if (state?.status === "done") {
		console.error(chalk.yellow(`Goal ${id} already completed.`));
		return 0;
	}
	if (state?.status === "paused" && !force) {
		console.error(chalk.yellow(`Goal ${id} is paused (no progress detected). Add --force to continue.`));
		return 2;
	}
	if (state) {
		state.status = "running";
		state.failure_reason = undefined;
		writeState(paths, state);
	}
	updateGoalFrontmatter(paths.goalMd, { status: "running" });
	console.log(chalk.cyan(`Resuming goal ${chalk.bold(id)} at iter ${state?.iteration ?? 0}`));
	return runDriver(cwd, id, true);
};

const handleStatus = (rest: string[]): number => {
	const cwd = process.cwd();
	const id = parseGoalIdArg(cwd, rest[0]);
	if (!id) {
		console.error(chalk.red("No goal found."));
		return 2;
	}
	const paths = goalPaths(cwd, id);
	if (!existsSync(paths.goalMd)) {
		console.error(chalk.red(`Goal ${id} not found at ${paths.goalMd}`));
		return 2;
	}
	const goalText = readFileSync(paths.goalMd, "utf8");
	const state = readState(paths);
	const ledger = readLedger(paths);
	console.log(chalk.bold(`Goal ${id}`));
	console.log(chalk.dim(paths.root));
	console.log("");
	console.log(goalText);
	console.log(chalk.bold("State:"), state ? JSON.stringify(state, null, 2) : "(none)");
	console.log(chalk.bold("Ledger:"), JSON.stringify(ledger, null, 2));
	if (existsSync(paths.transcriptJsonl)) {
		const lines = readFileSync(paths.transcriptJsonl, "utf8").trim().split(/\r?\n/);
		console.log(chalk.bold(`Last ${Math.min(lines.length, 5)} iterations:`));
		for (const line of lines.slice(-5)) {
			try {
				const e = JSON.parse(line);
				console.log(
					`  iter ${e.iter}  exit=${e.exit_code}  $${(e.usd ?? 0).toFixed(4)}  ${e.progress_signals?.join(",")}  sentinel=${e.sentinel_seen}`,
				);
			} catch {
				console.log(`  ${line}`);
			}
		}
	}
	return 0;
};

const handleCancel = (rest: string[]): number => {
	const cwd = process.cwd();
	const id = parseGoalIdArg(cwd, rest[0]);
	if (!id) {
		console.error(chalk.red("No goal found."));
		return 2;
	}
	const paths = goalPaths(cwd, id);
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
	console.log(chalk.yellow(`Goal ${id} marked cancelled.`));
	console.log(chalk.dim("If a driver is currently running it will exit at the next iteration boundary."));
	return 0;
};

const handleList = (): number => {
	const cwd = process.cwd();
	const goals = listGoals(cwd);
	if (goals.length === 0) {
		console.log(chalk.dim("No goals in this project."));
		return 0;
	}
	for (const g of goals) {
		const paths = goalPaths(cwd, g.id);
		const state = readState(paths);
		const ledger = readLedger(paths);
		const status = g.frontmatter.status;
		const color =
			status === "done"
				? chalk.green
				: status === "running"
					? chalk.cyan
					: status === "paused"
						? chalk.yellow
						: chalk.red;
		console.log(
			`${color(status.padEnd(9))}  ${g.id}  iter=${state?.iteration ?? 0}/${g.frontmatter.max_iterations}  $${ledger.usd.toFixed(2)}`,
		);
	}
	return 0;
};

const runDriver = async (cwd: string, id: string, verbose: boolean): Promise<number> => {
	const paths = goalPaths(cwd, id);
	const { caveCommand, caveArgsPrefix } = resolveGoalInvocation();
	const ac = new AbortController();
	const onSig = () => {
		console.error(chalk.yellow("\n[goal] received signal — finishing current iteration then exiting"));
		ac.abort();
	};
	process.on("SIGINT", onSig);
	process.on("SIGTERM", onSig);
	try {
		const result = await runGoal({
			cwd,
			id,
			paths,
			caveCommand,
			caveArgsPrefix,
			verbose,
			signal: ac.signal,
		});
		const color =
			result.finalStatus === "done" ? chalk.green : result.finalStatus === "paused" ? chalk.yellow : chalk.red;
		console.log(
			`\n${color(`[goal ${id}] ${result.finalStatus}`)} after ${result.iterations} iter, $${result.usd.toFixed(4)}`,
		);
		console.log(chalk.dim(`  reason: ${result.reason}`));
		if (result.finalStatus === "done") return 0;
		if (result.finalStatus === "paused") return 3;
		if (result.finalStatus === "cancelled") return 130;
		return 1;
	} finally {
		process.off("SIGINT", onSig);
		process.off("SIGTERM", onSig);
	}
};

export const handleGoalCommand = async (args: string[]): Promise<boolean> => {
	if (args[0] !== "goal") return false;
	const sub = args[1];
	const rest = args.slice(2);
	if (!sub || sub === "--help" || sub === "-h") {
		printHelp();
		process.exit(sub ? 0 : 2);
	}
	switch (sub) {
		case "start":
			process.exit(await handleStart(rest));
			break;
		case "resume":
			process.exit(await handleResume(rest));
			break;
		case "status":
			process.exit(handleStatus(rest));
			break;
		case "cancel":
			process.exit(handleCancel(rest));
			break;
		case "list":
			process.exit(handleList());
			break;
		default:
			console.error(chalk.red(`Unknown subcommand: cave goal ${sub}`));
			printHelp();
			process.exit(2);
	}
	return true;
};
