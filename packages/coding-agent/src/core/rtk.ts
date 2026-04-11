/**
 * RTK (Rust Token Killer) integration for bash command output compression.
 *
 * Detects RTK availability, rewrites bash commands through `rtk rewrite`,
 * and provides a BashSpawnHook for transparent integration.
 */

import { execFile, execFileSync, spawn } from "node:child_process";
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
 */
export async function rewriteCommand(command: string): Promise<string> {
	// Guard: don't double-rewrite commands already prefixed with rtk
	if (command === "rtk" || command.startsWith("rtk ")) {
		return command;
	}

	if (latestDetectionResult?.available === false) {
		return command;
	}

	return new Promise((resolve) => {
		try {
			execFile(
				"rtk",
				["rewrite", command],
				{
					timeout: REWRITE_TIMEOUT_MS,
					encoding: "utf-8",
				},
				(error, stdout) => {
					if (error) {
						if (typeof error.code === "string" && error.code === "ENOENT") {
							rememberDetectionResult(UNAVAILABLE_RTK_RESULT);
							cachedResult ??= Promise.resolve(UNAVAILABLE_RTK_RESULT);
						}
						resolve(command);
						return;
					}

					const rewritten = stdout.trim();
					resolve(rewritten || command);
				},
			);
		} catch {
			resolve(command);
		}
	});
}

/**
 * Synchronous variant of rewriteCommand.
 * Returns the rewritten command on success, or the original command on any failure (fail-open).
 */
export function rewriteCommandSync(command: string): string {
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
		});
		const rewritten = stdout.trim();
		return rewritten || command;
	} catch {
		return command;
	}
}

// --- BashSpawnHook Factory (R4) ---

/**
 * Create a BashSpawnHook that rewrites commands through RTK.
 *
 * commandPrefix is already applied to context.command before this hook runs
 * (see bash.ts resolveSpawnContext), so prefix ordering is preserved.
 */
export function createRtkSpawnHook(): BashSpawnHook {
	return async (context: BashSpawnContext): Promise<BashSpawnContext> => {
		const rtkStatus = await getRtkStatus();
		if (!rtkStatus.available) {
			return context;
		}

		const rewritten = await rewriteCommand(context.command);
		if (rewritten === context.command) {
			return context;
		}
		return { ...context, command: rewritten };
	};
}
