/**
 * session_before_compact hook — preserve CaveKit SDD state during compaction.
 *
 * AC-1: Serializes phase, kit refs, and build progress into the compaction
 *       customInstructions when an SDD workflow is active.
 * AC-2: Returns immediately (no-op) when no SDD workflow is active.
 * AC-3: Uses only synchronous fs operations to avoid delaying compaction.
 *
 * An SDD workflow is considered active when `.cavekit/` exists in cwd
 * (written by `ck:init`).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";
import { parseBuildSite } from "../wave/executor.js";

/** Return true when a CaveKit SDD workflow is initialised in `cwd`. */
function isSddActive(cwd: string): boolean {
	return fs.existsSync(path.join(cwd, ".cavekit"));
}

export function registerCompactionHook(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.on("session_before_compact", (event, ctx) => {
		const cwd = ctx.cwd;

		// AC-2: no-op when no SDD workflow is active
		if (!isSddActive(cwd)) return;

		const summary: string[] = ["## CaveKit State (preserved through compaction)"];

		// --- Phase: infer from active build site or kit presence ---
		const kitsDir = path.join(cwd, "context", "kits");
		const sitesDir = path.join(cwd, "context", "sites");
		const hasKits = fs.existsSync(kitsDir) && fs.readdirSync(kitsDir).some((f) => f.endsWith(".md"));
		const hasSites = fs.existsSync(sitesDir) && fs.readdirSync(sitesDir).some((f) => f.endsWith(".md"));

		let phase = "design";
		if (hasSites) phase = "build";
		else if (hasKits) phase = "architect";
		summary.push(`\n**Phase:** ${phase}`);

		// --- Kit refs ---
		if (hasKits) {
			const kits = fs.readdirSync(kitsDir).filter((f) => f.endsWith(".md"));
			const kitNames = kits.map((f) => f.replace(/^kit-/, "").replace(/\.md$/, ""));
			summary.push(`**Kits (${kits.length}):** ${kitNames.join(", ")}`);
		}

		// --- Build site progress ---
		if (hasSites) {
			const siteFiles = fs.readdirSync(sitesDir).filter((f) => f.endsWith(".md"));
			// Use the most recently modified site file
			const siteFile = path.join(sitesDir, siteFiles[siteFiles.length - 1]);
			const tasks = parseBuildSite(fs.readFileSync(siteFile, "utf8"));
			const done = tasks.filter((t) => t.status === "done").length;
			const inProgress = tasks.filter((t) => t.status === "in-progress").length;
			const blocked = tasks.filter((t) => t.status === "blocked").length;
			summary.push(
				`**Build Site:** ${path.basename(siteFile)} — ${done}/${tasks.length} done, ${inProgress} in-progress, ${blocked} blocked`,
			);

			// Collect all kit refs referenced by in-progress tasks so they survive compaction
			const activeKitRefs = [
				...new Set(
					tasks.filter((t) => t.status === "in-progress" || t.status === "pending").flatMap((t) => t.kitRefs),
				),
			];
			if (activeKitRefs.length > 0) {
				summary.push(`**Active Kit Refs:** ${activeKitRefs.join(", ")}`);
			}

			// Highlight blocked tasks explicitly so they are not forgotten
			const blockedTasks = tasks.filter((t) => t.status === "blocked");
			if (blockedTasks.length > 0) {
				summary.push(`**Blocked tasks:** ${blockedTasks.map((t) => t.id).join(", ")}`);
			}
		}

		// --- DESIGN.md presence ---
		const designPath = path.join(cwd, "DESIGN.md");
		if (fs.existsSync(designPath)) {
			summary.push(`\n**DESIGN.md:** present — constraints enforced across all builds`);
		}

		// AC-3: mutate customInstructions synchronously; no awaits, no network calls
		if (summary.length > 1) {
			event.customInstructions =
				(event.customInstructions ? `${event.customInstructions}\n\n` : "") + summary.join("\n");
		}
	});
}
