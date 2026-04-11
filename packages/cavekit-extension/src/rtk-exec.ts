/**
 * RTK-aware shell execution for the CaveKit extension.
 *
 * All shell commands in the extension route through this module so that
 * RTK command rewriting is applied consistently — same as the main agent's
 * bash tool.  When RTK is unavailable or disabled the command passes through
 * unchanged (fail-open).
 */

import { type ExecSyncOptionsWithStringEncoding, execSync } from "node:child_process";

// Dynamic import cache — resolved once, reused.
let _rtkFns: { getRtkStatus: () => Promise<{ available: boolean }>; rewriteCommandSync: (cmd: string) => string } | null = null;
let _rtkResolved = false;
let _rtkAvailable = false;

async function loadRtk(): Promise<typeof _rtkFns> {
	if (_rtkResolved) return _rtkFns;
	try {
		const cave = await import("cave");
		_rtkFns = { getRtkStatus: cave.getRtkStatus, rewriteCommandSync: cave.rewriteCommandSync };
	} catch {
		_rtkFns = null;
	}
	_rtkResolved = true;
	return _rtkFns;
}

/**
 * Run a command through RTK rewriting, then execute via execSync.
 * Falls back to direct execution if RTK is unavailable.
 */
function rewrite(command: string): string {
	// Use synchronous cached state — initRtkExec populates availability once at startup.
	if (!_rtkFns || !_rtkAvailable) return command;
	return _rtkFns.rewriteCommandSync(command);
}

/** Initialise RTK imports. Call once during extension init. */
export async function initRtkExec(): Promise<void> {
	await loadRtk();
	_rtkAvailable = (await _rtkFns?.getRtkStatus())?.available ?? false;
}

/**
 * Execute a shell command with RTK rewriting applied.
 * Returns stdout as a string. Throws on non-zero exit.
 */
export function rtkExec(command: string, options: { cwd: string; encoding: "utf8" }): string;
export function rtkExec(command: string, options: { cwd: string; stdio: "ignore" }): void;
export function rtkExec(
	command: string,
	options: { cwd: string; encoding?: "utf8"; stdio?: "ignore" },
): string | undefined {
	const rewritten = rewrite(command);
	if (options.encoding) {
		return execSync(rewritten, options as ExecSyncOptionsWithStringEncoding);
	}
	execSync(rewritten, { cwd: options.cwd, stdio: options.stdio ?? "ignore" });
}
