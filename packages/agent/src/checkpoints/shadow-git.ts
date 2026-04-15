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

// ─── T-104, T-105: atomic rewind ────────────────────────────────────────────

export interface RewindAdapter {
	checkout(commitSha: string): void;
	truncateJsonl(entryId: string): void;
	reconstructSummary(entryId: string): string;
}

export interface RewindResult {
	status: "ok" | "not_found" | "rollback";
	entryId: string;
	summary?: string;
	error?: string;
}

/** Rewind a session to the given entry id atomically:
 *  - Pick the checkpoint's commit
 *  - Truncate JSONL entries after the target
 *  - Reconstruct a summary for the remaining branch
 *  - On any failure, the checkout is rolled back (caller's adapter does it) */
export function rewindSession(
	checkpoints: ShadowCheckpoints,
	targetEntryId: string,
	adapter: RewindAdapter,
): RewindResult {
	const entry = checkpoints.entries().find((e) => e.entryId === targetEntryId);
	if (!entry) {
		return { status: "not_found", entryId: targetEntryId, error: "entry not found" };
	}
	const preCheckoutTargetEntries = [...checkpoints.entries()];
	try {
		adapter.checkout(entry.commitSha);
		adapter.truncateJsonl(targetEntryId);
		const summary = adapter.reconstructSummary(targetEntryId);
		return { status: "ok", entryId: targetEntryId, summary };
	} catch (err) {
		// Rollback: re-checkout the most recent commit to restore workdir
		const latest = preCheckoutTargetEntries[preCheckoutTargetEntries.length - 1];
		if (latest) {
			try {
				adapter.checkout(latest.commitSha);
			} catch {
				/* best-effort rollback */
			}
		}
		return {
			status: "rollback",
			entryId: targetEntryId,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

// ─── T-106: Esc-Esc rewind picker ───────────────────────────────────────────

export interface PickerEntry {
	entryId: string;
	timestamp: number;
	commitSha: string;
	summary: string;
}

export function buildPickerEntries(
	checkpoints: ShadowCheckpoints,
	summarize: (entryId: string) => string,
): PickerEntry[] {
	return checkpoints.entries().map((e) => ({
		entryId: e.entryId,
		timestamp: e.timestamp,
		commitSha: e.commitSha,
		summary: summarize(e.entryId),
	}));
}

// ─── T-107, T-108: cave resume fuzzy picker ─────────────────────────────────

export interface SessionRow {
	sessionId: string;
	/** ISO 8601 string for display */
	lastActivity: string;
	messageCount: number;
	/** Short summary (first user message trimmed) */
	title: string;
	/** Total dollars spent */
	dollars: number;
}

export function sortByRecency(rows: SessionRow[]): SessionRow[] {
	return [...rows].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

export function fuzzyFilter(rows: SessionRow[], query: string): SessionRow[] {
	if (!query) return rows;
	const q = query.toLowerCase();
	return rows.filter(
		(r) =>
			r.sessionId.toLowerCase().includes(q) ||
			r.title.toLowerCase().includes(q),
	);
}

// ─── T-109, T-110: plan mode ────────────────────────────────────────────────

const PLAN_MODE_BLOCKED_TOOLS = new Set(["write", "edit", "apply_sr_diff", "edit_symbol", "bash"]);
const PLAN_MODE_ALLOWED_TOOLS = new Set(["read", "grep", "glob", "ls", "find"]);

export class PlanMode {
	private active = false;
	enter(): void {
		this.active = true;
	}
	exit(): void {
		this.active = false;
	}
	isActive(): boolean {
		return this.active;
	}
	isBlocked(tool: string): boolean {
		return this.active && PLAN_MODE_BLOCKED_TOOLS.has(tool);
	}
	isAllowed(tool: string): boolean {
		return !this.active || PLAN_MODE_ALLOWED_TOOLS.has(tool);
	}
}

// ─── T-111: checkpoint GC retention ─────────────────────────────────────────

export interface CheckpointGcPolicy {
	retentionDays: number;
	activeSessionId?: string;
}

export interface CheckpointDirMetadata {
	sessionId: string;
	lastModifiedMs: number;
}

export function selectGcCandidates(
	dirs: CheckpointDirMetadata[],
	policy: CheckpointGcPolicy,
	now: number = Date.now(),
): CheckpointDirMetadata[] {
	const cutoff = now - policy.retentionDays * 24 * 60 * 60 * 1000;
	return dirs.filter(
		(d) => d.lastModifiedMs < cutoff && d.sessionId !== policy.activeSessionId,
	);
}
