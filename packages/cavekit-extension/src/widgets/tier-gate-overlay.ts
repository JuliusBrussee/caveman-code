/**
 * Tier gate overlay — interactive two-pane review surface shown after each tier.
 *
 * T-037 (extension-ui/R3):
 * AC-1: Displays findings with severity levels (P0–P3) as rendered markdown.
 * AC-2: Presents approve / fix / abort options to the user via the review pane.
 * AC-3: The selected action dismisses the overlay; the build proceeds accordingly.
 * AC-4: Blocks the build loop until the user selects an action.
 */

import type { Finding, ReviewItem } from "../types.js";
import { type ReviewOverlayContext, showReviewOverlay } from "./review-pane.js";

/** The three actions the user can take at a tier gate. */
export type TierGateAction = "approve" | "fix" | "abort";

export type TierGateOverlayContext = ReviewOverlayContext;

/**
 * Show the tier gate overlay and wait for a user decision.
 *
 * AC-4: This function awaits user input and returns only after the user acts.
 * AC-3: Returns the TierGateAction the caller should act upon.
 *
 * Action mapping from the review pane:
 *   approved → "approve" (proceed to next tier)
 *   rejected → "abort"  (stop the build)
 *   skipped / dismissed → "fix" (pause build for the user to address findings)
 */
export async function showTierGateOverlay(
	tier: number,
	findings: Finding[],
	ctx: TierGateOverlayContext,
): Promise<TierGateAction> {
	const notifyLevel = findings.some((f) => f.severity === "P0" || f.severity === "P1")
		? "error"
		: findings.length > 0
			? "warning"
			: "info";
	ctx.ui.notify(`Tier ${tier} gate: ${findings.length} finding(s) — see details below.`, notifyLevel);

	const item = buildTierGateReviewItem(tier, findings);

	const result = await showReviewOverlay([item], ctx, {
		title: `Tier ${tier} Gate`,
		allowSkip: true, // "skip" maps to "fix"
	});

	const status = result.items[0]?.status ?? "skipped";

	if (status === "approved") {
		ctx.ui.notify(`Tier ${tier}: approved — proceeding.`, "info");
		return "approve";
	}

	if (status === "rejected") {
		ctx.ui.notify(`Tier ${tier}: aborted by user.`, "error");
		return "abort";
	}

	// skipped, pending, or dismissed → fix
	ctx.ui.notify(`Tier ${tier}: fix requested — build paused.`, "warning");
	return "fix";
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Severity ordering for sort (lower index = higher priority). */
const SEVERITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

function buildTierGateReviewItem(tier: number, findings: Finding[]): ReviewItem {
	return {
		id: `tier-${tier}-gate`,
		title: `Tier ${tier} Gate — ${findingsSummary(findings)}`,
		markdownContent: buildFindingsMarkdown(tier, findings),
		metadata: buildFindingsMetadata(findings),
		status: "pending",
	};
}

/**
 * Build markdown-formatted findings for the left pane.
 */
function buildFindingsMarkdown(tier: number, findings: Finding[]): string {
	const lines: string[] = [];

	lines.push(`## Tier ${tier} Gate Review`);
	lines.push("");

	if (findings.length === 0) {
		lines.push("No findings — all acceptance criteria appear to be met.");
		lines.push("");
		lines.push("**Status: PASS**");
		return lines.join("\n");
	}

	// Sort by severity (P0 first)
	const sorted = [...findings].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

	// Group by severity
	const groups = new Map<string, Finding[]>();
	for (const finding of sorted) {
		const group = groups.get(finding.severity) ?? [];
		group.push(finding);
		groups.set(finding.severity, group);
	}

	for (const [severity, group] of groups) {
		lines.push(`### ${severityLabel(severity)} (${group.length})`);
		lines.push("");
		for (const f of group) {
			const ref = f.requirementRef ? ` \`[${f.requirementRef}]\`` : "";
			lines.push(`- ${f.description}${ref}`);
		}
		lines.push("");
	}

	lines.push("---");
	lines.push("");
	lines.push(`**Summary:** ${findingsSummary(findings)}`);
	lines.push("");
	lines.push("**Actions:** Approve = proceed, Reject = abort, Skip = pause & fix");

	return lines.join("\n");
}

function buildFindingsMetadata(findings: Finding[]): ReviewItem["metadata"] {
	const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
	for (const f of findings) {
		if (f.severity in counts) counts[f.severity as keyof typeof counts]++;
	}

	return [
		{ label: "Total Findings", value: `${findings.length}` },
		{ label: "P0 — Critical", value: `${counts.P0}` },
		{ label: "P1 — High", value: `${counts.P1}` },
		{ label: "P2 — Medium", value: `${counts.P2}` },
		{ label: "P3 — Low", value: `${counts.P3}` },
		{
			label: "Blocking",
			value: counts.P0 + counts.P1 > 0 ? "Yes (P0/P1 present)" : "No",
		},
	];
}

function findingsSummary(findings: Finding[]): string {
	const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
	for (const f of findings) {
		if (f.severity in counts) counts[f.severity as keyof typeof counts]++;
	}
	const parts = Object.entries(counts)
		.filter(([, n]) => n > 0)
		.map(([sev, n]) => `${sev}x${n}`);
	return parts.length > 0 ? parts.join("  ") : "0 findings";
}

function severityLabel(severity: string): string {
	switch (severity) {
		case "P0":
			return "P0 — CRITICAL";
		case "P1":
			return "P1 — HIGH";
		case "P2":
			return "P2 — MEDIUM";
		case "P3":
			return "P3 — LOW";
		default:
			return severity;
	}
}
