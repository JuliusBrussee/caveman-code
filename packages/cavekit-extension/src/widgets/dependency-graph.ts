/**
 * Dependency graph visualization — ASCII/Unicode render of the build-site task graph.
 *
 * T-038 (extension-ui/R4):
 * AC-1: Tasks grouped by tier with dependency edges.
 * AC-2: Each node shows task ID and name.
 * AC-3: Edges are directional (dependency → dependent).
 */

import type { ExecutorTask } from "../wave/executor.js";

export interface DependencyGraphContext {
	ui: {
		notify: (message: string, type?: "info" | "warning" | "error") => void;
	};
	say?: (text: string) => void;
}

/**
 * Render the dependency graph and display it via ctx.ui.notify / ctx.say.
 *
 * The graph is laid out as a left-to-right tier grid:
 *
 *   ┌─────────────────────────────────────────────┐
 *   │  Tier 0         │  Tier 1        │  Tier 2  │
 *   │                 │                │          │
 *   │  ┌─────────┐    │  ┌─────────┐   │  ┌────┐  │
 *   │  │ T-001   │────┼─▶│ T-003   │───┼─▶│T-005│ │
 *   │  │ Setup   │    │  │ Build   │   │  │Done│  │
 *   │  └─────────┘    │  └─────────┘   │  └────┘  │
 *   │  ┌─────────┐    │                │          │
 *   │  │ T-002   │────┘                │          │
 *   │  │ Config  │                     │          │
 *   │  └─────────┘                     │          │
 *   └─────────────────────────────────────────────┘
 *
 * For large graphs (>20 tasks) a compact text-list format is used instead.
 */
export function renderDependencyGraph(tasks: ExecutorTask[], ctx: DependencyGraphContext): void {
	if (tasks.length === 0) {
		ctx.ui.notify("Dependency graph: no tasks to display.", "info");
		return;
	}

	const lines = tasks.length <= 20 ? buildBoxGraph(tasks) : buildCompactGraph(tasks);

	const output = lines.join("\n");

	// Prefer ctx.say for multi-line output so it appears in the chat thread
	if (ctx.say) {
		ctx.say(output);
	} else {
		// Fallback: emit one notify per "screen" of lines (notify is typically single-line)
		ctx.ui.notify(output, "info");
	}
}

/**
 * Return the rendered graph lines for use in tests or custom display logic.
 * Wraps buildBoxGraph / buildCompactGraph based on task count.
 */
export function buildDependencyGraphLines(tasks: ExecutorTask[]): string[] {
	if (tasks.length === 0) return ["(no tasks)"];
	return tasks.length <= 20 ? buildBoxGraph(tasks) : buildCompactGraph(tasks);
}

// ---------------------------------------------------------------------------
// Box graph — full ASCII box-drawing layout
// ---------------------------------------------------------------------------

const NODE_W = 12; // inner width of each node box (chars)
const COL_GAP = 5; // chars between tier columns

/**
 * AC-1: Build a box-drawing graph with tasks grouped by tier.
 * AC-2: Each node box shows the task ID and truncated name.
 * AC-3: Edges are drawn with ── and ▶ arrow to indicate direction.
 */
function buildBoxGraph(tasks: ExecutorTask[]): string[] {
	// Group tasks by tier (AC-1)
	const tierMap = new Map<number, ExecutorTask[]>();
	for (const task of tasks) {
		const col = tierMap.get(task.tier) ?? [];
		col.push(task);
		tierMap.set(task.tier, col);
	}

	const tiers = [...tierMap.keys()].sort((a, b) => a - b);
	const columns: ExecutorTask[][] = tiers.map((t) => tierMap.get(t)!);

	// Build index from taskId → tier column index for edge routing
	const taskTierIndex = new Map<string, number>();
	for (let ci = 0; ci < tiers.length; ci++) {
		for (const task of columns[ci]) {
			taskTierIndex.set(task.id, ci);
		}
	}

	// Calculate column widths (max node label or tier-header width)
	const colWidths = columns.map((col) => {
		const headerLen = `Tier ${tiers[columns.indexOf(col)]}`.length + 2;
		const maxNodeLen = Math.max(...col.map((t) => nodeLabel(t).length + 4), NODE_W + 4);
		return Math.max(headerLen, maxNodeLen);
	});

	// Height: max tasks per tier * (node height + gap)
	const NODE_H = 3; // lines per node (top border, content, bottom border)
	const ROW_GAP = 1;
	const maxRows = Math.max(...columns.map((c) => c.length));
	const totalNodeRows = maxRows * (NODE_H + ROW_GAP);

	// Build a 2-D char grid
	const totalWidth = colWidths.reduce((s, w) => s + w + COL_GAP, 2);
	const totalHeight = totalNodeRows + 4; // +4 for outer frame + headers

	const grid = Array.from({ length: totalHeight }, () => " ".repeat(totalWidth).split(""));

	// Draw outer frame
	drawHLine(grid, 0, 0, totalWidth - 1, "─", "┌", "┐");
	drawHLine(grid, totalHeight - 1, 0, totalWidth - 1, "─", "└", "┘");
	for (let r = 1; r < totalHeight - 1; r++) {
		setChar(grid, r, 0, "│");
		setChar(grid, r, totalWidth - 1, "│");
	}

	// Draw tier column separators and headers
	let xOffset = 1;
	for (let ci = 0; ci < columns.length; ci++) {
		const w = colWidths[ci];
		// Column separator (except after last column)
		if (ci < columns.length - 1) {
			const sepX = xOffset + w + Math.floor(COL_GAP / 2);
			for (let r = 1; r < totalHeight - 1; r++) {
				setChar(grid, r, sepX, "│");
			}
		}

		// Tier header (row 1)
		const header = `Tier ${tiers[ci]}`;
		writeText(grid, 1, xOffset + Math.floor((w - header.length) / 2), header);

		// Draw nodes
		let nodeY = 3; // start below header + blank row
		for (const task of columns[ci]) {
			const label = nodeLabel(task);
			const nodeW = Math.min(w - 2, NODE_W + 4);
			const nodeX = xOffset + Math.floor((w - nodeW) / 2);
			drawNode(grid, nodeY, nodeX, nodeW, label);
			nodeY += NODE_H + ROW_GAP;
		}

		xOffset += w + COL_GAP;
	}

	// Draw dependency edges (AC-3: directional → )
	xOffset = 1;
	for (let ci = 0; ci < columns.length; ci++) {
		const w = colWidths[ci];

		let nodeY = 3;
		for (const task of columns[ci]) {
			// Find tasks in the next tier that depend on this task
			const dependents = tasks.filter(
				(t) => t.dependencies.includes(task.id) && (taskTierIndex.get(t.id) ?? -1) === ci + 1,
			);

			if (dependents.length > 0 && ci < columns.length - 1) {
				// Mid-row of the source node
				const srcRow = nodeY + 1;
				const srcX = xOffset + w - 1;

				// Draw arrow reaching into next column
				const nextColX = xOffset + w + COL_GAP;
				const arrowEndX = nextColX - 1;

				for (let x = srcX; x <= arrowEndX; x++) {
					setChar(grid, srcRow, x, "─");
				}
				setChar(grid, srcRow, arrowEndX, "▶");
			}

			nodeY += NODE_H + ROW_GAP;
		}

		xOffset += w + COL_GAP;
	}

	// Convert grid to strings and add a title
	const result: string[] = ["", `Dependency Graph — ${tasks.length} task(s) across ${tiers.length} tier(s)`, ""];
	for (const row of grid) {
		result.push(row.join("").trimEnd());
	}

	// AC-3: Legend
	result.push("");
	result.push("  ── ▶  dependency edge (left tier → right tier)");
	result.push("  [ ] task node   │ col separator");

	return result;
}

