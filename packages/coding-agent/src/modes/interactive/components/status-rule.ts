import { Container, Text, type TUI, truncateToWidth, visibleWidth } from "@cave/tui";
import { FACES } from "../content/faces.js";
import { VERBS } from "../content/verbs.js";
import { theme } from "../theme/theme.js";

export interface StatusRuleSettings {
	position?: "top" | "bottom";
	showFaceTicker?: boolean;
	contextBarCells?: number;
	showCost?: boolean;
	showDuration?: boolean;
}

export interface SpawnHudState {
	depth: number;
	depthCap: number;
	concurrency: number;
	concurrencyCap: number;
	extraActive?: number;
	paused?: boolean;
}

export interface StatusRuleSnapshot {
	thinking?: boolean;
	turnStartMs?: number;
	sessionStartMs?: number;
	modelLabel?: string;
	contextUsed?: number;
	contextMax?: number;
	costUsd?: number;
	bgTaskCount?: number;
	cwdLabel?: string;
	spawn?: SpawnHudState;
}

export class StatusRuleComponent extends Container {
	private snapshot: StatusRuleSnapshot = {};
	private faceIndex = 0;
	private verbIndex = 0;
	private faceTimer: NodeJS.Timeout | null = null;
	private clockTimer: NodeJS.Timeout | null = null;
	private label: Text;
	private settings: Required<StatusRuleSettings>;

	constructor(
		private readonly ui: TUI,
		settings: StatusRuleSettings = {},
	) {
		super();
		this.settings = {
			position: settings.position ?? "bottom",
			showFaceTicker: settings.showFaceTicker ?? true,
			contextBarCells: settings.contextBarCells ?? 10,
			showCost: settings.showCost ?? true,
			showDuration: settings.showDuration ?? true,
		};
		this.label = new Text("", 1, 0);
		this.addChild(this.label);
		this.startTimers();
	}

	updateSettings(patch: Partial<StatusRuleSettings>): void {
		this.settings = { ...this.settings, ...patch };
		this.refresh();
	}

	setSnapshot(patch: Partial<StatusRuleSnapshot>): void {
		this.snapshot = { ...this.snapshot, ...patch };
		this.refresh();
	}

	dispose(): void {
		if (this.faceTimer) clearInterval(this.faceTimer);
		if (this.clockTimer) clearInterval(this.clockTimer);
		this.faceTimer = null;
		this.clockTimer = null;
	}

	render(width: number): string[] {
		this.label.setText(this.compose(width));
		return super.render(width);
	}

	private startTimers(): void {
		this.faceTimer = setInterval(() => {
			this.faceIndex = (this.faceIndex + 1) % FACES.length;
			this.verbIndex = (this.verbIndex + 1) % VERBS.length;
			this.refresh();
		}, 2500);
		this.clockTimer = setInterval(() => {
			this.refresh();
		}, 1000);
	}

	private refresh(): void {
		this.label.invalidate();
		this.ui.requestRender();
	}

	private compose(width: number): string {
		const segments: string[] = [];
		if (this.settings.showFaceTicker && this.snapshot.thinking) {
			segments.push(this.faceSegment());
		}
		if (this.snapshot.modelLabel) {
			segments.push(theme.fg("muted", this.snapshot.modelLabel));
		}
		const ctx = this.contextSegment();
		if (ctx) segments.push(ctx);
		if (this.settings.showDuration && this.snapshot.sessionStartMs !== undefined) {
			segments.push(theme.fg("dim", formatDuration(Date.now() - this.snapshot.sessionStartMs)));
		}
		const spawn = this.spawnSegment();
		if (spawn) segments.push(spawn);
		if (this.snapshot.bgTaskCount && this.snapshot.bgTaskCount > 0) {
			segments.push(theme.fg("muted", `${this.snapshot.bgTaskCount} bg`));
		}
		if (this.settings.showCost && this.snapshot.costUsd !== undefined) {
			segments.push(theme.fg("dim", `$${this.snapshot.costUsd.toFixed(4)}`));
		}

		const sep = ` ${theme.fg("border", "│")} `;
		const left = segments.filter(Boolean).join(sep);
		const cwd = this.snapshot.cwdLabel ? theme.fg("dim", this.snapshot.cwdLabel) : "";

		// Compose into single line with hyphen rule and right-aligned cwd.
		const ruleEdge = theme.fg("border", "─");
		const leftPart = left ? `${ruleEdge} ${left} ${ruleEdge}` : ruleEdge;
		const leftWidth = visibleWidth(leftPart);
		const cwdWidth = visibleWidth(cwd);
		if (leftWidth + 1 + cwdWidth > width) {
			return truncateToWidth(`${leftPart} ${cwd}`, width, "…");
		}
		const padding = Math.max(1, width - leftWidth - cwdWidth - 1);
		return `${leftPart}${" ".repeat(padding)}${cwd}`;
	}

