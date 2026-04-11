/**
 * Two-pane markdown review overlay for CK phase gates.
 *
 * Replaces the old confirm()-based kit reviewer and tier gate overlays with a
 * rich, scrollable, navigable review surface. Shows rendered markdown in the
 * left pane and metadata/status in the right pane.
 *
 * Invoked via ctx.ui.custom() with overlay: true.
 */

import { type Component, Markdown, type MarkdownTheme, matchesKey, truncateToWidth, visibleWidth } from "@cave/tui";
import type { ExtensionUIContext, getMarkdownTheme as GetMarkdownThemeFn, Theme } from "cave";
import type { ReviewItem, ReviewItemStatus, ReviewResult } from "../types.js";

// Re-export for callers
export type { ReviewItem, ReviewItemStatus, ReviewResult };

const ANSI_RESET = "\x1b[0m";

/** Status indicator characters. */
const STATUS_ICON: Record<ReviewItemStatus, string> = {
	pending: "○",
	approved: "✓",
	rejected: "✗",
	skipped: "–",
};

// ---------------------------------------------------------------------------
// ReviewPaneComponent
// ---------------------------------------------------------------------------

interface ReviewPaneOptions {
	title?: string;
	allowSkip?: boolean;
}

export class ReviewPaneComponent implements Component {
	private items: ReviewItem[];
	private currentIndex = 0;
	private activePane: "left" | "right" = "left";
	private leftScroll = 0;
	private rightScroll = 0;
	private done: (result: ReviewResult) => void;
	private theme: Theme;
	private mdTheme: MarkdownTheme;
	private termRows: number;
	private title: string;
	private allowSkip: boolean;

	// Markdown component reused across items — setText() swaps content.
	private md: Markdown;

	constructor(
		items: ReviewItem[],
		theme: Theme,
		termRows: number,
		getMarkdownTheme: typeof GetMarkdownThemeFn,
		done: (result: ReviewResult) => void,
		options?: ReviewPaneOptions,
	) {
		this.items = items;
		this.theme = theme;
		this.mdTheme = getMarkdownTheme();
		this.termRows = termRows;
		this.done = done;
		this.title = options?.title ?? "Review";
		this.allowSkip = options?.allowSkip ?? true;

		// Create a Markdown instance for the left pane.
		this.md = new Markdown(items[0]?.markdownContent ?? "", 0, 0, this.mdTheme);
	}

	invalidate(): void {
		this.md.invalidate();
	}

	// -----------------------------------------------------------------------
	// Render
	// -----------------------------------------------------------------------

