/**
 * Config loading for CaveKit.
 *
 * Resolution order (last wins):
 *   1. DEFAULT_CONFIG (built-in defaults)
 *   2. Global config:  ~/.cave/cavekit.json
 *   3. Project-local:  <cwd>/.cavekit/config.json
 *
 * Both config files are optional JSON files. A KEY=VALUE flat format is also
 * accepted for convenience. Invalid keys or values are ignored so defaults and
 * higher-precedence sources stay intact.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "cave";
import {
	CONFIG_KEYS,
	DEFAULT_CONFIG,
	isConfigKey,
	parseConfigValue,
	type CaveKitConfig,
	type CaveKitConfigKey,
} from "./types.js";

/** The source a config value came from. */
export type ConfigSource = "default" | "global" | "project";

/** A single resolved config entry annotated with its source. */
export interface ConfigEntry {
	value: CaveKitConfig[CaveKitConfigKey];
	source: ConfigSource;
}

/** The full resolved config with per-key provenance information. */
export type ConfigWithSources = Record<CaveKitConfigKey, ConfigEntry>;

export interface ConfigResolutionOptions {
	cwd?: string;
	homeDir?: string;
	globalPath?: string;
	projectPath?: string;
}

export interface ResolvedConfigFile {
	path: string;
	exists: boolean;
	values: Partial<Record<CaveKitConfigKey, unknown>>;
}

export interface ResolvedConfig {
	values: CaveKitConfig;
	withSources: ConfigWithSources;
	files: {
		global: ResolvedConfigFile;
		project: ResolvedConfigFile;
	};
}

/** Canonical config file paths. */
export const CONFIG_PATHS = {
	global: (homeDir = os.homedir()) => path.join(homeDir, ".cave", "cavekit.json"),
	project: (cwd = process.cwd()) => path.join(cwd, ".cavekit", "config.json"),
} as const;

interface ResolvedConfigPaths {
	cwd: string;
	homeDir: string;
	global: string;
	project: string;
}

function isExtensionApiLike(value: ExtensionAPI | ConfigResolutionOptions | undefined): value is ExtensionAPI {
	return typeof value === "object" && value !== null && "registerCommand" in value;
}

function resolveOptions(
	piOrOptions?: ExtensionAPI | ConfigResolutionOptions,
	overrides?: ConfigResolutionOptions,
): ConfigResolutionOptions | undefined {
	return isExtensionApiLike(piOrOptions) ? overrides : piOrOptions;
}

function resolvePaths(options?: ConfigResolutionOptions): ResolvedConfigPaths {
	const cwd = options?.cwd ?? process.cwd();
	const homeDir = options?.homeDir ?? os.homedir();

	return {
		cwd,
		homeDir,
		global: options?.globalPath ?? CONFIG_PATHS.global(homeDir),
		project: options?.projectPath ?? CONFIG_PATHS.project(cwd),
	};
}

function parseFlatConfig(raw: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;

		const key = trimmed.slice(0, eq).trim();
		const value = trimmed.slice(eq + 1).trim();
		if (value === "true") {
			result[key] = true;
		} else if (value === "false") {
			result[key] = false;
		} else if (/^\d+$/.test(value)) {
			result[key] = Number(value);
		} else {
			result[key] = value;
		}
	}

	return result;
}

function selectKnownConfigValues(raw: Record<string, unknown>): Partial<Record<CaveKitConfigKey, unknown>> {
	const result: Partial<Record<CaveKitConfigKey, unknown>> = {};

	for (const [key, value] of Object.entries(raw)) {
		if (!isConfigKey(key)) continue;
		result[key] = value;
	}

	return result;
}

function readConfigFile(filePath: string): ResolvedConfigFile {
	try {
		if (!fs.existsSync(filePath)) {
			return { path: filePath, exists: false, values: {} };
		}

		const raw = fs.readFileSync(filePath, "utf8").trim();
		if (!raw) {
			return { path: filePath, exists: true, values: {} };
		}

		const parsed = raw.startsWith("{")
			? (JSON.parse(raw) as Record<string, unknown>)
			: parseFlatConfig(raw);

		return {
			path: filePath,
			exists: true,
			values: selectKnownConfigValues(parsed),
		};
	} catch {
		return { path: filePath, exists: false, values: {} };
	}
}

