/**
 * /ck:build — Execute the wave-based build from a build site.
 *
 * Parses the build site, computes wave frontiers, dispatches parallel
 * subagents per wave task, monitors progress via dashboard widget,
 * and runs tier gate review between tiers.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";
import { WaveExecutor } from "../wave/executor.js";
import { BuildDashboardWidget } from "../widgets/build-dashboard.js";

export function registerBuildCommand(pi: ExtensionAPI, config: CaveKitConfig): void {
	pi.registerCommand("ck:build", {
		description: "Execute wave-based build from the build site",
		getArgumentCompletions: async (prefix) => {
			const sitesDir = path.join(process.cwd(), "context", "sites");
			if (!fs.existsSync(sitesDir)) return null;
			const sites = fs
				.readdirSync(sitesDir)
				.filter((f) => f.endsWith(".md") && f.startsWith(prefix))
				.map((f) => ({ value: f.replace(".md", ""), label: f }));
			return sites.length > 0 ? sites : null;
		},
		handler: async (args, ctx) => {
			const cwd = ctx.cwd;
			const sitesDir = path.join(cwd, "context", "sites");

			if (!fs.existsSync(sitesDir)) {
				ctx.ui.notify("No build sites found. Run /ck:architect first.", "warning");
				return;
			}

			// Find build site file
			const siteName = args.trim() || "build-site";
			const siteFile = path.join(sitesDir, `${siteName}.md`);
			if (!fs.existsSync(siteFile)) {
				ctx.ui.notify(`Build site not found: ${siteFile}`, "error");
				return;
			}

			const confirmed = await ctx.ui.confirm(
				"Start Build",
				`Execute build from ${siteName}?\n\nThis will spawn parallel subagents for each wave.`,
			);
			if (!confirmed) return;

			// Register build dashboard widget
			const dashboard = new BuildDashboardWidget(ctx);
			dashboard.mount();

			// Execute waves
			const executor = new WaveExecutor(siteFile, config, ctx, dashboard);
			try {
				await executor.run();
				ctx.ui.notify("Build complete!", "info");
			} catch (err) {
				ctx.ui.notify(`Build failed: ${err instanceof Error ? err.message : String(err)}`, "error");
			} finally {
				dashboard.unmount();
			}
		},
	});
}