	render(width: number): string[] {
		const lines: string[] = [];
		const item = this.items[this.currentIndex];
		if (!item) return ["(no items)"];

		// Compute dimensions
		const bodyHeight = Math.max(4, Math.floor(this.termRows * 0.85) - 6); // 6 = header(2) + borders(2) + action bar(2)
		const sepChar = this.activePane === "left" ? "┃" : "│";
		const leftW = Math.max(10, Math.floor((width - 3) * 0.6));
		const rightW = Math.max(10, width - leftW - 3); // 3 = "│" + border chars

		// ── Tab bar ──
		lines.push(this.renderTabBar(width));

		// ── Summary bar ──
		lines.push(this.renderSummaryBar(width));

		// ── Top border ──
		lines.push(this.theme.fg("dim", `${"─".repeat(leftW + 1)}┬${"─".repeat(rightW + 1)}`).slice(0, width) || "");

		// ── Body: two-pane ──
		// Left pane: rendered markdown
		this.md.setText(item.markdownContent);
		const leftAllLines = this.md.render(leftW);
		const leftVisible = leftAllLines.slice(this.leftScroll, this.leftScroll + bodyHeight);

		// Right pane: metadata + status
		const rightAllLines = this.renderRightPane(item, rightW);
		const rightVisible = rightAllLines.slice(this.rightScroll, this.rightScroll + bodyHeight);

		for (let i = 0; i < bodyHeight; i++) {
			const lRaw = leftVisible[i] ?? "";
			const rRaw = rightVisible[i] ?? "";

			// Truncate each half to its column width
			const lTrunc = visibleWidth(lRaw) > leftW ? truncateToWidth(lRaw, leftW) : lRaw;
			const rTrunc = visibleWidth(rRaw) > rightW ? truncateToWidth(rRaw, rightW) : rRaw;

			// Pad to fill column
			const lPad = " ".repeat(Math.max(0, leftW - visibleWidth(lTrunc)));
			const rPad = " ".repeat(Math.max(0, rightW - visibleWidth(rTrunc)));

			const sep = this.theme.fg("dim", sepChar);
			const line = ` ${lTrunc}${ANSI_RESET}${lPad}${sep}${rTrunc}${ANSI_RESET}${rPad} `;

			// Safety: ensure line fits width
			if (visibleWidth(line) > width) {
				lines.push(truncateToWidth(line, width));
			} else {
				lines.push(line);
			}
		}

		// ── Scroll indicators ──
		const leftMax = Math.max(0, leftAllLines.length - bodyHeight);
		const rightMax = Math.max(0, rightAllLines.length - bodyHeight);
		const leftPct = leftMax > 0 ? `${Math.round((this.leftScroll / leftMax) * 100)}%` : "top";
		const rightPct = rightMax > 0 ? `${Math.round((this.rightScroll / rightMax) * 100)}%` : "top";
		const scrollInfo = this.theme.fg("dim", ` scroll: L ${leftPct}  R ${rightPct}`);
		lines.push(this.theme.fg("dim", `${"─".repeat(leftW + 1)}┴${"─".repeat(rightW + 1)}`).slice(0, width) || "");

		// ── Action bar ──
		lines.push(this.renderActionBar(width, scrollInfo));

		return lines;
	}

	// -----------------------------------------------------------------------
	// Tab bar
	// -----------------------------------------------------------------------

	private renderTabBar(width: number): string {
		const parts: string[] = [];
		for (let i = 0; i < this.items.length; i++) {
			const item = this.items[i];
			const icon = STATUS_ICON[item.status];
			const label = `${icon} ${item.title}`;
			if (i === this.currentIndex) {
				parts.push(this.theme.fg("accent", this.theme.bold(label)));
			} else {
				parts.push(this.theme.fg("dim", label));
			}
		}

		const nav = this.items.length > 1 ? "◀ " : "  ";
		const navEnd = this.items.length > 1 ? " ▶" : "  ";
		const raw = `${nav}${parts.join(this.theme.fg("dim", " │ "))}${navEnd}`;
		return visibleWidth(raw) > width ? truncateToWidth(raw, width) : raw;
	}

	// -----------------------------------------------------------------------
	// Summary bar
	// -----------------------------------------------------------------------

	private renderSummaryBar(width: number): string {
		const total = this.items.length;
		const approved = this.items.filter((i) => i.status === "approved").length;
		const rejected = this.items.filter((i) => i.status === "rejected").length;
		const pending = this.items.filter((i) => i.status === "pending").length;
		const skipped = this.items.filter((i) => i.status === "skipped").length;
		const reviewed = total - pending;

		const parts = [
			`${reviewed}/${total} reviewed`,
			approved > 0 ? this.theme.fg("success", `✓${approved}`) : "",
			rejected > 0 ? this.theme.fg("error", `✗${rejected}`) : "",
			skipped > 0 ? this.theme.fg("dim", `–${skipped}`) : "",
			pending > 0 ? this.theme.fg("dim", `○${pending}`) : "",
		].filter(Boolean);

		const raw = ` ${this.theme.fg("muted", this.title)}  ${parts.join("  ")}`;
		return visibleWidth(raw) > width ? truncateToWidth(raw, width) : raw;
	}

	// -----------------------------------------------------------------------
	// Right pane
	// -----------------------------------------------------------------------

