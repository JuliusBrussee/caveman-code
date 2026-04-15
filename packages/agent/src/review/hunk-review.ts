// T-118, T-119: hunk-level inline review UI consuming the edit-tools diff payload.

import type { DiffPayload, Hunk } from "../tools/edit-tools-registry.js";

export type ReviewMode = "review-each" | "review-batch" | "auto-accept";

export interface HunkDecision {
	accept: boolean;
}

export interface HunkReviewResult {
	applied: Hunk[];
	rejected: Hunk[];
	finalContent: string;
}

/**
 * Apply `decisions` to the diff payload against `originalContent`. Rejected
 * hunks leave the corresponding region byte-identical to the original. Used
 * by the TUI review loop and by tests.
 */
export function applyReview(
	originalContent: string,
	payload: DiffPayload,
	decisions: HunkDecision[],
): HunkReviewResult {
	if (decisions.length !== payload.hunks.length) {
		throw new Error(
			`review: decision count ${decisions.length} must match hunk count ${payload.hunks.length}`,
		);
	}
	const applied: Hunk[] = [];
	const rejected: Hunk[] = [];
	let content = originalContent;
	// Iterate hunks in reverse by lineRange start so we can splice without
	// shifting subsequent hunk coordinates.
	const ordered = payload.hunks
		.map((h, i) => ({ h, d: decisions[i] }))
		.sort((a, b) => b.h.lineRange[0] - a.h.lineRange[0]);
	for (const { h, d } of ordered) {
		if (!d.accept) {
			rejected.push(h);
			continue;
		}
		applied.push(h);
		const [startLine, endLine] = h.lineRange;
		const lines = content.split("\n");
		const before = lines.slice(0, startLine - 1);
		const after = lines.slice(endLine);
		const replaced = h.after.split("\n");
		content = [...before, ...replaced, ...after].join("\n");
	}
	return { applied, rejected, finalContent: content };
}

export function batchDecisions(mode: ReviewMode, hunkCount: number, interactiveAccept?: boolean[]): HunkDecision[] {
	if (mode === "auto-accept") {
		return Array.from({ length: hunkCount }, () => ({ accept: true }));
	}
	if (mode === "review-batch") {
		// caller supplied a single yes/no for all
		const all = interactiveAccept?.[0] ?? true;
		return Array.from({ length: hunkCount }, () => ({ accept: all }));
	}
	// review-each
	return Array.from({ length: hunkCount }, (_, i) => ({
		accept: interactiveAccept?.[i] ?? true,
	}));
}
