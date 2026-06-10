/**
 * Subagent observability overlay.
 *
 * F2 toggles a live tree of running subagents (current tool, token spend,
 * elapsed). Until WS6 ships the Task tool + global subagent registry this
 * overlay subscribes to a no-op registry that emits an empty snapshot. Once
 * WS6 lands, `setRegistry()` will receive a real registry and the overlay
 * begins rendering rows.
 */
import { formatElapsed } from "../format-elapsed.js";
import type { Component } from "../tui.js";
import { visibleWidth } from "../utils.js";

export { formatElapsed };

export interface SubagentSnapshot {
	id: string;
	name: string;
	currentTool?: string;
	tokensIn: number;
	tokensOut: number;
	elapsedMs: number;
	status: "running" | "done" | "error" | "queued";
	depth?: number;
}

export interface SubagentRegistry {
	/** Read current snapshot of every active subagent. WS6 wires this. */
	list(): SubagentSnapshot[];
	/** Subscribe to changes. Returns an unsubscribe function. */
	subscribe(listener: () => void): () => void;
}

/** Empty registry used until WS6 lands the Task tool. */
export const NULL_SUBAGENT_REGISTRY: SubagentRegistry = {
	list: () => [],
	subscribe: () => () => {},
};

export interface SubagentOverlayTheme {
	border: (text: string) => string;
	header: (text: string) => string;
	row: (text: string) => string;
	muted: (text: string) => string;
	accent: (text: string) => string;
	error: (text: string) => string;
}

const IDENTITY: SubagentOverlayTheme = {
	border: (s) => s,
	header: (s) => s,
	row: (s) => s,
	muted: (s) => s,
	accent: (s) => s,
	error: (s) => s,
};

export interface SubagentOverlayOptions {
	registry?: SubagentRegistry;
	theme?: SubagentOverlayTheme;
	maxRows?: number;
}

export class SubagentOverlay implements Component {
	private registry: SubagentRegistry;
	private theme: SubagentOverlayTheme;
	private maxRows: number;
	private unsubscribe?: () => void;
	private redraw?: () => void;

	constructor(options: SubagentOverlayOptions = {}) {
		this.registry = options.registry ?? NULL_SUBAGENT_REGISTRY;
		this.theme = options.theme ?? IDENTITY;
		this.maxRows = options.maxRows ?? 12;
	}

	/** Wire a new registry (e.g. when WS6 lands and registers the real one). */
	setRegistry(registry: SubagentRegistry): void {
		if (this.unsubscribe) this.unsubscribe();
		this.registry = registry;
		this.unsubscribe = registry.subscribe(() => this.redraw?.());
	}

	/** Bind a redraw callback so registry events trigger a TUI re-render. */
	bindRedraw(redraw: () => void): void {
		this.redraw = redraw;
		if (!this.unsubscribe) {
			this.unsubscribe = this.registry.subscribe(() => this.redraw?.());
		}
	}

	dispose(): void {
		if (this.unsubscribe) this.unsubscribe();
		this.unsubscribe = undefined;
		this.redraw = undefined;
	}

	invalidate(): void {
		// Stateless render — nothing to clear.
	}

	render(width: number): string[] {
		const snapshot = this.registry.list();
		if (snapshot.length === 0) {
			return [
				this.theme.header(this.padRight("Subagents", width)),
				this.theme.muted(this.padRight("(none running — F2 to dismiss)", width)),
			];
		}

		const rows: string[] = [];
		rows.push(this.theme.header(this.padRight(`Subagents (${snapshot.length})`, width)));

		const visible = snapshot.slice(0, this.maxRows);
		for (const sa of visible) {
			rows.push(this.formatRow(sa, width));
		}
		if (snapshot.length > this.maxRows) {
			rows.push(this.theme.muted(this.padRight(`… +${snapshot.length - this.maxRows} more`, width)));
		}
		return rows;
	}

	private formatRow(sa: SubagentSnapshot, width: number): string {
		const indent = "  ".repeat(sa.depth ?? 0);
		const status = this.statusBadge(sa.status);
		const tool = sa.currentTool ? `[${sa.currentTool}]` : "";
		const tokens = `${sa.tokensIn}/${sa.tokensOut}`;
		const elapsed = formatElapsed(sa.elapsedMs);
		const left = `${indent}${status} ${sa.name} ${tool}`;
		const right = `${tokens} ${elapsed}`;
		return this.theme.row(this.layoutRow(left, right, width));
	}

	private statusBadge(status: SubagentSnapshot["status"]): string {
		switch (status) {
			case "running":
				return this.theme.accent("●");
			case "done":
				return this.theme.muted("○");
			case "error":
				return this.theme.error("✗");
			case "queued":
				return this.theme.muted("◌");
		}
	}

	private layoutRow(left: string, right: string, width: number): string {
		const leftW = visibleWidth(left);
		const rightW = visibleWidth(right);
		const gap = Math.max(1, width - leftW - rightW);
		if (leftW + rightW + 1 > width) {
			// Truncate left to make room.
			return `${this.truncateVisible(left, Math.max(0, width - rightW - 1))} ${right}`;
		}
		return `${left}${" ".repeat(gap)}${right}`;
	}

	private truncateVisible(s: string, max: number): string {
		if (visibleWidth(s) <= max) return s;
		// Coarse truncation; ANSI-aware truncation lives in utils but for the
		// overlay row we never embed ANSI (theme is applied to the whole row).
		return `${s.slice(0, Math.max(0, max - 1))}…`;
	}

	private padRight(s: string, width: number): string {
		const w = visibleWidth(s);
		if (w >= width) return s;
		return s + " ".repeat(width - w);
	}
}
