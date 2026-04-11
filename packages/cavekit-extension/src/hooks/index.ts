/**
 * Lifecycle hook registrations for CaveKit.
 */

import type { ExtensionAPI } from "cave";
import type { CaveKitConfig } from "../config/index.js";
import { registerCommandSafetyGate } from "./command-safety-gate.js";
import { registerCompactionHook } from "./compaction.js";
import { registerContextInjectionHook } from "./context-injection.js";
import { registerConvergenceMonitor } from "./convergence-monitor.js";
import { registerSkillsDiscoveryHook } from "./skills-discovery.js";

export const CAVEKIT_BASE_HOOK_EVENT_NAMES = [
	"before_agent_start",
	"turn_end",
	"agent_end",
	"session_before_compact",
	"resources_discover",
] as const;

export const CAVEKIT_COMMAND_GATE_HOOK_EVENT_NAMES = ["tool_call"] as const;

export type CaveKitHookEventName =
	| (typeof CAVEKIT_BASE_HOOK_EVENT_NAMES)[number]
	| (typeof CAVEKIT_COMMAND_GATE_HOOK_EVENT_NAMES)[number];

export function registerHooks(pi: ExtensionAPI, config: CaveKitConfig): CaveKitHookEventName[] {
	const registered: CaveKitHookEventName[] = [];

	// Inject DESIGN.md and kit context into every agent start
	registerContextInjectionHook(pi, config);
	registered.push("before_agent_start");

	// Intercept bash tool calls when command gate is enabled
	if (config.commandGate !== "off") {
		registerCommandSafetyGate(pi, config);
		registered.push("tool_call");
	}

	// Monitor convergence across turns
	registerConvergenceMonitor(pi, config);
	registered.push("turn_end", "agent_end");

	// Preserve CaveKit state during context compaction
	registerCompactionHook(pi, config);
	registered.push("session_before_compact");

	// Register bundled CaveKit skills with the resource loader (T-011)
	registerSkillsDiscoveryHook(pi, config);
	registered.push("resources_discover");

	return registered;
}