	private renderRightPane(item: ReviewItem, maxWidth: number): string[] {
		const lines: string[] = [];
		const w = maxWidth;

		// Status
		const statusLabel = item.status.toUpperCase();
		const statusColor = item.status === "approved" ? "success" : item.status === "rejected" ? "error" : "dim";
		lines.push(this.theme.fg(statusColor as any, ` ${STATUS_ICON[item.status]} ${statusLabel}`));
		lines.push("");

		// Metadata
		if (item.metadata.length > 0) {
			lines.push(this.theme.fg("accent", " Metadata"));
			lines.push(this.theme.fg("dim", ` ${"─".repeat(Math.max(1, w - 2))}`));
			for (const { label, value } of item.metadata) {
				const labelStr = this.theme.fg("muted", ` ${label}:`);
				lines.push(labelStr);
				// Wrap long values
				const valLines = this.wrapText(value, Math.max(5, w - 3));
				for (const vl of valLines) {
					lines.push(`  ${vl}`);
				}
			}
		}

		// File path
		if (item.filePath) {
			lines.push("");
			lines.push(this.theme.fg("dim", ` File: ${item.filePath}`));
		}

		// Instructions
		lines.push("");
		lines.push("");
		lines.push(this.theme.fg("dim", " Keys:"));
		lines.push(this.theme.fg("dim", "  a  approve"));
		lines.push(this.theme.fg("dim", "  r  reject"));
		if (this.allowSkip) {
			lines.push(this.theme.fg("dim", "  s  skip"));
		}
		lines.push(this.theme.fg("dim", "  n/p  next/prev"));
		lines.push(this.theme.fg("dim", "  Tab  switch pane"));
		lines.push(this.theme.fg("dim", "  ↑/↓  scroll"));
		lines.push(this.theme.fg("dim", "  Esc  done"));

		return lines;
	}

	// -----------------------------------------------------------------------
	// Action bar
	// -----------------------------------------------------------------------

	private renderActionBar(width: number, scrollInfo: string): string {
		const actions = [`${this.theme.fg("success", "[a]")} Approve`, `${this.theme.fg("error", "[r]")} Reject`];
		if (this.allowSkip) {
			actions.push(`${this.theme.fg("dim", "[s]")} Skip`);
		}
		if (this.items.length > 1) {
			actions.push(`${this.theme.fg("dim", "[n/p]")} Nav`);
		}
		actions.push(`${this.theme.fg("dim", "[Esc]")} Done`);

		const raw = ` ${actions.join("  ")}  ${scrollInfo}`;
		return visibleWidth(raw) > width ? truncateToWidth(raw, width) : raw;
	}

	// -----------------------------------------------------------------------
	// Input handling
	// -----------------------------------------------------------------------

	handleInput(data: string): void {
		const item = this.items[this.currentIndex];
		if (!item) return;

		// Actions
		if (data === "a") {
			item.status = "approved";
			this.advanceToNextPending();
			return;
		}
		if (data === "r") {
			item.status = "rejected";
			this.advanceToNextPending();
			return;
		}
		if (data === "s" && this.allowSkip) {
			item.status = "skipped";
			this.advanceToNextPending();
			return;
		}

		// Navigation between items
		if (data === "n" || matchesKey(data, "right") || data === "l") {
			this.navigateTo(this.currentIndex + 1);
			return;
		}
		if (data === "p" || matchesKey(data, "left") || data === "h") {
			this.navigateTo(this.currentIndex - 1);
			return;
		}

		// Number keys for direct jump
		if (data >= "1" && data <= "9") {
			const idx = parseInt(data, 10) - 1;
			if (idx < this.items.length) {
				this.navigateTo(idx);
			}
			return;
		}

		// Pane switching
		if (data === "\t" || matchesKey(data, "tab")) {
			this.activePane = this.activePane === "left" ? "right" : "left";
			return;
		}

		// Scrolling
		if (matchesKey(data, "up") || data === "k") {
			this.scroll(-1);
			return;
		}
		if (matchesKey(data, "down") || data === "j") {
			this.scroll(1);
			return;
		}
		if (matchesKey(data, "pageUp")) {
			this.scroll(-(Math.floor(this.termRows * 0.85) - 8));
			return;
		}
		if (matchesKey(data, "pageDown")) {
			this.scroll(Math.floor(this.termRows * 0.85) - 8);
			return;
		}

		// Dismiss
		if (matchesKey(data, "escape")) {
			const allReviewed = this.items.every((i) => i.status !== "pending");
			this.done({
				items: this.items.map((i) => ({ id: i.id, status: i.status })),
				dismissed: !allReviewed,
			});
		}
	}

