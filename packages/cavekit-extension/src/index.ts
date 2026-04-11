/**
 * CaveKit Pi Extension
 *
 * Integrates CaveKit DABI lifecycle (Draft → Architect → Build → Inspect)
 * as first-class Pi coding agent extension.
 *
 * Extension entry point — export default receives ExtensionAPI.
 * Works on both Cave Pi (`cave`) and vanilla Pi (`pi`), degrading gracefully
 * when thin-fork-only features are absent.
 */

import type { ExtensionAPI } from "cave";
import { registerCommands, type CaveKitCommandId } from "./commands/index.js";
import { type CaveKitConfig, type ConfigWithSources } from "./config/index.js";
import { registerHooks, type CaveKitHookEventName } from "./hooks/index.js";
import { initRtkExec } from "./rtk-exec.js";
import { createRuntime, type CaveKitHostCapabilities, type CaveKitHostInfo } from "./runtime.js";
import { registerTools, type CaveKitToolName } from "./tools/index.js";
import { registerWidgets, type CaveKitShortcut } from "./widgets/index.js";

export type {
	AcceptanceCriterion,
	BuildDependencyEdge,
	BuildSite,
	BuildTask,
	BuildTaskStatus,
	Finding,
	FindingSeverity,
	Kit,
	Requirement,
	TaskStatus,
} from "./types.js";
export { BUILD_TASK_STATUSES, FINDING_SEVERITIES, isTaskComplete, isTaskStatus, normalizeTaskStatus } from "./types.js";
export type { ConfigEntry, ConfigResolutionOptions, ResolvedConfig } from "./config/index.js";
export { CONFIG_PATHS, getConfigWithSources, loadConfig, resolveConfig, saveConfig } from "./config/index.js";
export type {
	CaveKitConfig,
	CaveKitConfigKey,
	CaveKitPhase,
	CaveKitPhase as CaveKitModelPhase,
	CaveKitConfigValue,
	CavemanLevel,
	CommandGateMode,
	ModelPreset,
	TierGateMode,
} from "./config/types.js";
export {
	CAVEMAN_LEVELS,
	COMMAND_GATE_MODES,
	CONFIG_KEYS,
	DEFAULT_CONFIG,
	MODEL_PRESETS,
	PRESET_MODELS,
	TIER_GATE_MODES,
	isConfigKey,
	parseConfigValue,
	sanitizeConfigValue,
} from "./config/types.js";
export { CAVEKIT_COMMAND_IDS } from "./commands/index.js";
export { CAVEKIT_BASE_HOOK_EVENT_NAMES, CAVEKIT_COMMAND_GATE_HOOK_EVENT_NAMES } from "./hooks/index.js";
export { CAVEKIT_TOOL_NAMES } from "./tools/index.js";
export { CAVEKIT_SHORTCUTS } from "./widgets/index.js";
export type { CaveKitHostCapabilities, CaveKitHostFlavor, CaveKitHostInfo, CaveKitRuntime } from "./runtime.js";
export { createRuntime, detectHost, getHostCapabilities } from "./runtime.js";

export interface CaveKitBootstrapResult {
	host: CaveKitHostInfo;
	capabilities: CaveKitHostCapabilities;
	config: CaveKitConfig;
	configWithSources: ConfigWithSources;
	registration: {
		commands: CaveKitCommandId[];
		hooks: CaveKitHookEventName[];
		tools: CaveKitToolName[];
		widgets: CaveKitShortcut[];
	};
}

export default function cavekit(pi: ExtensionAPI): CaveKitBootstrapResult | void {
	try {
		const runtime = createRuntime(pi);
		const commands = registerCommands(pi, runtime.config);
		const tools = registerTools(pi, runtime.config);
		const hooks = registerHooks(pi, runtime.config);
		const widgets = registerWidgets(pi, runtime.config);

		initRtkExec().catch(() => {
			/* non-fatal — rtkExec falls back to direct exec */
		});

		if (process.env.CAVEKIT_DEBUG) {
			console.error(`[cavekit] Loaded on ${runtime.host.flavor}`);
		}

		return {
			host: runtime.host,
			capabilities: runtime.capabilities,
			config: runtime.config,
			configWithSources: runtime.configWithSources,
			registration: {
				commands,
				hooks,
				tools,
				widgets,
			},
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`[cavekit] Extension failed to initialize: ${message}`);
		if (process.env.CAVEKIT_DEBUG) {
			throw err;
		}
	}
}