// ---------------------------------------------------------------------------
// Compact list graph — for large task sets (>20 tasks)
// ---------------------------------------------------------------------------

/**
 * Compact text-based dependency view for large graphs.
 * AC-1: Grouped by tier.  AC-2: shows ID + name.  AC-3: lists deps with arrows.
 */
function buildCompactGraph(tasks: ExecutorTask[]): string[] {
	const tierMap = new Map<number, ExecutorTask[]>();
	for (const task of tasks) {
		const col = tierMap.get(task.tier) ?? [];
		col.push(task);
		tierMap.set(task.tier, col);
	}

	const tiers = [...tierMap.keys()].sort((a, b) => a - b);
	const lines: string[] = [
		"",
		`Dependency Graph (compact) — ${tasks.length} task(s) across ${tiers.length} tier(s)`,
		"",
	];

	for (const tier of tiers) {
		lines.push(`┌─ Tier ${tier} ${"─".repeat(40)}`);
		for (const task of tierMap.get(tier)!) {
			// AC-2: ID + name
			const deps =
				task.dependencies.length > 0
					? `  ← ${task.dependencies.join(", ")}` // AC-3: directional arrow
					: "";
			lines.push(`│  ${task.id}: ${task.name}${deps}`);
		}
		lines.push("│");
	}

	lines.push(`└${"─".repeat(44)}`);
	lines.push("");
	lines.push("  ← indicates dependency (dependent ← dependency)");

	return lines;
}

// ---------------------------------------------------------------------------
// Grid drawing helpers
// ---------------------------------------------------------------------------

function setChar(grid: string[][], row: number, col: number, ch: string): void {
	if (row < 0 || row >= grid.length) return;
	const line = grid[row];
	if (col < 0 || col >= line.length) return;
	line[col] = ch;
}

function writeText(grid: string[][], row: number, startCol: number, text: string): void {
	for (let i = 0; i < text.length; i++) {
		setChar(grid, row, startCol + i, text[i]);
	}
}

function drawHLine(
	grid: string[][],
	row: number,
	x1: number,
	x2: number,
	fill: string,
	left: string,
	right: string,
): void {
	setChar(grid, row, x1, left);
	for (let x = x1 + 1; x < x2; x++) setChar(grid, row, x, fill);
	setChar(grid, row, x2, right);
}

/** Draw a 3-line node box: ┌──┐ / │label│ / └──┘ */
function drawNode(grid: string[][], row: number, col: number, width: number, label: string): void {
	drawHLine(grid, row, col, col + width - 1, "─", "┌", "┐");
	// Middle line with label (AC-2: ID + name, truncated to fit)
	const inner = width - 2;
	const text = label.length > inner ? `${label.slice(0, inner - 1)}…` : label.padEnd(inner);
	setChar(grid, row + 1, col, "│");
	writeText(grid, row + 1, col + 1, text);
	setChar(grid, row + 1, col + width - 1, "│");
	drawHLine(grid, row + 2, col, col + width - 1, "─", "└", "┘");
}

/** Short label for a node box: "T-001 Name" */
function nodeLabel(task: ExecutorTask): string {
	return `${task.id} ${task.name}`;
}
