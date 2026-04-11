/**
 * RTK (Rust Token Killer) integration for bash command output compression.
 *
 * Detects RTK availability, rewrites bash commands through `rtk rewrite`,
 * and provides a BashSpawnHook for transparent integration.
 */

import { execFileSync, spawn } from "node:child_process";
import type { BashSpawnContext, BashSpawnHook } from "./tools/bash.js";

// --- Detection (R1) ---

export interface RtkDetectionResult {
	available: boolean;
	version: string | null;
}

const DETECTION_TIMEOUT_MS = 5000;
const UNAVAILABLE_RTK_RESULT: RtkDetectionResult = { available: false, version: null };

let cachedResult: Promise<RtkDetectionResult> | null = null;
let latestDetectionResult: RtkDetectionResult | null = null;

function rememberDetectionResult(result: RtkDetectionResult): RtkDetectionResult {
	latestDetectionResult = result;
	return result;
}

/**
 * Detect whether the `rtk` binary is installed and functional.
 * Returns availability + version string.
 */
export function detectRtk(): Promise<RtkDetectionResult> {
	return new Promise((resolve) => {
		let stdout = "";
		let settled = false;
		let timeoutId: NodeJS.Timeout | undefined;

		const finish = (result: RtkDetectionResult) => {
			if (settled) {
				return;
			}
			settled = true;
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			resolve(rememberDetectionResult(result));
		};

		try {
			const proc = spawn("rtk", ["--version"], {
				shell: false,
				stdio: ["ignore", "pipe", "ignore"],
			});

			timeoutId = setTimeout(() => {
				try {
					proc.kill("SIGTERM");
				} catch {
					// Ignore kill errors and fail closed below.
				}
				finish(UNAVAILABLE_RTK_RESULT);
			}, DETECTION_TIMEOUT_MS);

			proc.stdout?.setEncoding("utf-8");
			proc.stdout?.on("data", (chunk: string | Buffer) => {
				stdout += chunk.toString();
			});

			proc.on("error", () => {
				finish(UNAVAILABLE_RTK_RESULT);
			});

			proc.on("close", (code) => {
				if (code === 0) {
					finish({ available: true, version: stdout.trim() });
					return;
				}
				finish(UNAVAILABLE_RTK_RESULT);
			});
		} catch {
			finish(UNAVAILABLE_RTK_RESULT);
		}
	});
}

/**
 * Get RTK status, caching after first check.
 * Subsequent calls return the cached result without spawning a subprocess.
 */
export function getRtkStatus(): Promise<RtkDetectionResult> {
	if (cachedResult === null) {
		cachedResult = detectRtk();
	}
	return cachedResult;
}

/** Reset the cached detection result (for testing). */
export function resetRtkCache(): void {
	cachedResult = null;
	latestDetectionResult = null;
}

// --- Command Rewriting (R2) ---

/** Timeout for `rtk rewrite` calls in milliseconds. */
const REWRITE_TIMEOUT_MS = 200;

/**
 * Rewrite a bash command through RTK.
 * Returns the rewritten command on success, or the original command on any failure (fail-open).
 *
 * Exit code protocol for `rtk rewrite`:
 *   0 + stdout → rewrite found, use rewritten command
 *   1          → no RTK equivalent, pass through unchanged
 *   2          → deny rule matched, pass through
 *   3 + stdout → ask rule matched, use rewritten command
 *   any other  → pass through unchanged
 */
export function rewriteCommand(command: string): string {
	// Guard: don't double-rewrite commands already prefixed with rtk
	if (command === "rtk" || command.startsWith("rtk ")) {
		return command;
	}

	if (latestDetectionResult?.available === false) {
		return command;
	}

	try {
		const stdout = execFileSync("rtk", ["rewrite", command], {
			timeout: REWRITE_TIMEOUT_MS,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		const rewritten = stdout.trim();
		return rewritten || command;
	} catch (error: unknown) {
		if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
			rememberDetectionResult(UNAVAILABLE_RTK_RESULT);
			cachedResult ??= Promise.resolve(UNAVAILABLE_RTK_RESULT);
		}

		// Fail-open: any error (non-zero exit, timeout, ENOENT) → use original command
		// Exit codes 1 and 2 from `rtk rewrite` come through here as errors
		// Exit code 3 also comes through — for our integration we treat it as pass-through
		// since we don't have a user prompt mechanism in the spawn hook
		return command;
	}
}

// --- BashSpawnHook Factory (R4) ---

/**
 * Create a BashSpawnHook that rewrites commands through RTK.
 * The hook is synchronous — `rtk rewrite` is called via execFileSync.
 *
 * commandPrefix is already applied to context.command before this hook runs
 * (see bash.ts resolveSpawnContext), so prefix ordering is preserved.
 */
export function createRtkSpawnHook(): BashSpawnHook {
	return (context: BashSpawnContext): BashSpawnContext => {
		const rewritten = rewriteCommand(context.command);
		if (rewritten === context.command) {
			return context;
		}
		return { ...context, command: rewritten };
	};
}
