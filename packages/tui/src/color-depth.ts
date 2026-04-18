/**
 * Color depth detection and SGR emission.
 *
 * Covers cavekit-terminal-blend R7: emit truecolor when the terminal supports it,
 * 256-color when it doesn't, and 16-color as a last resort so sequences degrade
 * cleanly under tmux, screen, and linux-console.
 */

export type ColorDepth = "truecolor" | "256" | "16";

let cachedDepth: ColorDepth | undefined;

export function detectColorDepth(env: NodeJS.ProcessEnv = process.env): ColorDepth {
	if (cachedDepth !== undefined && env === process.env) return cachedDepth;

	const colorterm = (env.COLORTERM || "").toLowerCase();
	const term = (env.TERM || "").toLowerCase();
	const tmux = Boolean(env.TMUX);

	let depth: ColorDepth;

	if (term === "linux") {
		depth = "16";
	} else if (colorterm === "truecolor" || colorterm === "24bit") {
		// tmux without explicit truecolor indicator downgrades to 256.
		depth = tmux && term.includes("screen") && !colorterm ? "256" : "truecolor";
	} else if (tmux && !colorterm) {
		// tmux without truecolor indicator: 256 max per R7.
		depth = term.includes("256color") ? "256" : "16";
	} else if (term.includes("256color") || term.includes("256colour")) {
		depth = "256";
	} else {
		depth = "16";
	}

	if (env === process.env) cachedDepth = depth;
	return depth;
}

export function resetColorDepthCache(): void {
	cachedDepth = undefined;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
	if (!hex) return null;
	const v = hex.startsWith("#") ? hex.slice(1) : hex;
	if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
	return {
		r: parseInt(v.slice(0, 2), 16),
		g: parseInt(v.slice(2, 4), 16),
		b: parseInt(v.slice(4, 6), 16),
	};
}

/** Convert 0-255 channel to 0-5 cube index (6x6x6 cube in 256-color). */
function channelTo6(v: number): number {
	if (v < 48) return 0;
	if (v < 115) return 1;
	return Math.floor((v - 35) / 40);
}

/** Map (r,g,b) 0-255 to an xterm 256-color index (16-231 cube or 232-255 grayscale). */
function rgbTo256(r: number, g: number, b: number): number {
	// Prefer grayscale ramp if channels are close together.
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	if (max - min < 8) {
		const avg = (r + g + b) / 3;
		if (avg < 8) return 16; // black in cube
		if (avg > 248) return 231; // white in cube
		return 232 + Math.min(23, Math.floor((avg - 8) / 10));
	}
	const ri = channelTo6(r);
	const gi = channelTo6(g);
	const bi = channelTo6(b);
	return 16 + 36 * ri + 6 * gi + bi;
}

/**
 * Standard 16-color ANSI palette (approximate RGB values used for nearest-match).
 * Base 0-7 map to SGR 30-37 (fg) / 40-47 (bg); bright 8-15 map to 90-97 / 100-107.
 */
const ANSI16: { r: number; g: number; b: number }[] = [
	{ r: 0, g: 0, b: 0 }, // black
	{ r: 205, g: 0, b: 0 }, // red
	{ r: 0, g: 205, b: 0 }, // green
	{ r: 205, g: 205, b: 0 }, // yellow
	{ r: 0, g: 0, b: 238 }, // blue
	{ r: 205, g: 0, b: 205 }, // magenta
	{ r: 0, g: 205, b: 205 }, // cyan
	{ r: 229, g: 229, b: 229 }, // white
	{ r: 127, g: 127, b: 127 }, // bright black
	{ r: 255, g: 0, b: 0 }, // bright red
	{ r: 0, g: 255, b: 0 }, // bright green
	{ r: 255, g: 255, b: 0 }, // bright yellow
	{ r: 92, g: 92, b: 255 }, // bright blue
	{ r: 255, g: 0, b: 255 }, // bright magenta
	{ r: 0, g: 255, b: 255 }, // bright cyan
	{ r: 255, g: 255, b: 255 }, // bright white
];

function rgbTo16(r: number, g: number, b: number): number {
	let best = 0;
	let bestDist = Infinity;
	for (let i = 0; i < ANSI16.length; i++) {
		const p = ANSI16[i];
		const dr = r - p.r;
		const dg = g - p.g;
		const db = b - p.b;
		const dist = dr * dr + dg * dg + db * db;
		if (dist < bestDist) {
			bestDist = dist;
			best = i;
		}
	}
	return best;
}

/**
 * Emit the SGR escape sequence to set the given color as foreground or background
 * at the given color depth. Returns "" for invalid input (empty/undefined hex).
 */
export function hexToSgr(hex: string | undefined | null, depth: ColorDepth, kind: "fg" | "bg"): string {
	if (!hex) return "";
	const rgb = parseHex(hex);
	if (!rgb) return "";

	if (depth === "truecolor") {
		const code = kind === "fg" ? 38 : 48;
		return `\x1b[${code};2;${rgb.r};${rgb.g};${rgb.b}m`;
	}

	if (depth === "256") {
		const idx = rgbTo256(rgb.r, rgb.g, rgb.b);
		const code = kind === "fg" ? 38 : 48;
		return `\x1b[${code};5;${idx}m`;
	}

	// 16-color
	const idx = rgbTo16(rgb.r, rgb.g, rgb.b);
	if (idx < 8) {
		const base = kind === "fg" ? 30 : 40;
		return `\x1b[${base + idx}m`;
	}
	const base = kind === "fg" ? 90 : 100;
	return `\x1b[${base + (idx - 8)}m`;
}

export function sgrReset(): string {
	return "\x1b[0m";
}
