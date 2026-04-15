// T-019: Windows unsupported-sandbox warning, runs permissive.

import type { SandboxAllow, SandboxProfile, SandboxResult } from "./types.js";

export const WINDOWS_UNSUPPORTED_WARNING =
	"cave: bash sandbox unsupported on Windows — running permissive. " +
	"Do not run untrusted code. No Job Objects or AppContainer is used.";

export function windowsSandbox(workdir: string, allow: SandboxAllow = {}): SandboxResult {
	const profile: SandboxProfile = {
		kind: "permissive",
		workdir,
		allow,
		permissiveReason: "windows unsupported",
	};
	return {
		profile,
		wrap(command: string): string {
			return command;
		},
	};
}
