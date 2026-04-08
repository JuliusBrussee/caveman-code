/**
 * Build dashboard widget — persistent TUI widget showing live wave progress.
 *
 * Registered via ctx.ui.setWidget() with placement "aboveEditor".
 * Updates are triggered by WaveExecutor as task states change.
 *
 * T-035 (extension-ui/R1):
 * AC-1: Widget visible during active build, updates as tasks change status.
 * AC-2: Shows current wave number, task IDs/names/statuses.
 * AC-3: Shows aggregate progress (completed/total, blocked count).
 * AC-4: Toggleable on/off without interrupting the build.
 */

import type { ExecutorTask } from "../wave/executor.js";

const WIDGET_KEY = "ck-build-dashboard";

export interface DashboardContext {
	ui: {
		setWidget: (
			key: string,
			lines: string[] | undefined,
			options?: { placement?: "aboveEditor" | "belowEditor" },
		) => void;
	};
}

export class BuildDashboardWidget {
	private waveName = "";
	private totalTasks = 0;
	private taskOutputs: Map<string, string> = new Map();
	private iteration = 0;
	private mounted = false;
	/** AC-4: Tracks user-controlled visibility — toggled without interrupting the build. */
	private visible = true;
	/** Last snapshot of tasks so toggle-on can re-render without a new update. */
	private lastTasks: ExecutorTask[] = [];

	constructor(private ctx: DashboardContext) {}

	mount(): void {
		this.mounted = true;
		this.visible = true;
		this.render([]);
	}

	unmount(): void {
		this.mounted = false;
		// Clear widget by passing undefined
		this.ctx.ui.setWidget(WIDGET_KEY, undefined);
	}

	/**
	 * AC-4: Toggle dashboard visibility without stopping the build.
	 * When hidden the widget is cleared; when shown it re-renders from the
	 * last known task snapshot so no data is lost.
	 */
	toggle(): void {
		if (!this.mounted) return;
		this.visible = !this.visible;
		if (this.visible) {
			this.render(this.lastTasks);
		} else {
			this.ctx.ui.setWidget(WIDGET_KEY, undefined);
		}
	}

	/** Returns whether the dashboard is currently shown. */
	isVisible(): boolean {
		return this.visible;
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
		// Keep snapshot so toggle-on can re-render without a new update.
		this.lastTasks = tasks;
		// AC-4: skip rendering while hidden
		if (!this.visible) return;

		const total = tasks.length || this.totalTasks;
		const done = tasks.filter((t) => t.status === "done").length;
		const _inProgress = tasks.filter((t) => t.status === "in-progress");
		const blocked = tasks.filter((t) => t.status === "blocked").length;
		const pending = tasks.filter((t) => t.status === "pending").length;
		const failed = tasks.filter((t) => t.status === "failed").length;

		// AC-2: Show all task IDs/names/statuses, cap visible rows to keep widget compact
		const allTasksForDisplay = tasks.slice(0, 8);

		const width = 60;
		const border = "═".repeat(width - 2);

		// AC-2: Header with wave number
		const lines = [
			`╔${border}╗`,
			`║ CaveKit Build Dashboard${" ".repeat(width - 26)}║`,
			`║ ${this.waveName.padEnd(width - 4)} ║`,
			`║${" ".repeat(width - 2)}║`,
		];

		// AC-2: Task rows showing ID, name, and status symbol
		for (const task of allTasksForDisplay) {
			const statusSymbol = statusIcon(task.status);
			const bar = task.status === "in-progress" ? ` ${progressBar(task.iterations, task.complexity)}` : "";
			const label = `${task.id} ${task.name}`.slice(0, 30).padEnd(30);
			const rowBar = bar.padEnd(10);
			lines.push(`║ ${statusSymbol} ${label}${rowBar}║`);
		}

		if (allTasksForDisplay.length === 0) {
			lines.push(`║  (no tasks)${" ".repeat(width - 13)}║`);
		}

		if (tasks.length > 8) {
			const more = `  … and ${tasks.length - 8} more`;
			lines.push(`║${more.padEnd(width - 2)}║`);
		}

		lines.push(`║${" ".repeat(width - 2)}║`);

		// AC-3: Aggregate progress line
		const progressLine = ` ✓ ${done}/${total} done  ✗ ${blocked} blocked  ⊘ ${failed} failed  ○ ${pending} pending  iter ${this.iteration}`;
		lines.push(`║${progressLine.padEnd(width - 2)}║`);
		lines.push(`╚${border}╝`);

		// AC-1: Push update to TUI
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

function statusIcon(status: string): string {
	switch (status) {
		case "done":
			return "✓";
		case "in-progress":
			return "●";
		case "blocked":
			return "✗";
		case "failed":
			return "⊘";
		default:
			return "○";
	}
}
