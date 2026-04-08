/**
 * Widget registration for CaveKit.
 * Keyboard shortcuts for toggling TUI surfaces.
 */

import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";

export function registerWidgets(pi: ExtensionAPI, _config: CaveKitConfig): void {
	// Ctrl+Shift+B — toggle build dashboard (visible during active builds)
	pi.registerShortcut("ctrl+shift+b", {
		description: "Toggle CaveKit build dashboard",
		handler: async (ctx) => {
			ctx.ui.notify("Use /ck:build to start a build session.", "info");
		},
	});

	// Ctrl+Shift+K — show kit overview
	pi.registerShortcut("ctrl+shift+k", {
		description: "Show CaveKit kits overview",
		handler: async (ctx) => {
			ctx.ui.notify("Use /ck:draft or /ck:progress to manage kits.", "info");
		},
	});

	// Ctrl+Shift+G — run gap analysis
	pi.registerShortcut("ctrl+shift+g", {
		description: "Run CaveKit gap analysis",
		handler: async (ctx) => {
			ctx.ui.notify("Running /ck:inspect…", "info");
			// Trigger inspect command via message
			pi.sendUserMessage([{ type: "text", text: "/ck:inspect" }]);
		},
	});
}
