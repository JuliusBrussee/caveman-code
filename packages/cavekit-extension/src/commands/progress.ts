/**
 * /ck:progress — Show current build progress from the build site and loop log.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";
import { type ExecutorTask, parseBuildSite } from "../wave/executor.js";

export function registerProgressCommand(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.registerCommand("ck:progress", {
		description: "Show current build site progress",
		getArgumentCompletions: () => null,
		handler: async (_args, ctx) => {
			const cwd = ctx.cwd;
			const sitesDir = path.join(cwd, "context", "sites");

			if (!fs.existsSync(sitesDir)) {
				ctx.ui.notify("No build sites found.", "warning");
				return;
			}

			const siteFiles = fs.readdirSync(sitesDir).filter((f) => f.endsWith(".md"));
			if (siteFiles.length === 0) {
				ctx.ui.notify("No build sites found. Run /ck:architect first.", "warning");
				return;
			}

			const siteFile = path.join(sitesDir, siteFiles[siteFiles.length - 1]);
			const content = fs.readFileSync(siteFile, "utf8");
			const tasks = parseBuildSite(content);

			const total = tasks.length;
			const done = tasks.filter((t) => t.status === "done").length;
			const inProgress = tasks.filter((t) => t.status === "in-progress").length;
			const blocked = tasks.filter((t) => t.status === "blocked").length;
			const pending = tasks.filter((t) => t.status === "pending").length;

			const tiers = [...new Set(tasks.map((t) => t.tier))].sort((a, b) => a - b);

			// AC-3: overall completion percentage
			const pct = total > 0 ? Math.round((done / total) * 100) : 0;
			const barLen = 20;
			const filled = Math.round((pct / 100) * barLen);
			const bar = "█".repeat(filled) + "░".repeat(barLen - filled);

			const lines = [
				`Build Site: ${path.basename(siteFile)}`,
				`Progress: ${done}/${total} tasks complete (${pct}%)`,
				`  [${bar}] ${pct}%`,
				`  ✓ Done: ${done}  ● Active: ${inProgress}  ○ Pending: ${pending}  ✗ Blocked: ${blocked}`,
				"",
				"Per-tier breakdown:",
				// AC-2: per-tier breakdown
				...tiers.map((tier) => {
					const tierTasks = tasks.filter((t) => t.tier === tier);
					const tierDone = tierTasks.filter((t) => t.status === "done").length;
					const tierPct = tierTasks.length > 0 ? Math.round((tierDone / tierTasks.length) * 100) : 0;
					return `  Tier ${tier}: ${tierDone}/${tierTasks.length} (${tierPct}%)  ${tierTasks.map((t) => statusIcon(t)).join(" ")}`;
				}),
			];

			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}

function statusIcon(task: ExecutorTask): string {
	switch (task.status) {
		case "done":
			return "✓";
		case "in-progress":
			return "●";
		case "blocked":
			return "✗";
		default:
			return "○";
	}
}