	// -----------------------------------------------------------------------
	// Helpers
	// -----------------------------------------------------------------------

	private navigateTo(index: number): void {
		if (this.items.length === 0) return;
		// Wrap around
		if (index < 0) index = this.items.length - 1;
		if (index >= this.items.length) index = 0;
		this.currentIndex = index;
		this.leftScroll = 0;
		this.rightScroll = 0;
	}

	private advanceToNextPending(): void {
		// Try to find next pending item
		for (let offset = 1; offset <= this.items.length; offset++) {
			const idx = (this.currentIndex + offset) % this.items.length;
			if (this.items[idx].status === "pending") {
				this.navigateTo(idx);
				return;
			}
		}
		// All reviewed — auto-dismiss
		this.done({
			items: this.items.map((i) => ({ id: i.id, status: i.status })),
			dismissed: false,
		});
	}

	private scroll(delta: number): void {
		if (this.activePane === "left") {
			this.leftScroll = Math.max(0, this.leftScroll + delta);
		} else {
			this.rightScroll = Math.max(0, this.rightScroll + delta);
		}
	}

	private wrapText(text: string, maxWidth: number): string[] {
		if (visibleWidth(text) <= maxWidth) return [text];
		const words = text.split(/\s+/);
		const lines: string[] = [];
		let current = "";
		for (const word of words) {
			const test = current ? `${current} ${word}` : word;
			if (visibleWidth(test) > maxWidth && current) {
				lines.push(current);
				current = word;
			} else {
				current = test;
			}
		}
		if (current) lines.push(current);
		return lines;
	}
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface ReviewOverlayContext {
	ui: Pick<ExtensionUIContext, "confirm" | "notify"> & Partial<Pick<ExtensionUIContext, "custom">>;
}

export async function showReviewOverlay(
	items: ReviewItem[],
	ctx: ReviewOverlayContext,
	options?: ReviewPaneOptions,
): Promise<ReviewResult> {
	if (items.length === 0) {
		return { items: [], dismissed: false };
	}

	// Detect if custom() is available (not present in RPC/print mode).
	if (!ctx.ui.custom) {
		// Fallback: simple confirm() loop for non-interactive modes.
		return fallbackReview(items, ctx, options);
	}

	// Import getMarkdownTheme dynamically to avoid circular deps at module load.
	const { getMarkdownTheme } = await import("cave");

	return ctx.ui.custom<ReviewResult>(
		(tui, theme, _kb, done) => {
			return new ReviewPaneComponent(items, theme, tui.terminal.rows, getMarkdownTheme, done, options);
		},
		{
			overlay: true,
			overlayOptions: {
				width: "90%",
				maxHeight: "85%",
				anchor: "center",
				margin: 2,
			},
		},
	);
}

// ---------------------------------------------------------------------------
// Fallback for non-interactive modes
// ---------------------------------------------------------------------------

async function fallbackReview(
	items: ReviewItem[],
	ctx: ReviewOverlayContext,
	_options?: ReviewPaneOptions,
): Promise<ReviewResult> {
	for (const item of items) {
		const approved = await ctx.ui.confirm(`Review: ${item.title}`, item.markdownContent);
		item.status = approved ? "approved" : "rejected";
	}
	return {
		items: items.map((i) => ({ id: i.id, status: i.status })),
		dismissed: false,
	};
}
