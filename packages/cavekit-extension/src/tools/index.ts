/**
 * Registers LLM-callable tools for CaveKit SDD operations.
 * These tools are available to both the main agent and build subagents.
 */

import type { ExtensionAPI } from "cave";
import type { CaveKitConfig } from "../config/index.js";
import { acceptanceCheckTool } from "./acceptance-check.js";
import { buildSiteStatusTool } from "./build-site-status.js";
import { convergenceCheckTool } from "./convergence-check.js";
import { kitReadTool } from "./kit-read.js";
import { ralphReviewTool } from "./ralph-review.js";

export const CAVEKIT_TOOL_NAMES = [
	kitReadTool.name,
	buildSiteStatusTool.name,
	acceptanceCheckTool.name,
	convergenceCheckTool.name,
	ralphReviewTool.name,
] as const;

export type CaveKitToolName = (typeof CAVEKIT_TOOL_NAMES)[number];

export function registerTools(pi: ExtensionAPI, _config: CaveKitConfig): CaveKitToolName[] {
	pi.registerTool(kitReadTool);
	pi.registerTool(buildSiteStatusTool);
	pi.registerTool(acceptanceCheckTool);
	pi.registerTool(convergenceCheckTool);
	pi.registerTool(ralphReviewTool);
	return [...CAVEKIT_TOOL_NAMES];
}
