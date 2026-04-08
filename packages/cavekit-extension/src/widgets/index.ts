/**
 * Widget registration for CaveKit.
 * Keyboard shortcuts for toggling TUI surfaces.
 *
 * Widgets registered here:
 *   - BuildDashboardWidget  (T-035 / extension-ui/R1)
 *   - KitReviewerOverlay    (T-036 / extension-ui/R2) — exported for /ck:draft
 *   - TierGateOverlay       (T-037 / extension-ui/R3) — exported for tier-gate hook
 *   - DependencyGraph       (T-038 / extension-ui/R4) — exposed via Ctrl+Shift+D
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";
import { parseBuildSite } from "../wave/executor.js";
import { renderDependencyGraph } from "./dependency-graph.js";

export type { DashboardContext } from "./build-dashboard.js";
// Re-export overlay helpers so commands and hooks can import from a single location.
export { BuildDashboardWidget } from "./build-dashboard.js";
export type { DependencyGraphContext } from "./dependency-graph.js";
export { buildDependencyGraphLines, renderDependencyGraph } from "./dependency-graph.js";
export type { KitReviewerContext, KitReviewResult } from "./kit-reviewer.js";
export { filterApprovedKits, reviewKits } from "./kit-reviewer.js";
export type { TierGateAction, TierGateOverlayContext } from "./tier-gate-overlay.js";
export { showTierGateOverlay } from "./tier-gate-overlay.js";

export function registerWidgets(pi: ExtensionAPI, _config: CaveKitConfig): void {
	// Ctrl+Shift+B — toggle build dashboard (T-035 / AC-4)
	pi.registerShortcut("ctrl+shift+b", {
		description: "Toggle CaveKit build dashboard",
		handler: async (ctx) => {
			// The active BuildDashboardWidget instance is owned by the build command.
			// Notify the user that the shortcut is wired; actual toggle happens via
			// the widget reference passed from WaveExecutor.
			ctx.ui.notify(
				"Use /ck:build to start a build session. Dashboard toggles automatically during builds.",
				"info",
			);
		},
	});

	// Ctrl+Shift+K — show kit overview (hints toward T-036 reviewer)
	pi.registerShortcut("ctrl+shift+k", {
		description: "Show CaveKit kits overview",
		handler: async (ctx) => {
			ctx.ui.notify("Use /ck:draft to generate kits and trigger the kit reviewer.", "info");
		},
	});

	// Ctrl+Shift+G — run gap analysis / inspect
	pi.registerShortcut("ctrl+shift+g", {
		description: "Run CaveKit gap analysis",
		handler: async (ctx) => {
			ctx.ui.notify("Running /ck:inspect…", "info");
			pi.sendUserMessage([{ type: "text", text: "/ck:inspect" }]);
		},
	});

	// Ctrl+Shift+D — show dependency graph for the current build site (T-038)
	pi.registerShortcut("ctrl+shift+d", {
		description: "Show dependency graph for the current build site",
		handler: async (ctx) => {
			const cwd = ctx.cwd;
			const sitePath = path.join(cwd, "context", "plans", "build-site.md");

			if (!fs.existsSync(sitePath)) {
				ctx.ui.notify("No build site found at context/plans/build-site.md. Run /ck:architect first.", "warning");
				return;
			}

			try {
				const content = fs.readFileSync(sitePath, "utf8");
				const tasks = parseBuildSite(content);

				if (tasks.length === 0) {
					ctx.ui.notify("Build site contains no parseable tasks.", "warning");
					return;
				}

				renderDependencyGraph(tasks, {
					ui: ctx.ui,
					say: (text: string) => {
						// Output the graph into the chat thread via a user message
						pi.sendUserMessage([{ type: "text", text }]);
					},
				});
			} catch (err) {
				ctx.ui.notify(
					`Failed to render dependency graph: ${err instanceof Error ? err.message : String(err)}`,
					"error",
				);
			}
		},
	});
}
