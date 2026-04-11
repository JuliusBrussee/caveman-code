/**
 * Wave executor — parses a build site and dispatches parallel subagents per wave.
 *
 * Uses createAgentSession() SDK embedding for full tool support including RTK
 * hooks on bash commands, extension hooks, and proper auth propagation.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { CaveKitConfig } from "../config/index.js";
import type { TaskStatus } from "../types.js";
import type { BuildDashboardWidget } from "../widgets/build-dashboard.js";
import { runTierGateReview } from "./tier-gate.js";

export type { TaskStatus };

export interface ExecutorTask {
	id: string;
	name: string;
	description: string;
	tier: number;
	dependencies: string[];
	kitRefs: string[];
	complexity: "S" | "M" | "L";
	status: TaskStatus;
	iterations: number;
}

/** Parse build-site markdown into structured task list. */
export function parseBuildSite(content: string): ExecutorTask[] {
	const tasks: ExecutorTask[] = [];
	let currentTier = 0;
	let currentTask: Partial<ExecutorTask> | null = null;

	for (const line of content.split("\n")) {
		// Tier heading: ## Tier N
		const tierMatch = line.match(/^##\s+Tier\s+(\d+)/i);
		if (tierMatch) {
			currentTier = Number(tierMatch[1]);
			continue;
		}

		// Task heading: ### T-NNN: Name
		const taskMatch = line.match(/^###\s+(T-\d+):\s+(.+)/);
		if (taskMatch) {
			if (currentTask?.id) tasks.push(finishTask(currentTask));
			currentTask = {
				id: taskMatch[1],
				name: taskMatch[2].trim(),
				tier: currentTier,
				status: "pending",
				iterations: 0,
				dependencies: [],
				kitRefs: [],
				complexity: "M",
				description: "",
			};
			continue;
		}

		if (!currentTask) continue;

		// Dependencies
		const depsMatch = line.match(/\*\*Dependencies:\*\*\s+(.+)/);
		if (depsMatch) {
			const raw = depsMatch[1].trim();
			currentTask.dependencies = raw === "none" ? [] : raw.split(/,\s*/).filter(Boolean);
			continue;
		}

		// Kit refs
		const refsMatch = line.match(/\*\*Kit Refs:\*\*\s+(.+)/);
		if (refsMatch) {
			currentTask.kitRefs = refsMatch[1].split(/,\s*/).filter(Boolean);
			continue;
		}

		// Complexity
		const complexMatch = line.match(/\*\*Complexity:\*\*\s+(S|M|L)/);
		if (complexMatch) {
			currentTask.complexity = complexMatch[1] as "S" | "M" | "L";
			continue;
		}

		// Status (for re-reads of in-progress builds)
		const statusMatch = line.match(/\*\*Status:\*\*\s+(\w[-\w]*)/);
		if (statusMatch) {
			currentTask.status = statusMatch[1] as TaskStatus;
			continue;
		}

		// Accumulate description lines
		if (line.trim() && !line.startsWith("---") && !line.startsWith("**")) {
			currentTask.description = `${currentTask.description || ""} ${line.trim()}`.trim();
		}
	}

	if (currentTask?.id) tasks.push(finishTask(currentTask));
	return tasks;
}

function finishTask(partial: Partial<ExecutorTask>): ExecutorTask {
	return {
		id: partial.id!,
		name: partial.name || "",
		description: partial.description || "",
		tier: partial.tier ?? 0,
		dependencies: partial.dependencies || [],
		kitRefs: partial.kitRefs || [],
		complexity: partial.complexity || "M",
		status: partial.status || "pending",
		iterations: partial.iterations || 0,
	};
}

/** Compute the next wave: tasks whose dependencies are all done. */
export function computeFrontier(tasks: ExecutorTask[]): ExecutorTask[] {
	const doneIds = new Set(tasks.filter((t) => t.status === "done").map((t) => t.id));
	return tasks.filter((t) => t.status === "pending" && t.dependencies.every((dep) => doneIds.has(dep)));
}

export interface WaveExecutorContext {
	cwd: string;
	ui: {
		notify: (msg: string, type?: "info" | "warning" | "error") => void;
		confirm: (title: string, msg: string) => Promise<boolean>;
	};
	signal: AbortSignal | undefined;
}

/** Optional callbacks that extend WaveExecutor behaviour. */
export interface WaveExecutorHooks {
	/**
	 * Called after each wave completes (after status is written to disk).
	 * The caller can use this to append a loop-log entry, commit, etc.
	 */
	onWaveComplete?: (
		waveNum: number,
		results: Array<[ExecutorTask, boolean]>,
		allTasks: ExecutorTask[],
	) => Promise<void>;

	/**
	 * Override the default kit-context builder.
	 * Receives the task and should return a context string for injection into
	 * the subagent prompt.  When omitted the executor falls back to a minimal
	 * "Kit references: …" stub.
	 */
	buildContext?: (task: ExecutorTask) => string;
}

export class WaveExecutor {
	private tasks: ExecutorTask[];
	private siteFile: string;

	constructor(
		siteFile: string,
		private config: CaveKitConfig,
		private ctx: WaveExecutorContext,
		private dashboard: BuildDashboardWidget,
		private hooks: WaveExecutorHooks = {},
	) {
		this.siteFile = siteFile;
		const content = fs.readFileSync(siteFile, "utf8");
		this.tasks = parseBuildSite(content);
	}

	async run(): Promise<void> {
		let waveNum = 0;

		while (true) {
			const frontier = computeFrontier(this.tasks);
			if (frontier.length === 0) break;

			// Circuit-breaker: refuse to start a wave where every task has
			// already hit or exceeded maxIterations.
			const workable = frontier.filter((t) => t.iterations < this.config.maxIterations);
			if (workable.length === 0) {
				this.ctx.ui.notify(
					`Circuit breaker: all frontier tasks have reached maxIterations (${this.config.maxIterations}). Stopping.`,
					"error",
				);
				break;
			}

			waveNum++;
			this.ctx.ui.notify(`Wave ${waveNum}: dispatching ${workable.length} task(s)`, "info");
			this.dashboard.updateWave(waveNum, workable);

			// Mark tasks as in-progress
			for (const task of workable) {
				task.status = "in-progress";
				task.iterations++;
			}
			this.dashboard.render(this.tasks);

			// Dispatch parallel tasks via embedded agent sessions (RTK-enabled)
			const results = await this.dispatchWave(workable);

			// Process results
			let blocked = 0;
			for (const [task, success] of results) {
				if (success) {
					task.status = "done";
				} else if (task.iterations >= this.config.maxIterations) {
					task.status = "blocked";
					blocked++;
					this.ctx.ui.notify(`BLOCKED: ${task.id} (${task.name}) — reached max iterations`, "error");
				} else if (task.iterations >= this.config.maxRetries) {
					task.status = "blocked";
					blocked++;
					this.ctx.ui.notify(
						`BLOCKED: ${task.id} (${task.name}) — exhausted ${this.config.maxRetries} retries`,
						"error",
					);
				} else {
					task.status = "pending"; // Reset for retry on next wave
				}
			}

			this.dashboard.render(this.tasks);
			this.dashboard.incrementIteration();

			// Persist updated status to build site
			this.persistStatus();

			// Call the wave-complete hook (loop-log, git commit, etc.)
			if (this.hooks.onWaveComplete) {
				await this.hooks.onWaveComplete(waveNum, results, this.tasks);
			}

			if (blocked > 0) {
				const resume = await this.ctx.ui.confirm(
					"Tasks Blocked",
					`${blocked} task(s) are blocked. Continue with remaining tasks?`,
				);
				if (!resume) break;
			}

			// Tier gate: check if we just completed a full tier (AC-1/AC-4)
			const tierGateBlocked = await this.checkTierGate(workable);
			if (tierGateBlocked) break;
		}

		const done = this.tasks.filter((t) => t.status === "done").length;
		const total = this.tasks.length;
		this.ctx.ui.notify(`Build complete: ${done}/${total} tasks done`, done === total ? "info" : "warning");
	}

	private async dispatchWave(tasks: ExecutorTask[]): Promise<Array<[ExecutorTask, boolean]>> {
		const batches: ExecutorTask[][] = [];
		for (let i = 0; i < tasks.length; i += this.config.maxParallel) {
			batches.push(tasks.slice(i, i + this.config.maxParallel));
		}

		const results: Array<[ExecutorTask, boolean]> = [];
		for (const batch of batches) {
			const batchResults = await Promise.all(batch.map((task) => this.dispatchTask(task)));
			results.push(...batchResults.map((ok, i): [ExecutorTask, boolean] => [batch[i], ok]));
		}
		return results;
	}

	private async dispatchTask(task: ExecutorTask): Promise<boolean> {
		const prompt = this.buildTaskPrompt(task);
		const implDir = path.join(this.ctx.cwd, "context", "impl");
		fs.mkdirSync(implDir, { recursive: true });

		try {
			// Dynamic import — cave is a peer dep, resolved at runtime inside host process.
			// createAgentSession wires RTK hooks, extension hooks, and proper auth automatically
			// via _buildRuntime() → createRtkSpawnHook() → bash tool.
			const { createAgentSession, SessionManager } = await import("cave");

			const { session } = await createAgentSession({
				cwd: this.ctx.cwd,
				// In-memory session — subagent work doesn't need file persistence
				sessionManager: SessionManager.inMemory(this.ctx.cwd),
			});

			// Capture assistant text output for impl records
			let output = "";
			const unsub = session.subscribe((event: any) => {
				if (event.type === "message_end" && event.message?.role === "assistant") {
					const content = event.message.content;
					if (Array.isArray(content)) {
						for (const block of content) {
							if (block.type === "text" && block.text) {
								output += `${block.text}\n`;
							}
						}
					}
				}
			});

			// Run the full agent turn — all tool calls (bash, read, edit, write) go through
			// the host agent's tool infrastructure with RTK hooks active.
			await session.prompt(prompt);
			unsub();

			this.dashboard.updateTaskOutput(task.id, output.slice(-200));

			fs.writeFileSync(
				path.join(implDir, `${task.id}.md`),
				`# ${task.id}: ${task.name}\n**Status:** done\n\n${output}`,
				"utf8",
			);
			return true;
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			this.ctx.ui.notify(`Task ${task.id} failed: ${errorMsg}`, "error");

			fs.writeFileSync(
				path.join(implDir, `${task.id}.md`),
				`# ${task.id}: ${task.name}\n**Status:** failed\n\n**Error:** ${errorMsg}`,
				"utf8",
			);
			return false;
		}
	}

	private buildTaskPrompt(task: ExecutorTask): string {
		const kitContext = this.buildKitContext(task);
		const designContext = this.loadDesignContext();

		return [
			designContext ? `## Design Constraints\n${designContext}\n` : "",
			`## Task: ${task.id} — ${task.name}`,
			`**Tier:** ${task.tier}`,
			`**Kit Refs:** ${task.kitRefs.join(", ")}`,
			`**Complexity:** ${task.complexity}`,
			"",
			task.description,
			"",
			kitContext ? `## Relevant Requirements\n${kitContext}` : "",
			"",
			"Implement this task. Follow the design constraints above.",
			"Write all file content directly using the write or edit tool. Do NOT use Python, Node, or external scripts to generate content.",
			"When done, confirm which acceptance criteria are met.",
		]
			.filter(Boolean)
			.join("\n");
	}

	private buildKitContext(task: ExecutorTask): string {
		// Prefer the injected context builder (e.g. buildScopedContext from T-029).
		if (this.hooks.buildContext) {
			return this.hooks.buildContext(task);
		}
		if (task.kitRefs.length === 0) return "";
		// Fallback: plain kit-ref list (Phase 4 will add caveman compression)
		return `Kit references: ${task.kitRefs.join(", ")}`;
	}

	private loadDesignContext(): string {
		// When a context builder hook is provided it already includes DESIGN.md,
		// so we skip the separate load to avoid duplication.
		if (this.hooks.buildContext) return "";
		const designPath = path.join(this.ctx.cwd, "DESIGN.md");
		if (!fs.existsSync(designPath)) return "";
		return fs.readFileSync(designPath, "utf8");
	}

	private persistStatus(): void {
		const content = fs.readFileSync(this.siteFile, "utf8");
		let updated = content;
		for (const task of this.tasks) {
			updated = updated.replace(
				new RegExp(`(###\\s+${task.id}:[\\s\\S]*?\\*\\*Status:\\*\\*)\\s+\\w[-\\w]*`),
				`$1 ${task.status}`,
			);
		}
		fs.writeFileSync(this.siteFile, updated, "utf8");
	}

	private async checkTierGate(completedTasks: ExecutorTask[]): Promise<boolean> {
		if (this.config.tierGateMode === "off") return false;

		const completedTiers = [...new Set(completedTasks.map((t) => t.tier))];
		let blocked = false;

		for (const tier of completedTiers) {
			const tierTasks = this.tasks.filter((t) => t.tier === tier);
			const allDone = tierTasks.every((t) => t.status === "done" || t.status === "blocked");
			if (!allDone) continue;

			// AC-1: Run after each tier completes — dispatches tier gate review
			const result = await runTierGateReview(tier, this.config, this.ctx.cwd, this.ctx);

			// AC-4: Block next tier on P0/P1 findings (when mode is "severity" or "strict")
			if (result.blocked) {
				blocked = true;
				const shouldContinue = await this.ctx.ui.confirm(
					`Tier ${tier} Gate: BLOCKED`,
					`${result.summary}\n\nP0/P1 findings were found. Proceeding to the next tier may build on broken foundations.\n\nContinue anyway?`,
				);
				if (!shouldContinue) {
					// Mark all pending tasks as blocked
					for (const task of this.tasks) {
						if (task.status === "pending") {
							task.status = "blocked";
						}
					}
					return true;
				}
			}
		}

		return blocked;
	}
}
