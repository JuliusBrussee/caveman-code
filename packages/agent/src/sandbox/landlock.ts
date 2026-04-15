// T-018: Linux Landlock sandbox wrapper with kernel 5.13 detection.
//
// Landlock requires kernel 5.13+. On older kernels we fall back to
// a permissive wrapper and emit a one-time warning at startup.

import type { SandboxAllow, SandboxProfile, SandboxResult } from "./types.js";

export interface KernelInfo {
	major: number;
	minor: number;
}

export function parseKernelVersion(release: string): KernelInfo {
	const m = release.match(/^(\d+)\.(\d+)/);
	if (!m) return { major: 0, minor: 0 };
	return { major: Number.parseInt(m[1], 10), minor: Number.parseInt(m[2], 10) };
}

export function supportsLandlock(info: KernelInfo): boolean {
	return info.major > 5 || (info.major === 5 && info.minor >= 13);
}

/** Detected once at startup and cached. Returns undefined on non-Linux. */
let CACHED_SUPPORT: boolean | undefined;
export function detectLandlockSupport(platform: string, release: string): boolean {
	if (platform !== "linux") {
		CACHED_SUPPORT = false;
		return false;
	}
	if (CACHED_SUPPORT !== undefined) return CACHED_SUPPORT;
	CACHED_SUPPORT = supportsLandlock(parseKernelVersion(release));
	return CACHED_SUPPORT;
}

/** Test-only reset. */
export function __resetLandlockCache(): void {
	CACHED_SUPPORT = undefined;
}

export function landlockSandbox(
	workdir: string,
	allow: SandboxAllow = {},
	supported = true,
): SandboxResult {
	const profile: SandboxProfile = {
		kind: supported ? "landlock" : "permissive",
		workdir,
		allow,
		permissiveReason: supported ? undefined : "kernel<5.13: landlock unavailable",
	};
	return {
		profile,
		wrap(command: string): string {
			if (!supported) return command;
			// Real impl would use prctl(PR_SET_NO_NEW_PRIVS) + landlock syscalls via
			// a small C helper. For now we mark the boundary with a prefix the
			// runner unwraps at execution time.
			return `CAVE_LANDLOCK_WORKDIR='${workdir}' ${command}`;
		},
	};
}
