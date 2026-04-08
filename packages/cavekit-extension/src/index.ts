/**
 * CaveKit Pi Extension
 *
 * Integrates the CaveKit DABI lifecycle (Draft → Architect → Build → Inspect)
 * as a first-class Pi coding agent extension.
 *
 * Extension entry point — export default receives ExtensionAPI.
 * Works on both Cave Pi (piConfig.name = "cave") and vanilla Pi (piConfig.name = "pi").
 */

import * as path from "node:path";
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

/**
 * Detect whether the extension is running inside Cave Pi.
 *
 * Cave Pi compiles its binary as "cave" and sets piConfig.name = "cave".
 * We inspect the process executable name as the most reliable signal
 * available to an extension at init time (no piConfig is exposed via ExtensionAPI).
 */
function detectIsCavePi(): boolean {
	const execName = path.basename(process.execPath, path.extname(process.execPath)).toLowerCase();
	// "cave" binary = Cave Pi; anything else (pi, node, bun, tsx, …) = vanilla Pi or dev
	return execName === "cave";
}

export default function cavekit(pi: ExtensionAPI) {
	try {
		const isCavePi = detectIsCavePi();

		// Phase 1: Load config (.cavekit/config or ~/.pi/cavekit/config or defaults)
		// loadConfig never throws — missing files are silently ignored.
		const config = loadConfig(pi);

		// Phase 2: Register all /ck:* slash commands
		// Commands are safe on vanilla Pi: they only fire when explicitly invoked.
		registerCommands(pi, config);

		// Phase 3: Register LLM-callable tools
		// Tools are registered globally; they are inert until the LLM calls them.
		registerTools(pi, config);

		// Phase 4: Set up lifecycle hooks
		// All hooks guard against missing CaveKit state gracefully.
		registerHooks(pi, config);

		// Phase 5: Register TUI shortcuts
		// Shortcuts are no-ops until invoked, safe on vanilla Pi.
		registerWidgets(pi, config);

		// Announce environment for diagnostics (debug builds only)
		if (process.env.CAVEKIT_DEBUG) {
			console.error(`[cavekit] Loaded on ${isCavePi ? "Cave Pi" : "vanilla Pi"}`);
		}
	} catch (err) {
		// Surface the error as a non-fatal console message so vanilla Pi
		// continues running even if CaveKit initialization unexpectedly fails.
		const message = err instanceof Error ? err.message : String(err);
		console.error(`[cavekit] Extension failed to initialize: ${message}`);
		// Re-throw so Cave Pi operators can diagnose problems in their environment.
		if (process.env.CAVEKIT_DEBUG) {
			throw err;
		}
	}
}
