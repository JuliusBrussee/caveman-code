/**
 * /ck:build — Execute the wave-based build from a build site.
 *
 * AC-1: Reads build site from context/plans/build-site.md and computes
 *       the task frontier via parseBuildSite + computeFrontier.
 * AC-2: Dispatches parallel subagents per wave (delegated to WaveExecutor).
 * AC-3: Tracks progress in context/impl/ — per-task impl-<id>.md files and
 *       a cumulative loop-log.md appended after each wave.
 * AC-4: Respects config.maxIterations as a circuit breaker (enforced in
 *       WaveExecutor.run()).
 * AC-5: Commits the working tree after each wave via git commit.
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";
import { buildScopedContext } from "../context-builder.js";
import type { ExecutorTask } from "../wave/executor.js";
import { WaveExecutor } from "../wave/executor.js";
import { BuildDashboardWidget } from "../widgets/build-dashboard.js";

// ---------------------------------------------------------------------------
// Canonical build-site location (T-030)
// ---------------------------------------------------------------------------

const BUILD_SITE_CANDIDATES = [
	path.join("context", "plans", "build-site.md"),
	path.join("context", "sites", "build-site.md"),
] as const;

function findBuildSite(cwd: string, override?: string): string | null {
	if (override) {
		const abs = path.isAbsolute(override) ? override : path.join(cwd, override);
		return fs.existsSync(abs) ? abs : null;
	}
	for (const rel of BUILD_SITE_CANDIDATES) {
		const abs = path.join(cwd, rel);
		if (fs.existsSync(abs)) return abs;
	}
	return null;
}

// ---------------------------------------------------------------------------
// Loop-log helpers (AC-3)
// ---------------------------------------------------------------------------

function appendLoopLog(
	cwd: string,
	waveNum: number,
	results: Array<[ExecutorTask, boolean]>,
	allTasks: ExecutorTask[],
): void {
	const implDir = path.join(cwd, "context", "impl");
	fs.mkdirSync(implDir, { recursive: true });

	const logPath = path.join(implDir, "loop-log.md");

	const done = allTasks.filter((t) => t.status === "done").length;
	const total = allTasks.length;
	const blocked = allTasks.filter((t) => t.status === "blocked").length;
	const failed = allTasks.filter((t) => t.status === "failed").length;
	const inProgress = allTasks.filter((t) => t.status === "in-progress").length;

	const taskLines = results.map(([task, ok]) => {
		const icon = ok ? "✓" : task.status === "blocked" ? "✗" : "~";
		return `- ${icon} ${task.id}: ${task.name} → **${task.status}**`;
	});

	const entry = [
		`### Iteration ${waveNum}`,
		"",
		`**Wave:** ${waveNum}  `,
		`**Date:** ${new Date().toISOString()}  `,
		`**Status:** ${done === total ? "DONE" : blocked > 0 ? "BLOCKED" : "IN-PROGRESS"}  `,
		`**Acceptance ${done}/${total}**  `,
		`**Blocked:** ${blocked}  **Failed:** ${failed}  **Active:** ${inProgress}`,
		"",
		"**Tasks this wave:**",
		...taskLines,
		"",
		"---",
		"",
	].join("\n");

	fs.appendFileSync(logPath, entry, "utf8");
}

// ---------------------------------------------------------------------------
// Git commit helper (AC-5)
// ---------------------------------------------------------------------------

function commitWave(cwd: string, waveNum: number, results: Array<[ExecutorTask, boolean]>): void {
	try {
		const taskIds = results.map(([t]) => t.id).join(", ");
		const msg = `chore(build): wave ${waveNum} — ${taskIds}`;
		execSync("git add -u context/ packages/", { cwd, stdio: "ignore" });
		execSync(`git commit -m ${JSON.stringify(msg)} --allow-empty`, { cwd, stdio: "ignore" });
	} catch {
		// Non-fatal — skip commit if git is not available or nothing to commit
	}
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerBuildCommand(pi: ExtensionAPI, config: CaveKitConfig): void {
	pi.registerCommand("ck:build", {
		description: "Execute wave-based build from context/plans/build-site.md",
		getArgumentCompletions: async (prefix) => {
			// Offer the canonical sites directory for override paths
			const sitesDir = path.join(process.cwd(), "context", "sites");
			if (!fs.existsSync(sitesDir)) return null;
			const sites = fs
				.readdirSync(sitesDir)
				.filter((f) => f.endsWith(".md") && f.startsWith(prefix))
				.map((f) => ({ value: f.replace(".md", ""), label: f }));
			return sites.length > 0 ? sites : null;
		},
		handler: async (args, ctx) => {
			const cwd = ctx.cwd;

			// --- AC-1: Locate build site ---
			const override = args.trim() || undefined;
			const siteFile = findBuildSite(cwd, override);

			if (!siteFile) {
				const tried = BUILD_SITE_CANDIDATES.join(", ");
				ctx.ui.notify(`Build site not found. Expected one of: ${tried}. Run /ck:architect first.`, "warning");
				return;
			}

			const confirmed = await ctx.ui.confirm(
				"Start Build",
				`Execute build from ${path.relative(cwd, siteFile)}?\n\nThis will spawn parallel subagents for each wave.`,
			);
			if (!confirmed) return;

			// --- Register build dashboard widget ---
			const dashboard = new BuildDashboardWidget(ctx);
			dashboard.mount();

			// --- Wire scoped context builder (T-029) ---
			// Each task gets a trimmed context containing only its referenced
			// kit requirements rather than the full kit dump.
			const buildContext = (task: ExecutorTask): string => buildScopedContext(task.id, cwd, config);

			// --- AC-3 + AC-5: wave-complete hook ---
			const onWaveComplete = async (
				waveNum: number,
				results: Array<[ExecutorTask, boolean]>,
				allTasks: ExecutorTask[],
			): Promise<void> => {
				// Report wave summary via UI (satisfies "use ctx to report progress")
				const done = results.filter(([, ok]) => ok).length;
				ctx.ui.notify(
					`Wave ${waveNum} complete: ${done}/${results.length} task(s) succeeded`,
					done === results.length ? "info" : "warning",
				);

				// AC-3: Append to loop-log
				appendLoopLog(cwd, waveNum, results, allTasks);

				// AC-5: Commit after each wave
				commitWave(cwd, waveNum, results);
			};

			// --- Execute waves ---
			const executor = new WaveExecutor(siteFile, config, ctx, dashboard, {
				buildContext,
				onWaveComplete,
			});

			try {
				await executor.run();
				ctx.ui.notify("Build complete!", "info");
			} catch (err) {
				ctx.ui.notify(`Build failed: ${err instanceof Error ? err.message : String(err)}`, "error");
			} finally {
				dashboard.unmount();
			}
		},
	});
}
