/**
 * /ck:config — View and change CaveKit configuration.
 *
 * Supports interactive selection and direct set: /ck:config preset quality
 */

import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";
import { saveConfig } from "../config/index.js";
import type { CavemanLevel, ModelPreset, TierGateMode } from "../config/types.js";

const CONFIGURABLE_KEYS = [
	"preset",
	"tierGateMode",
	"commandGate",
	"cavemanLevel",
	"maxIterations",
	"maxParallel",
	"worktreeIsolation",
	"speculativeReview",
];

export function registerConfigCommand(pi: ExtensionAPI, config: CaveKitConfig): void {
	pi.registerCommand("ck:config", {
		description: "View or change CaveKit configuration",
		getArgumentCompletions: (prefix) => {
			if (!prefix.includes(" ")) {
				return CONFIGURABLE_KEYS.filter((k) => k.startsWith(prefix)).map((k) => ({ value: k, label: k }));
			}
			const key = prefix.split(" ")[0];
			return getValueCompletions(key);
		},
		handler: async (args, ctx) => {
			const parts = args.trim().split(/\s+/);
			const key = parts[0];
			const value = parts.slice(1).join(" ");

			if (!key) {
				// Show current config
				const lines = [
					"╔══ CaveKit Config ══════════════════╗",
					...Object.entries(config).map(([k, v]) => `║  ${k.padEnd(22)} ${String(v).padEnd(10)} ║`),
					"╚════════════════════════════════════╝",
					"",
					"Use /ck:config <key> <value> to change a setting.",
				];
				ctx.ui.notify(lines.join("\n"), "info");
				return;
			}

			if (!CONFIGURABLE_KEYS.includes(key)) {
				ctx.ui.notify(`Unknown config key: ${key}. Valid keys: ${CONFIGURABLE_KEYS.join(", ")}`, "warning");
				return;
			}

			if (!value) {
				ctx.ui.notify(`Current ${key}: ${config[key as keyof CaveKitConfig]}`, "info");
				return;
			}

			// Apply and persist
			const parsed = parseValue(key, value);
			if (parsed === null) {
				ctx.ui.notify(`Invalid value "${value}" for key "${key}"`, "error");
				return;
			}

			(config as unknown as Record<string, unknown>)[key] = parsed;
			saveConfig({ [key]: parsed } as Partial<CaveKitConfig>, "local");
			ctx.ui.notify(`Set ${key} = ${String(parsed)}`, "info");
		},
	});
}

function getValueCompletions(key: string): Array<{ value: string; label: string }> | null {
	switch (key) {
		case "preset":
			return (["expensive", "quality", "balanced", "fast"] as ModelPreset[]).map((v) => ({ value: v, label: v }));
		case "tierGateMode":
			return (["severity", "strict", "permissive", "off"] as TierGateMode[]).map((v) => ({ value: v, label: v }));
		case "commandGate":
			return ["allowlist", "blocklist", "codex", "off"].map((v) => ({ value: v, label: v }));
		case "cavemanLevel":
			return (["0", "1", "2", "3"] as string[]).map((v) => ({ value: v, label: v }));
		case "worktreeIsolation":
		case "speculativeReview":
			return [
				{ value: "true", label: "true" },
				{ value: "false", label: "false" },
			];
		default:
			return null;
	}
}

function parseValue(key: string, value: string): unknown {
	switch (key) {
		case "preset":
			return ["expensive", "quality", "balanced", "fast"].includes(value) ? value : null;
		case "tierGateMode":
			return ["severity", "strict", "permissive", "off"].includes(value) ? value : null;
		case "commandGate":
			return ["allowlist", "blocklist", "codex", "off"].includes(value) ? value : null;
		case "cavemanLevel": {
			const n = Number(value);
			return [0, 1, 2, 3].includes(n) ? (n as CavemanLevel) : null;
		}
		case "maxIterations":
		case "maxParallel": {
			const n = Number(value);
			return Number.isInteger(n) && n > 0 ? n : null;
		}
		case "worktreeIsolation":
		case "speculativeReview":
			if (value === "true") return true;
			if (value === "false") return false;
			return null;
		default:
			return value || null;
	}
}
