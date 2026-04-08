/**
 * Config loading for CaveKit.
 * Reads .cavekit/config (project-local) then ~/.pi/cavekit/config (global),
 * merging over DEFAULT_CONFIG.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import { type CaveKitConfig, DEFAULT_CONFIG } from "./types.js";

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

export function loadConfig(_pi: ExtensionAPI): CaveKitConfig {
	// Determine project CWD via pi context — fall back to process.cwd()
	// ExtensionAPI doesn't expose cwd directly at init time; we read it lazily
	const cwd = process.cwd();
	const globalConfigPath = path.join(os.homedir(), ".pi", "cavekit", "config");
	const localConfigPath = path.join(cwd, ".cavekit", "config");

	const globalOverrides = readConfigFile(globalConfigPath);
	const localOverrides = readConfigFile(localConfigPath);

	// Local takes precedence over global, global over defaults
	return { ...DEFAULT_CONFIG, ...globalOverrides, ...localOverrides };
}

export function saveConfig(config: Partial<CaveKitConfig>, scope: "local" | "global" = "local"): void {
	const cwd = process.cwd();
	const dir = scope === "global" ? path.join(os.homedir(), ".pi", "cavekit") : path.join(cwd, ".cavekit");

	fs.mkdirSync(dir, { recursive: true });
	const filePath = path.join(dir, "config");

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