	private faceSegment(): string {
		const face = FACES[this.faceIndex];
		const verb = VERBS[this.verbIndex];
		const elapsed = this.snapshot.turnStartMs ? formatShort(Date.now() - this.snapshot.turnStartMs) : "";
		const verbLine = elapsed ? `${verb}… · ${elapsed}` : `${verb}…`;
		return `${theme.fg("accent", face)} ${theme.fg("dim", verbLine)}`;
	}

	private contextSegment(): string | undefined {
		const used = this.snapshot.contextUsed;
		const max = this.snapshot.contextMax;
		if (used === undefined || max === undefined || max <= 0) return undefined;
		const pct = Math.min(100, Math.round((used / max) * 100));
		const cells = this.settings.contextBarCells;
		const filled = Math.round((pct / 100) * cells);
		const bar = `${"█".repeat(filled)}${"░".repeat(Math.max(0, cells - filled))}`;
		const colorKey: "success" | "warning" | "error" =
			pct >= 95 ? "error" : pct >= 80 ? "warning" : pct >= 50 ? "warning" : "success";
		const tokens = `${formatTokens(used)}/${formatTokens(max)}`;
		const barStyled = theme.fg(colorKey, `[${bar}]`);
		return `${theme.fg("dim", tokens)} ${barStyled} ${theme.fg(colorKey, `${pct}%`)}`;
	}

	private spawnSegment(): string | undefined {
		const s = this.snapshot.spawn;
		if (!s) return undefined;
		if (s.depth === 0 && (s.concurrency === 0 || s.concurrency === undefined) && !s.paused) {
			return undefined;
		}
		const depthRatio = s.depthCap > 0 ? s.depth / s.depthCap : 0;
		const concRatio = s.concurrencyCap > 0 ? s.concurrency / s.concurrencyCap : 0;
		const ratio = Math.max(depthRatio, concRatio);
		const colorKey: "success" | "warning" | "error" = ratio >= 1 ? "error" : ratio >= 0.7 ? "warning" : "success";
		const warn = ratio >= 1 ? "⚠ " : "";
		const extra = s.extraActive && s.extraActive > 0 ? `+${s.extraActive}` : "";
		const paused = s.paused ? " ⏸" : "";
		return theme.fg(
			colorKey,
			`${warn}d${s.depth}/${s.depthCap} ⚡${s.concurrency}/${s.concurrencyCap}${extra}${paused}`,
		);
	}
}

function formatTokens(n: number): string {
	if (n < 1000) return `${n}`;
	if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
	if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
	if (n < 10_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	return `${Math.round(n / 1_000_000)}M`;
}

function formatShort(ms: number): string {
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	const rs = s % 60;
	return `${m}m ${rs}s`;
}

function formatDuration(ms: number): string {
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	const rs = s % 60;
	if (m < 60) return `${m}m ${rs.toString().padStart(2, "0")}s`;
	const h = Math.floor(m / 60);
	const rm = m % 60;
	return `${h}h ${rm.toString().padStart(2, "0")}m`;
}
