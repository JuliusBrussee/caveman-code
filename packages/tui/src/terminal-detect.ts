/**
 * Terminal identity and background detection.
 *
 * Covers cavekit-terminal-blend R1 (background luminance detection via OSC 11,
 * COLORFGBG, and CAVE_TERM_BG override) and R2 (terminal program identity).
 */

import type { ProcessTerminal } from "./terminal.js";

export type TerminalProgram =
	| "ghostty"
	| "iterm2"
	| "apple-terminal"
	| "kitty"
	| "wezterm"
	| "alacritty"
	| "vte"
	| "tmux"
	| "screen"
	| "linux-console"
	| "cmux"
	| "windows-terminal"
	| "vscode"
	| "unknown";

export type Multiplexer = "tmux" | "screen" | "none";
export type BackgroundClassification = "dark" | "light";

export interface TerminalIdentity {
	program: TerminalProgram;
	/** Outer host terminal when running under a multiplexer. */
	hostProgram?: TerminalProgram;
	version?: string;
	multiplexer: Multiplexer;
	isSsh: boolean;
	raw: Record<string, string | undefined>;
}

export interface TerminalBackground {
	r: number;
	g: number;
	b: number;
	/** Relative luminance per WCAG 2.x (0-1). */
	luminance: number;
	classification: BackgroundClassification;
	source: "osc11" | "colorfgbg" | "override";
}

export interface ProbeResult {
	identity: TerminalIdentity;
	background: TerminalBackground | null;
	/** Final classification — always a concrete value (falls back to "dark"). */
	classification: BackgroundClassification;
}

function getEnv(name: string): string | undefined {
	const v = process.env[name];
	return v === undefined || v === "" ? undefined : v;
}

function classifyProgram(env: NodeJS.ProcessEnv): { program: TerminalProgram; version?: string } {
	const termProgram = env.TERM_PROGRAM?.toLowerCase();
	const termProgramVersion = env.TERM_PROGRAM_VERSION;

	if (env.GHOSTTY_RESOURCES_DIR || termProgram === "ghostty") {
		return { program: "ghostty", version: termProgramVersion };
	}
	if (env.KITTY_WINDOW_ID || env.TERM?.toLowerCase().includes("kitty")) {
		return { program: "kitty", version: termProgramVersion };
	}
	if (env.WEZTERM_EXECUTABLE || termProgram === "wezterm") {
		return { program: "wezterm", version: termProgramVersion };
	}
	if (env.ALACRITTY_LOG || termProgram === "alacritty") {
		return { program: "alacritty", version: termProgramVersion };
	}
	if (termProgram === "iterm.app" || env.ITERM_SESSION_ID) {
		return { program: "iterm2", version: termProgramVersion };
	}
	if (termProgram === "apple_terminal") {
		return { program: "apple-terminal", version: termProgramVersion };
	}
	if (env.VTE_VERSION) {
		return { program: "vte", version: env.VTE_VERSION };
	}
	if (env.WT_SESSION) {
		return { program: "windows-terminal" };
	}
	if (env.VSCODE_INJECTION || termProgram === "vscode") {
		return { program: "vscode", version: termProgramVersion };
	}
	if (env.CMUX_SESSION || env.CMUX || termProgram === "cmux") {
		return { program: "cmux", version: termProgramVersion };
	}
	if (env.TERM === "linux") {
		return { program: "linux-console" };
	}
	return { program: "unknown" };
}

export function detectTerminalIdentity(env: NodeJS.ProcessEnv = process.env): TerminalIdentity {
	const tmux = Boolean(env.TMUX);
	const screen = Boolean(env.STY);
	const multiplexer: Multiplexer = tmux ? "tmux" : screen ? "screen" : "none";

	const host = classifyProgram(env);
	let program: TerminalProgram = host.program;
	let hostProgram: TerminalProgram | undefined;

	if (tmux) {
		hostProgram = host.program !== "unknown" ? host.program : undefined;
		program = "tmux";
	} else if (screen) {
		hostProgram = host.program !== "unknown" ? host.program : undefined;
		program = "screen";
	}

	return {
		program,
		hostProgram,
		version: host.version,
		multiplexer,
		isSsh: Boolean(env.SSH_TTY || env.SSH_CONNECTION),
		raw: {
			TERM_PROGRAM: env.TERM_PROGRAM,
			TERM_PROGRAM_VERSION: env.TERM_PROGRAM_VERSION,
			TERM: env.TERM,
			COLORTERM: env.COLORTERM,
			COLORFGBG: env.COLORFGBG,
			TMUX: env.TMUX,
			STY: env.STY,
			SSH_TTY: env.SSH_TTY,
			GHOSTTY_RESOURCES_DIR: env.GHOSTTY_RESOURCES_DIR,
			KITTY_WINDOW_ID: env.KITTY_WINDOW_ID,
			WEZTERM_EXECUTABLE: env.WEZTERM_EXECUTABLE,
			ITERM_SESSION_ID: env.ITERM_SESSION_ID,
			VTE_VERSION: env.VTE_VERSION,
			WT_SESSION: env.WT_SESSION,
		},
	};
}

