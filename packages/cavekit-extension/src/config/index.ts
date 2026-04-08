/**
 * Config loading for CaveKit.
 *
 * Resolution order (last wins):
 *   1. DEFAULT_CONFIG (built-in defaults)
 *   2. Global config:  ~/.cave/cavekit.json
 *   3. Project-local:  <cwd>/.cavekit/config.json
 *
 * Both config files are optional JSON files. A KEY=VALUE flat format is also
 * accepted for convenience.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import { type CaveKitConfig, DEFAULT_CONFIG } from "./types.js";

/** The source a config value came from. */
export type ConfigSource = "default" | "global" | "project";

/** A single resolved config entry annotated with its source. */
export interface ConfigEntry {
	value: string | number | boolean;
	source: ConfigSource;
}

/** The full resolved config with per-key provenance information. */
export type ConfigWithSources = Record<keyof CaveKitConfig, ConfigEntry>;

/** Canonical config file paths. */
export const CONFIG_PATHS = {
	global: () => path.join(os.homedir(), ".cave", "cavekit.json"),
	project: (cwd = process.cwd()) => path.join(cwd, ".cavekit", "config.json"),
} as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readConfigFile(filePath: string): Partial<CaveKitConfig> {
	try {
		if (!fs.existsSync(filePath)) return {};
		const raw = fs.readFileSync(filePath, "utf8").trim();
		if (!raw) return {};
		// Support both JSON and simple KEY=VALUE format
		if (raw.startsWith("{")) {
			return JSON.parse(raw) as Partial<CaveKitConfig>;
		}
		const result: Record<string, unknown> = {};
		for (const line of raw.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const eq = trimmed.indexOf("=");
			if (eq === -1) continue;
			const key = trimmed.slice(0, eq).trim();
			const val = trimmed.slice(eq + 1).trim();
			// Coerce booleans and numbers
			if (val === "true") result[key] = true;
			else if (val === "false") result[key] = false;
			else if (/^\d+$/.test(val)) result[key] = Number(val);
			else result[key] = val;
		}
		return result as Partial<CaveKitConfig>;
	} catch {
		return {};
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load the resolved CaveKit config, merging defaults → global → project.
 *
 * The optional `_pi` parameter is accepted for API compatibility with callers
 * that pass an ExtensionAPI instance; it is not used because the config system
 * reads files directly.
 */
export function loadConfig(_pi?: ExtensionAPI): CaveKitConfig {
	const cwd = process.cwd();
	const globalOverrides = readConfigFile(CONFIG_PATHS.global());
	const localOverrides = readConfigFile(CONFIG_PATHS.project(cwd));

	// Local takes precedence over global, global over defaults
	return { ...DEFAULT_CONFIG, ...globalOverrides, ...localOverrides };
}

/**
 * Return the resolved config with per-value provenance information.
 *
 * Each field is annotated with one of:
 *   - "default"  — value comes from DEFAULT_CONFIG
 *   - "global"   — value comes from ~/.cave/cavekit.json
 *   - "project"  — value comes from .cavekit/config.json
 *
 * This is used by the /ck:config command to show sources (AC-4 of T-010).
 */
export function getConfigWithSources(_pi?: ExtensionAPI): ConfigWithSources {
	const cwd = process.cwd();
	const globalOverrides = readConfigFile(CONFIG_PATHS.global());
	const localOverrides = readConfigFile(CONFIG_PATHS.project(cwd));

	const result = {} as Record<string, ConfigEntry>;

	for (const key of Object.keys(DEFAULT_CONFIG) as Array<keyof CaveKitConfig>) {
		if (key in localOverrides) {
			result[key] = {
				value: (localOverrides[key] ?? DEFAULT_CONFIG[key]) as string | number | boolean,
				source: "project",
			};
		} else if (key in globalOverrides) {
			result[key] = {
				value: (globalOverrides[key] ?? DEFAULT_CONFIG[key]) as string | number | boolean,
				source: "global",
			};
		} else {
			result[key] = {
				value: DEFAULT_CONFIG[key] as string | number | boolean,
				source: "default",
			};
		}
	}

	return result as ConfigWithSources;
}

/**
 * Persist a partial config update to disk.
 *
 * @param config  Key-value pairs to write (merged with any existing file).
 * @param scope   "local" → .cavekit/config.json | "global" → ~/.cave/cavekit.json
 */
export function saveConfig(config: Partial<CaveKitConfig>, scope: "local" | "global" = "local"): void {
	const cwd = process.cwd();
	const filePath = scope === "global" ? CONFIG_PATHS.global() : CONFIG_PATHS.project(cwd);
	const dir = path.dirname(filePath);

	fs.mkdirSync(dir, { recursive: true });

	// Read existing, merge, write back
	let existing: Record<string, unknown> = {};
	if (fs.existsSync(filePath)) {
		try {
			existing = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
		} catch {
			existing = {};
		}
	}
	const merged = { ...existing, ...config };
	fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf8");
}

export type { CaveKitConfig };
