/**
 * Build dashboard widget — persistent TUI widget showing live wave progress.
 *
 * Registered via ctx.ui.setWidget() with placement "aboveEditor".
 * Updates are triggered by WaveExecutor as task states change.
 */

import type { ExecutorTask } from "../wave/executor.js";

const WIDGET_KEY = "ck-build-dashboard";

export interface DashboardContext {
	ui: {
		setWidget: (key: string, lines: string[], options?: { placement?: "aboveEditor" | "belowEditor" }) => void;
	};
}

export class BuildDashboardWidget {
	private waveName = "";
	private totalTasks = 0;
	private taskOutputs: Map<string, string> = new Map();
	private iteration = 0;
	private mounted = false;

	constructor(private ctx: DashboardContext) {}

	mount(): void {
		this.mounted = true;
		this.render([]);
	}

	unmount(): void {
		this.mounted = false;
		// Clear widget by setting empty lines
		this.ctx.ui.setWidget(WIDGET_KEY, []);
	}

	updateWave(waveNum: number, tasks: ExecutorTask[]): void {
		this.waveName = `Wave ${waveNum}`;
		this.totalTasks = tasks.length;
	}

	updateTaskOutput(taskId: string, snippet: string): void {
		this.taskOutputs.set(taskId, snippet);
	}

	render(tasks: ExecutorTask[]): void {
		if (!this.mounted) return;

		const total = tasks.length || this.totalTasks;
		const done = tasks.filter((t) => t.status === "done").length;
		const inProgress = tasks.filter((t) => t.status === "in-progress");
		const blocked = tasks.filter((t) => t.status === "blocked").length;

		// Group active tasks for display (show up to 4)
		const activeTasks = inProgress.slice(0, 4);

		const width = 52;
		const border = "═".repeat(width - 2);

		const lines = [
			`╔${border}╗`,
			`║ CaveKit Build${" ".repeat(width - 16)}║`,
			`║ ${this.waveName.padEnd(width - 4)} ║`,
			`║${" ".repeat(width - 2)}║`,
		];

		for (const task of activeTasks) {
			const bar = progressBar(task.iterations, task.complexity);
			const label = `${task.id} ${task.name}`.slice(0, 28).padEnd(28);
			lines.push(`║ ● ${label} ${bar} ║`);
		}

		if (activeTasks.length === 0) {
			lines.push(`║  (no active tasks)${" ".repeat(width - 20)}║`);
		}

		lines.push(`║${" ".repeat(width - 2)}║`);
		lines.push(
			`║ ✓${String(done).padStart(3)}/${String(total).padEnd(3)} │ ✗${String(blocked).padStart(2)} │ Iter ${this.iteration}${" ".repeat(Math.max(0, width - 30))}║`,
		);
		lines.push(`╚${border}╝`);

		this.ctx.ui.setWidget(WIDGET_KEY, lines, { placement: "aboveEditor" });
	}

	incrementIteration(): void {
		this.iteration++;
	}
}

function progressBar(iterations: number, complexity: "S" | "M" | "L"): string {
	const max = complexity === "S" ? 3 : complexity === "M" ? 5 : 8;
	const pct = Math.min(1, iterations / max);
	const filled = Math.round(pct * 8);
	return `${"█".repeat(filled)}${"░".repeat(8 - filled)}`;
}