/** WCAG 2.x relative luminance from sRGB 0-255 components. */
export function relativeLuminance(r: number, g: number, b: number): number {
	const toLinear = (c: number): number => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function classifyLuminance(lum: number): BackgroundClassification {
	return lum >= 0.5 ? "light" : "dark";
}

function parseOsc11Response(data: string): { r: number; g: number; b: number } | null {
	// Match: ESC ]11;rgb:RRRR/GGGG/BBBB (BEL | ESC \)
	// Components may be 1-4 hex digits (commonly 4).
	const match = data.match(/\x1b\]11;rgb:([0-9a-fA-F]{1,4})\/([0-9a-fA-F]{1,4})\/([0-9a-fA-F]{1,4})(?:\x07|\x1b\\)/);
	if (!match) return null;
	const normalize = (hex: string): number => {
		const v = parseInt(hex, 16);
		const max = (1 << (hex.length * 4)) - 1;
		return Math.round((v / max) * 255);
	};
	return { r: normalize(match[1]), g: normalize(match[2]), b: normalize(match[3]) };
}

function parseColorFgBg(raw: string | undefined): BackgroundClassification | null {
	if (!raw) return null;
	const parts = raw.split(";");
	const bg = parts[parts.length - 1];
	const n = parseInt(bg, 10);
	if (!Number.isFinite(n)) return null;
	// 0-6 and 8 = dark variants; 7 and 9-15 = light variants (per xterm convention).
	if (n >= 0 && n <= 6) return "dark";
	if (n === 8) return "dark";
	if (n === 7) return "light";
	if (n >= 9 && n <= 15) return "light";
	return null;
}

function parseOverride(raw: string | undefined): TerminalBackground | null {
	if (!raw) return null;
	const v = raw.trim().toLowerCase();
	if (v === "dark") {
		return { r: 0, g: 0, b: 0, luminance: 0, classification: "dark", source: "override" };
	}
	if (v === "light") {
		return { r: 255, g: 255, b: 255, luminance: 1, classification: "light", source: "override" };
	}
	// Accept #rrggbb
	const hex = v.startsWith("#") ? v.slice(1) : v;
	if (/^[0-9a-f]{6}$/.test(hex)) {
		const r = parseInt(hex.slice(0, 2), 16);
		const g = parseInt(hex.slice(2, 4), 16);
		const b = parseInt(hex.slice(4, 6), 16);
		const lum = relativeLuminance(r, g, b);
		return { r, g, b, luminance: lum, classification: classifyLuminance(lum), source: "override" };
	}
	return null;
}

/**
 * Query the terminal's background color. Tries CAVE_TERM_BG override, then OSC 11,
 * then COLORFGBG. Returns null when no signal is available. Total wall time capped
 * by timeoutMs (default 200ms for the OSC 11 part; env lookups are instant).
 */
export async function queryTerminalBackground(
	terminal: ProcessTerminal | null,
	timeoutMs = 200,
	env: NodeJS.ProcessEnv = process.env,
): Promise<TerminalBackground | null> {
	// 1. CAVE_TERM_BG override wins unconditionally.
	const override = parseOverride(env.CAVE_TERM_BG);
	if (override) return override;

	// 2. OSC 11 query (when we have a terminal and it's a TTY)
	if (terminal && typeof (terminal as unknown as { queryOsc?: unknown }).queryOsc === "function") {
		try {
			const response = await (terminal as unknown as {
				queryOsc: (seq: string, prefix: string, ms: number) => Promise<string | null>;
			}).queryOsc("\x1b]11;?\x07", "\x1b]11;", Math.min(timeoutMs, 150));
			if (response) {
				const rgb = parseOsc11Response(response);
				if (rgb) {
					const lum = relativeLuminance(rgb.r, rgb.g, rgb.b);
					return {
						r: rgb.r,
						g: rgb.g,
						b: rgb.b,
						luminance: lum,
						classification: classifyLuminance(lum),
						source: "osc11",
					};
				}
			}
		} catch {
			// Fall through to COLORFGBG.
		}
	}

	// 3. COLORFGBG parse
	const fgbg = parseColorFgBg(env.COLORFGBG);
	if (fgbg) {
		return {
			r: fgbg === "dark" ? 0 : 255,
			g: fgbg === "dark" ? 0 : 255,
			b: fgbg === "dark" ? 0 : 255,
			luminance: fgbg === "dark" ? 0 : 1,
			classification: fgbg,
			source: "colorfgbg",
		};
	}

	return null;
}

