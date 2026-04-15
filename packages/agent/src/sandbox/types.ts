// T-016..T-019: sandbox types shared across platforms.

export type SandboxKind = "seatbelt" | "landlock" | "permissive";

export type SandboxPermission = "read" | "write" | "network";

export interface SandboxAllow {
	/** Paths allowed to write (in addition to the workdir). */
	writes?: string[];
	/** Paths allowed to read outside the workdir. */
	reads?: string[];
	/** If true, network calls are permitted. */
	network?: boolean;
}

export interface SandboxProfile {
	kind: SandboxKind;
	workdir: string;
	allow: SandboxAllow;
	/** Reason the sandbox is permissive (e.g. Windows unsupported). */
	permissiveReason?: string;
}

export interface SandboxResult {
	profile: SandboxProfile;
	/** Command template that wraps a user-provided bash command. */
	wrap(command: string): string;
}

export class SandboxViolation extends Error {
	constructor(
		public readonly kind: "write" | "read" | "network",
		public readonly path: string | undefined,
		message: string,
	) {
		super(message);
		this.name = "SandboxViolation";
	}
}

// T-115, T-116: sandbox.allow configuration + interactive escape.
export interface SandboxAllowConfig {
	writes?: string[];
	reads?: string[];
	network?: boolean;
}

export interface EscapeRequest {
	kind: "write" | "read" | "network";
	path?: string;
	reason: string;
}

export type EscapeConfirm = (req: EscapeRequest) => boolean;

/** Merge base allow with a runtime escape after interactive confirm. */
export function applyEscape(
	base: SandboxAllowConfig,
	req: EscapeRequest,
	confirm: EscapeConfirm,
): SandboxAllowConfig {
	if (!confirm(req)) return base;
	const merged: SandboxAllowConfig = { ...base };
	if (req.kind === "write" && req.path) {
		merged.writes = [...(merged.writes ?? []), req.path];
	} else if (req.kind === "read" && req.path) {
		merged.reads = [...(merged.reads ?? []), req.path];
	} else if (req.kind === "network") {
		merged.network = true;
	}
	return merged;
}
