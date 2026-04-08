/**
 * Lifecycle hook registrations for CaveKit.
 */

import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";
import { registerCommandSafetyGate } from "./command-safety-gate.js";
import { registerCompactionHook } from "./compaction.js";
import { registerContextInjectionHook } from "./context-injection.js";
import { registerConvergenceMonitor } from "./convergence-monitor.js";
import { registerSkillsDiscoveryHook } from "./skills-discovery.js";

export function registerHooks(pi: ExtensionAPI, config: CaveKitConfig): void {
	// Inject DESIGN.md and kit context into every agent start
	registerContextInjectionHook(pi, config);

	// Intercept bash tool calls when command gate is enabled
	if (config.commandGate !== "off") {
		registerCommandSafetyGate(pi, config);
	}

	// Monitor convergence across turns
	registerConvergenceMonitor(pi, config);

	// Preserve CaveKit state during context compaction
	registerCompactionHook(pi, config);

	// Register bundled CaveKit skills with the resource loader (T-011)
	registerSkillsDiscoveryHook(pi, config);
}
