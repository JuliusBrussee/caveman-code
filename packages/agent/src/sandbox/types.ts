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
