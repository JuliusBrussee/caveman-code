import { Container, Text, truncateToWidth } from "@cave/tui";
import { theme } from "../theme/theme.js";
import type { ToolExecutionComponent } from "./tool-execution.js";

export interface ShelfItem {
	name: string;
	durationMs?: number;
	failed?: boolean;
}

export interface ToolShelfState {
	items: ShelfItem[];
	expanded: boolean;
	totalDurationMs?: number;
}

/**
 * One-line collapsed view of a sequential tool-call run. Owners (the streaming
 * assistant component) toggle `expanded` via setState and re-attach the per-tool
 * components when expanded; the shelf renders only the collapsed line.
 */
export class ToolShelfComponent extends Container {
	private state: ToolShelfState = { items: [], expanded: false };
	private label: Text;

	constructor() {
		super();
		this.label = new Text("", 1, 0);
		this.addChild(this.label);
	}

	setState(state: ToolShelfState): void {
		this.state = state;
		this.refresh();
	}

	getState(): ToolShelfState {
		return this.state;
	}

	render(width: number): string[] {
		this.refresh(width);
		return super.render(width);
	}

	private refresh(width?: number): void {
		if (this.state.expanded || this.state.items.length === 0) {
			this.label.setText("");
			return;
		}
		const cols = width ?? process.stdout.columns ?? 80;
		const budget = Math.max(20, cols - 4);
		const count = this.state.items.length;
		const failedCount = this.state.items.filter((i) => i.failed).length;
		const head = `${theme.fg("accent", "▸")} ${theme.bold(`${count} tools`)}`;
		const names = this.state.items.map((i) => i.name).slice(0, 6);
		const namePart = names.join(" · ");
		const more = count > names.length ? ` +${count - names.length}` : "";
		const duration =
			this.state.totalDurationMs !== undefined
				? `  ${theme.fg("dim", `(${formatShort(this.state.totalDurationMs)})`)}`
				: "";
		const failedPart = failedCount > 0 ? theme.fg("error", `  ${failedCount} failed`) : "";
		const compactPart = `${head} · ${theme.fg("muted", `${namePart}${more}`)}${duration}${failedPart}`;
		const truncated = truncateToWidth(compactPart, budget, "…");
		this.label.setText(truncated);
	}
}

function formatShort(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const s = ms / 1000;
	if (s < 10) return `${s.toFixed(1)}s`;
	return `${Math.round(s)}s`;
}

/**
 * Wraps a sequence of tool executions inside a single assistant turn so the
 * UI can show a collapsed one-line shelf for `>= 2` tools and expand to the
 * familiar inline view on demand. Singleton turns (one tool) render expanded
 * so the shelf never adds visual noise where it would not save space.
 */
export class ToolGroupShellComponent extends Container {
	private readonly shelf = new ToolShelfComponent();
	private readonly toolsContainer = new Container();
	private readonly entries: { name: string; component: ToolExecutionComponent }[] = [];
	private expanded = true;

	constructor() {
		super();
		this.refresh();
	}

	addTool(name: string, component: ToolExecutionComponent): void {
		this.entries.push({ name, component });
		this.toolsContainer.addChild(component as unknown as import("@cave/tui").Component);
		this.refresh();
	}

	/**
	 * Called when the assistant turn finishes. Hides the tool group entirely —
	 * the footer bar already surfaces cost/token usage.
	 */
	finalize(): void {
		this.expanded = false;
		this.refresh();
	}

	toggleExpanded(): boolean {
		if (this.entries.length < 2) return false;
		this.expanded = !this.expanded;
		this.refresh();
		return true;
	}

	get toolCount(): number {
		return this.entries.length;
	}

	private refresh(): void {
		this.clear();
		if (this.expanded) {
			this.addChild(this.toolsContainer);
		}
		// Finalized (collapsed) state renders nothing — footer shows summary.
	}
}
