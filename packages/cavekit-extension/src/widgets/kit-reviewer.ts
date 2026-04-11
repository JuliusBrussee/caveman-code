/**
 * Kit reviewer — interactive two-pane review overlay shown after /ck:draft.
 *
 * T-036 (extension-ui/R2):
 * AC-1: After kit generation, displays a navigable tree of kits > requirements > AC.
 * AC-2: User can approve or reject individual kits via the review pane.
 * AC-3: Blocks workflow until the user has confirmed every kit.
 * AC-4: Rejected kits are excluded from the list consumed by /ck:architect.
 */

import type { Kit, ReviewItem } from "../types.js";
import { type ReviewOverlayContext, showReviewOverlay } from "./review-pane.js";

export type KitReviewerContext = ReviewOverlayContext;

export interface KitReviewResult {
	/** Kits the user approved — these are the only kits architect should use. */
	approvedKits: Kit[];
	/** Kits the user rejected. */
	rejectedKits: Kit[];
}

/**
 * Present an interactive kit review overlay.
 *
 * AC-1: Each kit is rendered as markdown with its requirements and acceptance criteria.
 * AC-2: User can approve or reject each kit in the two-pane review pane.
 * AC-3: The function awaits every kit before returning — it blocks the caller.
 * AC-4: Rejected kits are tracked separately and not returned to architect.
 */
export async function reviewKits(kits: Kit[], ctx: KitReviewerContext): Promise<KitReviewResult> {
	if (kits.length === 0) {
		ctx.ui.notify("No kits to review.", "warning");
		return { approvedKits: [], rejectedKits: [] };
	}

	const items: ReviewItem[] = kits.map((kit, i) => kitToReviewItem(kit, i, kits.length));

	const result = await showReviewOverlay(items, ctx, {
		title: "Kit Review",
		allowSkip: false,
	});

	const approvedIds = new Set(result.items.filter((i) => i.status === "approved").map((i) => i.id));
	const approvedKits = kits.filter((k) => approvedIds.has(k.domain));
	const rejectedKits = kits.filter((k) => !approvedIds.has(k.domain));

	const summary = [
		"Kit review complete.",
		`Approved: ${approvedKits.map((k) => k.domain).join(", ") || "none"}`,
		`Rejected: ${rejectedKits.map((k) => k.domain).join(", ") || "none"}`,
	].join("  |  ");

	ctx.ui.notify(summary, approvedKits.length > 0 ? "info" : "warning");

	return { approvedKits, rejectedKits };
}

/**
 * Convenience helper: filter a parsed kit list to only the approved ones.
 *
 * AC-4: Use this in the architect command to exclude rejected kits.
 */
export function filterApprovedKits(allKits: Kit[], approvedKits: Kit[]): Kit[] {
	const approvedDomains = new Set(approvedKits.map((k) => k.domain));
	return allKits.filter((k) => approvedDomains.has(k.domain));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function kitToReviewItem(kit: Kit, index: number, total: number): ReviewItem {
	const acCount = kit.requirements.reduce((n, r) => n + r.acceptanceCriteria.length, 0);

	return {
		id: kit.domain,
		title: `${kit.domain} (${index + 1}/${total})`,
		markdownContent: buildKitMarkdown(kit),
		metadata: [
			{ label: "Domain", value: kit.domain },
			{ label: "Requirements", value: `${kit.requirements.length}` },
			{ label: "Acceptance Criteria", value: `${acCount}` },
			{
				label: "Out of Scope",
				value: kit.outOfScope.length > 0 ? kit.outOfScope.join(", ") : "None",
			},
		],
		status: "pending",
	};
}

/**
 * Build proper markdown from a Kit for rendering in the left pane.
 * Replaces the old ASCII buildKitTree() with real markdown.
 */
function buildKitMarkdown(kit: Kit): string {
	const lines: string[] = [];

	lines.push(`## ${kit.domain}`);
	lines.push("");

	for (const req of kit.requirements) {
		lines.push(`### ${req.id}: ${req.name}`);
		if (req.description) {
			lines.push("");
			lines.push(req.description);
		}
		lines.push("");

		for (const ac of req.acceptanceCriteria) {
			const check = ac.status === "pass" ? "x" : " ";
			lines.push(`- [${check}] **${ac.id}**: ${ac.description}`);
		}
		lines.push("");
	}

	if (kit.outOfScope.length > 0) {
		lines.push("---");
		lines.push("");
		lines.push("**Out of scope:**");
		for (const item of kit.outOfScope) {
			lines.push(`- ${item}`);
		}
	}

	return lines.join("\n");
}
