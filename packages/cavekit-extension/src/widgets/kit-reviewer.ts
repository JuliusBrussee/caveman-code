/**
 * Kit reviewer overlay — interactive approve/reject UI shown after /ck:draft.
 *
 * T-036 (extension-ui/R2):
 * AC-1: After kit generation, displays a navigable tree of kits > requirements > AC.
 * AC-2: User can approve or reject individual kits via confirm dialogs.
 * AC-3: Blocks workflow until the user has confirmed every kit.
 * AC-4: Rejected kits are excluded from the list consumed by /ck:architect.
 */

import type { Kit } from "../types.js";

export interface KitReviewerContext {
	ui: {
		notify: (message: string, type?: "info" | "warning" | "error") => void;
		confirm: (title: string, message: string) => Promise<boolean>;
	};
}

export interface KitReviewResult {
	/** Kits the user approved — these are the only kits architect should use. */
	approvedKits: Kit[];
	/** Kits the user rejected. */
	rejectedKits: Kit[];
}

/**
 * Present an interactive kit review overlay.
 *
 * For each kit the reviewer shows the kit's domain, all its requirements, and
 * all acceptance criteria, then asks the user to approve or reject the kit.
 *
 * AC-3: The function awaits every kit before returning — it blocks the caller
 * until the user has made a decision on every kit in the list.
 */
export async function reviewKits(kits: Kit[], ctx: KitReviewerContext): Promise<KitReviewResult> {
	if (kits.length === 0) {
		ctx.ui.notify("No kits to review.", "warning");
		return { approvedKits: [], rejectedKits: [] };
	}

	ctx.ui.notify(`Kit review: ${kits.length} kit(s) to review. Approve or reject each one.`, "info");

	const approvedKits: Kit[] = [];
	const rejectedKits: Kit[] = [];

	for (let i = 0; i < kits.length; i++) {
		const kit = kits[i];
		// AC-1: Build a navigable tree display for this kit
		const tree = buildKitTree(kit, i + 1, kits.length);

		// AC-2 + AC-3: Confirm dialog — blocks until the user responds
		const approved = await ctx.ui.confirm(`Kit Review (${i + 1}/${kits.length}): ${kit.domain}`, tree);

		if (approved) {
			approvedKits.push(kit);
			ctx.ui.notify(`✓ Approved: ${kit.domain}`, "info");
		} else {
			// AC-4: Rejected kits are tracked separately and not returned to architect
			rejectedKits.push(kit);
			ctx.ui.notify(`✗ Rejected: ${kit.domain} — excluded from architect`, "warning");
		}
	}

	const summary = [
		`Kit review complete.`,
		`Approved: ${approvedKits.map((k) => k.domain).join(", ") || "none"}`,
		`Rejected: ${rejectedKits.map((k) => k.domain).join(", ") || "none"}`,
	].join("  |  ");

	ctx.ui.notify(summary, approvedKits.length > 0 ? "info" : "warning");

	return { approvedKits, rejectedKits };
}

/**
 * Build an ASCII tree string for a single kit showing domain, requirements, and ACs.
 * AC-1: kits > requirements > acceptance criteria hierarchy.
 */
function buildKitTree(kit: Kit, index: number, total: number): string {
	const lines: string[] = [];

	lines.push(`Kit ${index}/${total}: ${kit.domain}`);
	lines.push(`${"─".repeat(40)}`);

	for (let ri = 0; ri < kit.requirements.length; ri++) {
		const req = kit.requirements[ri];
		const isLastReq = ri === kit.requirements.length - 1;
		const reqPrefix = isLastReq ? "└─" : "├─";

		lines.push(`${reqPrefix} ${req.id}: ${req.name}`);
		if (req.description) {
			const descPrefix = isLastReq ? "   " : "│  ";
			// Truncate long descriptions to keep the overlay readable
			const desc = req.description.length > 80 ? `${req.description.slice(0, 77)}…` : req.description;
			lines.push(`${descPrefix}  ${desc}`);
		}

		for (let ai = 0; ai < req.acceptanceCriteria.length; ai++) {
			const ac = req.acceptanceCriteria[ai];
			const isLastAc = ai === req.acceptanceCriteria.length - 1;
			const acBranch = isLastReq ? "   " : "│  ";
			const acPrefix = isLastAc ? "└─" : "├─";
			const statusMark = ac.status === "pass" ? "[✓]" : "[ ]";
			lines.push(`${acBranch}  ${acPrefix} ${statusMark} ${ac.id}: ${ac.description}`);
		}
	}

	if (kit.outOfScope.length > 0) {
		lines.push("");
		lines.push("Out of scope:");
		for (const item of kit.outOfScope) {
			lines.push(`  • ${item}`);
		}
	}

	lines.push("");
	lines.push("Approve this kit? (Yes = include in architect, No = reject)");

	return lines.join("\n");
}

/**
 * Convenience helper: filter a parsed kit list to only the approved ones.
 *
 * AC-4: Use this in the architect command to exclude rejected kits.
 *
 * @example
 * const { approvedKits } = await reviewKits(allKits, ctx);
 * const kitsForArchitect = filterApprovedKits(allKits, approvedKits);
 */
export function filterApprovedKits(allKits: Kit[], approvedKits: Kit[]): Kit[] {
	const approvedDomains = new Set(approvedKits.map((k) => k.domain));
	return allKits.filter((k) => approvedDomains.has(k.domain));
}
