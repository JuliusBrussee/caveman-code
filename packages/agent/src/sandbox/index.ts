export * from "./types.js";
export * from "./seatbelt.js";
export * from "./landlock.js";
export * from "./windows.js";

import { detectLandlockSupport, landlockSandbox } from "./landlock.js";
import { seatbeltSandbox } from "./seatbelt.js";
import type { SandboxAllow, SandboxResult } from "./types.js";
import { windowsSandbox, WINDOWS_UNSUPPORTED_WARNING } from "./windows.js";

export interface SandboxSelection {
	sandbox: SandboxResult;
	warning?: string;
}

/** Pick the right sandbox for the current platform. */
export function selectSandbox(
	platform: NodeJS.Platform,
	release: string,
	workdir: string,
	allow: SandboxAllow = {},
): SandboxSelection {
	if (platform === "darwin") {
		return { sandbox: seatbeltSandbox(workdir, allow) };
	}
	if (platform === "linux") {
		const supported = detectLandlockSupport(platform, release);
		return {
			sandbox: landlockSandbox(workdir, allow, supported),
			warning: supported ? undefined : "cave: landlock unsupported (kernel<5.13) — running permissive",
		};
	}
	if (platform === "win32") {
		return { sandbox: windowsSandbox(workdir, allow), warning: WINDOWS_UNSUPPORTED_WARNING };
	}
	return {
		sandbox: windowsSandbox(workdir, allow),
		warning: `cave: unknown platform ${platform} — running permissive`,
	};
}