function setResolvedValue<K extends CaveKitConfigKey>(
	target: CaveKitConfig,
	key: K,
	value: CaveKitConfig[K],
): void {
	target[key] = value;
}

function setResolvedSource<K extends CaveKitConfigKey>(
	target: ConfigWithSources,
	key: K,
	value: CaveKitConfig[K],
	source: ConfigSource,
): void {
	target[key] = { value, source };
}

function setPartialValue<K extends CaveKitConfigKey>(
	target: Partial<CaveKitConfig>,
	key: K,
	value: CaveKitConfig[K],
): void {
	target[key] = value;
}

function createDefaultSources(): ConfigWithSources {
	const withSources = {} as ConfigWithSources;

	for (const key of CONFIG_KEYS) {
		setResolvedSource(withSources, key, DEFAULT_CONFIG[key], "default");
	}

	return withSources;
}

function applyOverrides(
	base: CaveKitConfig,
	withSources: ConfigWithSources,
	source: Exclude<ConfigSource, "default">,
	rawValues: Partial<Record<CaveKitConfigKey, unknown>>,
): void {
	for (const key of CONFIG_KEYS) {
		const rawValue = rawValues[key];
		if (rawValue === undefined) continue;

		const parsed = parseConfigValue(key, rawValue);
		if (parsed === undefined) continue;

		setResolvedValue(base, key, parsed);
		setResolvedSource(withSources, key, parsed, source);
	}
}

export function resolveConfig(options?: ConfigResolutionOptions): ResolvedConfig {
	const paths = resolvePaths(options);
	const globalFile = readConfigFile(paths.global);
	const projectFile = readConfigFile(paths.project);
	const values: CaveKitConfig = { ...DEFAULT_CONFIG };
	const withSources = createDefaultSources();

	applyOverrides(values, withSources, "global", globalFile.values);
	applyOverrides(values, withSources, "project", projectFile.values);

	return {
		values,
		withSources,
		files: {
			global: globalFile,
			project: projectFile,
		},
	};
}

/**
 * Load resolved CaveKit config, merging defaults → global → project.
 *
 * The first argument accepts either the host ExtensionAPI (ignored, for call-site
 * compatibility) or config resolution options for tests and command handlers.
 */
export function loadConfig(
	piOrOptions?: ExtensionAPI | ConfigResolutionOptions,
	overrides?: ConfigResolutionOptions,
): CaveKitConfig {
	return resolveConfig(resolveOptions(piOrOptions, overrides)).values;
}

/**
 * Return resolved config with per-value provenance information.
 *
 * The first argument accepts either the host ExtensionAPI (ignored, for call-site
 * compatibility) or config resolution options for tests and command handlers.
 */
export function getConfigWithSources(
	piOrOptions?: ExtensionAPI | ConfigResolutionOptions,
	overrides?: ConfigResolutionOptions,
): ConfigWithSources {
	return resolveConfig(resolveOptions(piOrOptions, overrides)).withSources;
}

/**
 * Persist a partial config update to disk.
 *
 * @param config  Key-value pairs to write (merged with any existing file).
 * @param scope   "local" → .cavekit/config.json | "global" → ~/.cave/cavekit.json
 */
export function saveConfig(
	config: Partial<CaveKitConfig>,
	scope: "local" | "global" = "local",
	options?: ConfigResolutionOptions,
): void {
	const paths = resolvePaths(options);
	const filePath = scope === "global" ? paths.global : paths.project;
	const dir = path.dirname(filePath);
	const existing = readConfigFile(filePath).values;
	const merged: Partial<CaveKitConfig> = {};

	for (const key of CONFIG_KEYS) {
		const existingValue = existing[key];
		if (existingValue !== undefined) {
			const parsedExisting = parseConfigValue(key, existingValue);
			if (parsedExisting !== undefined) {
				setPartialValue(merged, key, parsedExisting);
			}
		}
	}

	for (const key of CONFIG_KEYS) {
		const nextValue = config[key];
		if (nextValue === undefined) continue;

		const parsed = parseConfigValue(key, nextValue);
		if (parsed !== undefined) {
			setPartialValue(merged, key, parsed);
		}
	}

	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf8");
}

export type { CaveKitConfig };
