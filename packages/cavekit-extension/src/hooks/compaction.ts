/**
 * session_before_compact hook — preserve CaveKit SDD state during compaction.
 *
 * Injects a compact summary of kit status, build site state, and active wave
 * into the compaction context so CaveKit-critical state survives context window resets.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";
import { parseBuildSite } from "../wave/executor.js";

export function registerCompactionHook(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.on("session_before_compact", async (_event, ctx) => {
		const cwd = ctx.cwd;
		const summary: string[] = ["## CaveKit State (preserved through compaction)"];

		// Kit summary
		const kitsDir = path.join(cwd, "context", "kits");
		if (fs.existsSync(kitsDir)) {
			const kits = fs.readdirSync(kitsDir).filter((f) => f.endsWith(".md"));
			if (kits.length > 0) {
				summary.push(
					`\n**Kits (${kits.length}):** ${kits.map((f) => f.replace("kit-", "").replace(".md", "")).join(", ")}`,
				);
			}
		}

		// Build site status
		const sitesDir = path.join(cwd, "context", "sites");
		if (fs.existsSync(sitesDir)) {
			const siteFiles = fs.readdirSync(sitesDir).filter((f) => f.endsWith(".md"));
			if (siteFiles.length > 0) {
				const siteFile = path.join(sitesDir, siteFiles[siteFiles.length - 1]);
				const tasks = parseBuildSite(fs.readFileSync(siteFile, "utf8"));
				const done = tasks.filter((t) => t.status === "done").length;
				const blocked = tasks.filter((t) => t.status === "blocked").length;
				summary.push(
					`\n**Build Site:** ${path.basename(siteFile)} — ${done}/${tasks.length} done, ${blocked} blocked`,
				);
				// Include blocked tasks explicitly so they're not lost
				const blockedTasks = tasks.filter((t) => t.status === "blocked");
				if (blockedTasks.length > 0) {
					summary.push(`**Blocked tasks:** ${blockedTasks.map((t) => t.id).join(", ")}`);
				}
			}
		}

		// DESIGN.md presence
		const designPath = path.join(cwd, "DESIGN.md");
		if (fs.existsSync(designPath)) {
			summary.push(`\n**DESIGN.md:** present — constraints enforced across all builds`);
		}

		if (summary.length > 1) {
			_event.customInstructions =
				(_event.customInstructions ? `${_event.customInstructions}\n\n` : "") + summary.join("\n");
		}
	});
}
