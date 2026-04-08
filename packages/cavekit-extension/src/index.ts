/**
 * CaveKit Pi Extension
 *
 * Integrates the CaveKit DABI lifecycle (Draft → Architect → Build → Inspect)
 * as a first-class Pi coding agent extension.
 *
 * Extension entry point — export default receives ExtensionAPI.
 */

import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import { registerCommands } from "./commands/index.js";
import { loadConfig } from "./config/index.js";
import { registerHooks } from "./hooks/index.js";
import { registerTools } from "./tools/index.js";
import { registerWidgets } from "./widgets/index.js";

export type {
	AcceptanceCriterion,
	BuildSite,
	BuildTask,
	Finding,
	FindingSeverity,
	Kit,
	Requirement,
	TaskStatus,
} from "./types.js";

export default function cavekit(pi: ExtensionAPI) {
	// Phase 1: Load config (.cavekit/config or defaults)
	const config = loadConfig(pi);

	// Phase 2: Register all /ck:* slash commands
	registerCommands(pi, config);

	// Phase 3: Register LLM-callable tools
	registerTools(pi, config);

	// Phase 4: Set up lifecycle hooks (safety gate, context injection, convergence)
	registerHooks(pi, config);

	// Phase 5: Initialize TUI widgets (build dashboard, wave status)
	registerWidgets(pi, config);
}
