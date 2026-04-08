/**
 * Wave executor — parses a build site and dispatches parallel subagents per wave.
 *
 * Phase 1: Uses Pi print-mode dispatch (pi -p "<task>") via child_process.
 * Phase 2 (TODO): Migrate to createAgentSession() SDK embedding for live progress.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { CaveKitConfig } from "../config/index.js";
import type { TaskStatus } from "../types.js";
import type { BuildDashboardWidget } from "../widgets/build-dashboard.js";

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

export class WaveExecutor {
	private tasks: ExecutorTask[];
	private siteFile: string;

	constructor(
		siteFile: string,
		private config: CaveKitConfig,
		private ctx: WaveExecutorContext,
		private dashboard: BuildDashboardWidget,
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

			waveNum++;
			this.ctx.ui.notify(`Wave ${waveNum}: dispatching ${frontier.length} task(s)`, "info");
			this.dashboard.updateWave(waveNum, frontier);

			// Mark tasks as in-progress
			for (const task of frontier) {
				task.status = "in-progress";
				task.iterations++;
			}
			this.dashboard.render(this.tasks);

			// Dispatch parallel tasks (Phase 1: print-mode)
			const results = await this.dispatchWave(frontier);

			// Process results
			let blocked = 0;
			for (const [task, success] of results) {
				if (success) {
					task.status = "done";
				} else if (task.iterations >= this.config.maxIterations) {
					task.status = "blocked";
					blocked++;
					this.ctx.ui.notify(`BLOCKED: ${task.id} (${task.name}) — reached max iterations`, "error");
				} else {
					task.status = "failed";
				}
			}

			this.dashboard.render(this.tasks);

			if (blocked > 0) {
				const resume = await this.ctx.ui.confirm(
					"Tasks Blocked",
					`${blocked} task(s) are blocked. Continue with remaining tasks?`,
				);
				if (!resume) break;
			}

			// Persist updated status to build site
			this.persistStatus();

			// Tier gate: check if we just completed a full tier
			await this.checkTierGate(frontier);
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
		return new Promise((resolve) => {
			const prompt = this.buildTaskPrompt(task);
			const piArgs = ["-p", prompt, "--no-interactive"];

			const child = spawn("pi", piArgs, {
				cwd: this.ctx.cwd,
				stdio: ["ignore", "pipe", "pipe"],
				signal: this.ctx.signal,
			});

			let stdout = "";
			child.stdout?.on("data", (d: Buffer) => {
				stdout += d.toString();
				this.dashboard.updateTaskOutput(task.id, stdout.slice(-200));
			});

			child.on("close", (code) => {
				resolve(code === 0);
				// Write task output to impl record
				const implDir = path.join(this.ctx.cwd, "context", "impl");
				fs.mkdirSync(implDir, { recursive: true });
				fs.writeFileSync(
					path.join(implDir, `${task.id}.md`),
					`# ${task.id}: ${task.name}\n**Status:** ${code === 0 ? "done" : "failed"}\n\n${stdout}`,
					"utf8",
				);
			});

			child.on("error", () => resolve(false));
		});
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
			"Implement this task. Follow the design constraints above. When done, confirm which acceptance criteria are met.",
		]
			.filter(Boolean)
			.join("\n");
	}

	private buildKitContext(task: ExecutorTask): string {
		if (task.kitRefs.length === 0) return "";
		// TODO: load and compress relevant kit sections (Phase 4: caveman compression)
		return `Kit references: ${task.kitRefs.join(", ")}`;
	}

	private loadDesignContext(): string {
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

	private async checkTierGate(completedTasks: ExecutorTask[]): Promise<void> {
		if (this.config.tierGateMode === "off") return;

		const completedTiers = [...new Set(completedTasks.map((t) => t.tier))];
		for (const tier of completedTiers) {
			const tierTasks = this.tasks.filter((t) => t.tier === tier);
			const allDone = tierTasks.every((t) => t.status === "done" || t.status === "blocked");
			if (allDone) {
				this.ctx.ui.notify(`Tier ${tier} complete — tier gate check`, "info");
				// TODO Phase 2: dispatch Codex adversarial review of tier diff
				// For now just notify
			}
		}
	}
}
