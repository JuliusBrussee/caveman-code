/**
 * Tier gate overlay — interactive review surface shown after each tier completes.
 *
 * T-037 (extension-ui/R3):
 * AC-1: Displays findings with severity levels (P0–P3).
 * AC-2: Presents approve / fix / abort options to the user.
 * AC-3: The selected action dismisses the overlay; the build proceeds accordingly.
 * AC-4: Blocks the build loop until the user selects an action.
 */

import type { Finding } from "../types.js";

/** The three actions the user can take at a tier gate. */
export type TierGateAction = "approve" | "fix" | "abort";

export interface TierGateOverlayContext {
	ui: {
		notify: (message: string, type?: "info" | "warning" | "error") => void;
		/** confirm() is reused as a two-choice step; we chain two calls for a 3-way choice. */
		confirm: (title: string, message: string) => Promise<boolean>;
	};
}

/**
 * Show the tier gate overlay and wait for a user decision.
 *
 * AC-4: This function awaits user input and returns only after the user acts.
 * AC-3: Returns the TierGateAction the caller should act upon.
 *
 * Decision flow (two confirm dialogs to cover three options):
 *   Step 1 — "Proceed with this tier?" — Yes → approve, No → go to step 2.
 *   Step 2 — "Fix issues before continuing?" — Yes → fix, No → abort.
 */
export async function showTierGateOverlay(
	tier: number,
	findings: Finding[],
	ctx: TierGateOverlayContext,
): Promise<TierGateAction> {
	// AC-1: Build findings display sorted by severity
	const overlay = buildFindingsDisplay(tier, findings);

	// Notify the user with the full findings summary
	const notifyLevel = findings.some((f) => f.severity === "P0" || f.severity === "P1")
		? "error"
		: findings.length > 0
			? "warning"
			: "info";
	ctx.ui.notify(`Tier ${tier} gate: ${findings.length} finding(s) — see details below.`, notifyLevel);

	// AC-2 + AC-4: Step 1 — Approve vs. escalate
	// Confirm message contains the full findings display (AC-1)
	const proceed = await ctx.ui.confirm(
		`Tier ${tier} Gate — ${findingsSummary(findings)}`,
		`${overlay}\n\nProceed to the next tier? (Yes = approve, No = choose fix or abort)`,
	);

	if (proceed) {
		// AC-3: Approved — overlay dismissed, build continues
		ctx.ui.notify(`Tier ${tier}: approved — proceeding.`, "info");
		return "approve";
	}

	// AC-2 + AC-4: Step 2 — Fix vs. Abort
	const fix = await ctx.ui.confirm(
		`Tier ${tier} Gate — Fix or Abort?`,
		`You chose not to approve.\n\nDo you want to fix the issues before continuing?\n  Yes = pause build so you can address findings\n  No  = abort the entire build`,
	);

	if (fix) {
		// AC-3: Fix — overlay dismissed, build pauses for the user to act
		ctx.ui.notify(`Tier ${tier}: fix requested — build paused.`, "warning");
		return "fix";
	}

	// AC-3: Abort — overlay dismissed, build stops
	ctx.ui.notify(`Tier ${tier}: aborted by user.`, "error");
	return "abort";
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Severity ordering for sort (lower index = higher priority). */
const SEVERITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

/**
 * Build a formatted findings display string sorted by severity.
 * AC-1: Shows severity level alongside each finding description and ref.
 */
function buildFindingsDisplay(tier: number, findings: Finding[]): string {
	const lines: string[] = [];

	lines.push(`Tier ${tier} Gate Review`);
	lines.push("─".repeat(44));

	if (findings.length === 0) {
		lines.push("  No findings — all acceptance criteria appear to be met.");
		lines.push("");
		lines.push("  Status: PASS ✓");
		return lines.join("\n");
	}

	// AC-1: Sort by severity (P0 first)
	const sorted = [...findings].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

	// Group by severity for readability
	const groups = new Map<string, Finding[]>();
	for (const finding of sorted) {
		const group = groups.get(finding.severity) ?? [];
		group.push(finding);
		groups.set(finding.severity, group);
	}

	for (const [severity, group] of groups) {
		const label = severityLabel(severity);
		lines.push(`\n${label} (${group.length})`);
		for (const f of group) {
			const ref = f.requirementRef ? ` [${f.requirementRef}]` : "";
			// Wrap long descriptions at 72 chars
			const desc = f.description.length > 72 ? `${f.description.slice(0, 69)}…` : f.description;
			lines.push(`  •${ref} ${desc}`);
		}
	}

	lines.push("");
	lines.push(findingsSummary(findings));

	return lines.join("\n");
}

function findingsSummary(findings: Finding[]): string {
	const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
	for (const f of findings) {
		if (f.severity in counts) counts[f.severity as keyof typeof counts]++;
	}
	const parts = Object.entries(counts)
		.filter(([, n]) => n > 0)
		.map(([sev, n]) => `${sev}×${n}`);
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
