import * as path from "node:path";
import type { ExtensionAPI } from "cave";
import { type ConfigResolutionOptions, type ConfigWithSources, resolveConfig } from "./config/index.js";
import type { CaveKitConfig } from "./config/types.js";

export type CaveKitHostFlavor = "cave" | "pi" | "unknown";

export interface CaveKitHostInfo {
	flavor: CaveKitHostFlavor;
	executableName: string;
}

export interface CaveKitHostCapabilities {
	events: boolean;
	commands: boolean;
	tools: boolean;
	shortcuts: boolean;
}

export interface CaveKitRuntime {
	api: ExtensionAPI;
	config: CaveKitConfig;
	configWithSources: ConfigWithSources;
	host: CaveKitHostInfo;
	capabilities: CaveKitHostCapabilities;
}

export function detectHost(execPath = process.execPath): CaveKitHostInfo {
	const executableName = path.basename(execPath, path.extname(execPath)).toLowerCase();

	if (executableName === "cave") {
		return { flavor: "cave", executableName };
	}

	if (executableName === "pi") {
		return { flavor: "pi", executableName };
	}

	return { flavor: "unknown", executableName };
}

export function getHostCapabilities(api: ExtensionAPI): CaveKitHostCapabilities {
	return {
		events: typeof api.on === "function",
		commands: typeof api.registerCommand === "function",
		tools: typeof api.registerTool === "function",
		shortcuts: typeof api.registerShortcut === "function",
	};
}

export function createRuntime(api: ExtensionAPI, options?: ConfigResolutionOptions): CaveKitRuntime {
	const resolved = resolveConfig(options);

	return {
		api,
		config: resolved.values,
		configWithSources: resolved.withSources,
		host: detectHost(),
		capabilities: getHostCapabilities(api),
	};
}
