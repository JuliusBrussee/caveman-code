/**
 * /ck:help — Show CaveKit command reference.
 */

import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";

const HELP_TEXT = `
╔══ CaveKit — Spec-Driven Development for Pi ═══════════════════╗
║                                                                ║
║  DABI Lifecycle:                                               ║
║    /ck:draft <description>   Decompose idea into domain kits   ║
║    /ck:architect [name]      Build tiered task graph from kits ║
║    /ck:build [site]          Execute wave-based parallel build  ║
║    /ck:inspect               Gap analysis vs. requirements     ║
║                                                                ║
║  Supporting:                                                   ║
║    /ck:research <topic>      Parallel research → brief         ║
║    /ck:design <sub>          Manage DESIGN.md constraints      ║
║    /ck:progress              Show build progress               ║
║    /ck:config [key] [value]  View/change configuration         ║
║    /ck:help                  This help                         ║
║                                                                ║
║  Design subcommands: create | audit | import | show            ║
║                                                                ║
║  Config keys: preset | tierGateMode | commandGate |            ║
║               cavemanLevel | maxIterations | maxParallel |     ║
║               worktreeIsolation | speculativeReview            ║
╚════════════════════════════════════════════════════════════════╝
`.trim();

export function registerHelpCommand(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.registerCommand("ck:help", {
		description: "Show CaveKit command reference",
		getArgumentCompletions: () => null,
		handler: async (_args, ctx) => {
			ctx.ui.notify(HELP_TEXT, "info");
		},
	});
}
