/**
 * /ck:config — View and change CaveKit configuration.
 *
 * Supports interactive selection and direct set: /ck:config preset quality
 */

import type { ExtensionAPI } from "cave";
import { type CaveKitConfig, getConfigWithSources, loadConfig, saveConfig } from "../config/index.js";
import {
	CAVEMAN_LEVELS,
	type CaveKitConfigKey,
	COMMAND_GATE_MODES,
	CONFIG_KEYS,
	isConfigKey,
	MODEL_PRESETS,
	parseConfigValue,
	TIER_GATE_MODES,
} from "../config/types.js";

const CONFIGURABLE_KEYS = [...CONFIG_KEYS];

export function registerConfigCommand(pi: ExtensionAPI, config: CaveKitConfig): void {
	pi.registerCommand("ck:config", {
		description: "View or change CaveKit configuration",
		getArgumentCompletions: (prefix) => {
			if (!prefix.includes(" ")) {
				return CONFIGURABLE_KEYS.filter((key) => key.startsWith(prefix)).map((key) => ({
					value: key,
					label: key,
				}));
			}
			const key = prefix.split(" ")[0];
			return getValueCompletions(key);
		},
		handler: async (args, ctx) => {
			const parts = args.trim().split(/\s+/).filter(Boolean);
			const key = parts[0];
			const value = parts.slice(1).join(" ");
			const options = { cwd: ctx.cwd };

			if (!key) {
				const withSources = getConfigWithSources(options);
				const sourceTag: Record<string, string> = {
					default: "[default]",
					global: "[global] ",
					project: "[project]",
				};
				const lines = [
					"╔══ CaveKit Config ═════════════════════════════════╗",
					...Object.entries(withSources).map(([configKey, entry]) => {
						const tag = sourceTag[entry.source] ?? entry.source;
						return `║  ${tag} ${configKey.padEnd(22)} ${String(entry.value).padEnd(12)} ║`;
					}),
					"╚═══════════════════════════════════════════════════╝",
					"",
					"Sources: [default] built-in  [global] ~/.cave/cavekit.json  [project] .cavekit/config.json",
					"Use /ck:config <key> <value> to change a setting.",
				];
				ctx.ui.notify(lines.join("\n"), "info");
				return;
			}

			if (!isConfigKey(key)) {
				ctx.ui.notify(`Unknown config key: ${key}. Valid keys: ${CONFIGURABLE_KEYS.join(", ")}`, "warning");
				return;
			}

			if (!value) {
				const resolved = loadConfig(options);
				ctx.ui.notify(`Current ${key}: ${String(resolved[key])}`, "info");
				return;
			}

			const parsed = parseConfigValue(key, value);
			if (parsed === undefined) {
				ctx.ui.notify(`Invalid value "${value}" for key "${key}"`, "error");
				return;
			}

			applyConfigValue(config, key, parsed);
			saveConfig({ [key]: parsed }, "local", options);
			ctx.ui.notify(`Set ${key} = ${String(parsed)}`, "info");
		},
	});
}

function applyConfigValue<K extends CaveKitConfigKey>(config: CaveKitConfig, key: K, value: CaveKitConfig[K]): void {
	config[key] = value;
}

function getValueCompletions(key: string): Array<{ value: string; label: string }> | null {
	switch (key) {
		case "preset":
			return MODEL_PRESETS.map((value) => ({ value, label: value }));
		case "tierGateMode":
			return TIER_GATE_MODES.map((value) => ({ value, label: value }));
		case "commandGate":
			return COMMAND_GATE_MODES.map((value) => ({ value, label: value }));
		case "cavemanLevel":
			return CAVEMAN_LEVELS.map((value) => ({ value: String(value), label: String(value) }));
		case "worktreeIsolation":
		case "speculativeReview":
		case "cavemanForSubagents":
		case "scopedContext":
			return [
				{ value: "true", label: "true" },
				{ value: "false", label: "false" },
			];
		default:
			return null;
	}
}