/**
 * Standalone OSC 11 query that works before the TUI has started.
 *
 * Briefly installs its own stdin listener in raw mode, writes the OSC 11
 * query, waits up to `timeoutMs` for the response, then restores stdin.
 * Returns null on timeout / non-TTY / parse failure.
 *
 * Use this during startup when we need the background classification before
 * theme init but haven't yet constructed a ProcessTerminal.
 */
export function queryOsc11Standalone(timeoutMs = 150): Promise<TerminalBackground | null> {
	return new Promise((resolve) => {
		if (!process.stdout.isTTY || !process.stdin.isTTY) {
			resolve(null);
			return;
		}

		const wasRaw = process.stdin.isRaw;
		let settled = false;
		let buffer = "";
		let timer: NodeJS.Timeout | undefined;

		const cleanup = () => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);
			try {
				process.stdin.removeListener("data", onData);
				if (process.stdin.setRawMode && !wasRaw) {
					process.stdin.setRawMode(false);
				}
				process.stdin.pause();
			} catch {
				// swallow
			}
		};

		const onData = (chunk: Buffer | string) => {
			buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
			const rgb = parseOsc11Response(buffer);
			if (rgb) {
				cleanup();
				const lum = relativeLuminance(rgb.r, rgb.g, rgb.b);
				resolve({
					r: rgb.r,
					g: rgb.g,
					b: rgb.b,
					luminance: lum,
					classification: classifyLuminance(lum),
					source: "osc11",
				});
			}
		};

		try {
			if (process.stdin.setRawMode) process.stdin.setRawMode(true);
			process.stdin.resume();
			process.stdin.on("data", onData);
			process.stdout.write("\x1b]11;?\x07");
		} catch {
			cleanup();
			resolve(null);
			return;
		}

		timer = setTimeout(() => {
			cleanup();
			resolve(null);
		}, timeoutMs);
	});
}

/**
 * One-call probe: identity + background + final classification (with "dark" fallback).
 * The classification field is always concrete per R1.
 */
export async function probeTerminal(options: {
	terminal?: ProcessTerminal | null;
	timeoutMs?: number;
	env?: NodeJS.ProcessEnv;
	/** Whether to run the standalone OSC 11 query (needs raw stdin). Default: true when no terminal is supplied. */
	useStandaloneOsc?: boolean;
}): Promise<ProbeResult> {
	const env = options.env ?? process.env;
	const identity = detectTerminalIdentity(env);
	const timeoutMs = options.timeoutMs ?? 200;
	const useStandalone = options.useStandaloneOsc ?? !options.terminal;

	// Override first (R1 AC7)
	const override = parseOverride(env.CAVE_TERM_BG);
	if (override) {
		return { identity, background: override, classification: override.classification };
	}

	// Pre-TUI OSC 11 (R1 AC1+2)
	if (useStandalone) {
		const osc = await queryOsc11Standalone(Math.min(timeoutMs, 150));
		if (osc) {
			return { identity, background: osc, classification: osc.classification };
		}
	} else if (options.terminal) {
		const bg = await queryTerminalBackground(options.terminal, timeoutMs, env);
		if (bg) return { identity, background: bg, classification: bg.classification };
	}

	// COLORFGBG (R1 AC3)
	const fgbg = parseColorFgBg(env.COLORFGBG);
	if (fgbg) {
		return {
			identity,
			background: {
				r: fgbg === "dark" ? 0 : 255,
				g: fgbg === "dark" ? 0 : 255,
				b: fgbg === "dark" ? 0 : 255,
				luminance: fgbg === "dark" ? 0 : 1,
				classification: fgbg,
				source: "colorfgbg",
			},
			classification: fgbg,
		};
	}

	// Fallback (R1 AC4)
	return { identity, background: null, classification: "dark" };
}
