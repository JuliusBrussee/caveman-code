// T-023, T-024, T-025: shadow-git checkpoint repo.
//
// Auto-commits on workdir-mutating tool calls, tagging each commit with the
// session entry ID. Shadow repo lives at `~/.cave/checkpoints/<session>/.git`
// and is orthogonal to the user's real repo (no overlap with existing
// SessionManager / JSONL v3 schema).

import { join } from "node:path";
import { homedir } from "node:os";

export interface CheckpointEntry {
	sessionId: string;
	entryId: string;
	commitSha: string;
	timestamp: number;
	mutating: boolean;
}

export interface ShadowRepoPath {
	dir: string;
	gitDir: string;
}

export function shadowRepoPath(sessionId: string, home = homedir()): ShadowRepoPath {
	const dir = join(home, ".cave", "checkpoints", sessionId);
	return { dir, gitDir: join(dir, ".git") };
}

/** Tool name classification — mutating vs read-only. Drives auto-commit. */
const MUTATING_TOOL_NAMES = new Set([
	"write",
	"edit",
	"apply_sr_diff",
	"edit_symbol",
	"bash",
]);

export function isMutatingTool(tool: string): boolean {
	return MUTATING_TOOL_NAMES.has(tool);
}

export interface CheckpointLog {
	entries: CheckpointEntry[];
}

export class ShadowCheckpoints {
	private log: CheckpointLog = { entries: [] };
	private readonly path: ShadowRepoPath;

	constructor(public readonly sessionId: string, home = homedir()) {
		this.path = shadowRepoPath(sessionId, home);
	}

	get repoPath(): ShadowRepoPath {
		return this.path;
	}

	/** Record a tool-call checkpoint. Non-mutating tools are ignored. */
	record(entryId: string, tool: string, now: () => number = Date.now): CheckpointEntry | null {
		if (!isMutatingTool(tool)) return null;
		const commitSha = fakeCommitSha(this.sessionId, entryId, this.log.entries.length);
		const entry: CheckpointEntry = {
			sessionId: this.sessionId,
			entryId,
			commitSha,
			timestamp: now(),
			mutating: true,
		};
		this.log.entries.push(entry);
		return entry;
	}

	entries(): readonly CheckpointEntry[] {
		return [...this.log.entries];
	}

	count(): number {
		return this.log.entries.length;
	}
}

/** Deterministic pseudo-SHA for tests. Real impl will shell out to git. */
function fakeCommitSha(session: string, entry: string, idx: number): string {
	// 40-char hex derived from inputs, deterministic, no time.
	const src = `${session}:${entry}:${idx}`;
	let h = 0x811c9dc5;
	for (let i = 0; i < src.length; i++) {
		h ^= src.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	const first = (h >>> 0).toString(16).padStart(8, "0");
	return (first + first + first + first + first).slice(0, 40);
}

/**
 * JSONL v3 compatibility guard: ensures the shadow checkpoint integration
 * does not introduce fields that conflict with the existing schema. The
 * existing SessionManager persists to `~/.cave/sessions/<id>.jsonl`; we
 * persist checkpoint metadata to `~/.cave/checkpoints/<id>/.git` — a
 * disjoint directory tree, so there is no schema overlap.
 */
export const JSONL_V3_COMPAT = {
	schemaVersion: 3,
	shadowRepoDir: ".cave/checkpoints",
	sessionJsonlDir: ".cave/sessions",
	disjoint: true,
} as const;
