/**
 * Registers LLM-callable tools for CaveKit SDD operations.
 * These tools are available to both the main agent and build subagents.
 */

import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";
import { acceptanceCheckTool } from "./acceptance-check.js";
import { buildSiteStatusTool } from "./build-site-status.js";
import { convergenceCheckTool } from "./convergence-check.js";
import { kitReadTool } from "./kit-read.js";

export function registerTools(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.registerTool(kitReadTool);
	pi.registerTool(buildSiteStatusTool);
	pi.registerTool(acceptanceCheckTool);
	pi.registerTool(convergenceCheckTool);
	// codex_review registered separately when Codex is available (Phase 2)
}
