// discovery.ts — find and load .mcp.json files.
//
// Project: <cwd>/.mcp.json (preferred) or <cwd>/.cave/mcp.json (fallback).
// User:    ~/.cave/mcp.json (preferred) or ~/.claude/mcp.json (compat read).
//
// Schema is byte-compatible with Claude Code / Codex `mcp.json`. A user can
// paste their existing config in unchanged and it will load.
//

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { McpConfigFile, McpServerConfig, McpSettings } from "./types.js";

export interface DiscoverySource {
	scope: "project" | "user";
	path: string;
	exists: boolean;
}

export interface LoadedConfig {
	servers: McpServerConfig[];
	settings: McpSettings;
	sources: DiscoverySource[];
	errors: Array<{ path: string; message: string }>;
}

const PROJECT_PATHS = [".mcp.json", ".cave/mcp.json"] as const;

function userPaths(home: string): string[] {
	return [join(home, ".cave", "mcp.json"), join(home, ".claude", "mcp.json"), join(home, ".codex", "mcp.json")];
}

export function getProjectConfigPath(cwd = process.cwd()): string {
	return resolve(cwd, PROJECT_PATHS[0]);
}

export function getUserConfigPath(home = homedir()): string {
	return join(home, ".cave", "mcp.json");
}

export function getDiscoverySources(cwd = process.cwd(), home = homedir()): DiscoverySource[] {
	const out: DiscoverySource[] = [];
	for (const rel of PROJECT_PATHS) {
		const p = resolve(cwd, rel);
		out.push({ scope: "project", path: p, exists: existsSync(p) });
	}
	for (const p of userPaths(home)) {
		out.push({ scope: "user", path: p, exists: existsSync(p) });
	}
	return out;
}

function safeParse(path: string, errors: Array<{ path: string; message: string }>): McpConfigFile | undefined {
	try {
		const text = readFileSync(path, "utf8");
		const parsed = JSON.parse(text) as McpConfigFile;
		if (!parsed || typeof parsed !== "object") {
			errors.push({ path, message: "expected JSON object" });
			return undefined;
		}
		return parsed;
	} catch (err) {
		errors.push({ path, message: err instanceof Error ? err.message : String(err) });
		return undefined;
	}
}

function entriesToConfigs(parsed: McpConfigFile | undefined): McpServerConfig[] {
	if (!parsed?.mcpServers) return [];
	const out: McpServerConfig[] = [];
	for (const [name, raw] of Object.entries(parsed.mcpServers)) {
		if (!raw || typeof raw !== "object") continue;
		out.push({ ...(raw as Omit<McpServerConfig, "name">), name });
	}
	return out;
}

/**
 * Load and merge MCP config files. Project-scope wins over user-scope on name
 * collisions; the first existing file at each scope is the authoritative one.
 */
export function loadMcpConfig(cwd = process.cwd(), home = homedir()): LoadedConfig {
	const sources = getDiscoverySources(cwd, home);
	const errors: Array<{ path: string; message: string }> = [];
	const byName = new Map<string, McpServerConfig>();
	let settings: McpSettings = {};

	const userSource = sources.find((s) => s.scope === "user" && s.exists);
	if (userSource) {
		const parsed = safeParse(userSource.path, errors);
		for (const c of entriesToConfigs(parsed)) byName.set(c.name, c);
		if (parsed?.settings) settings = { ...settings, ...parsed.settings };
	}

	const projectSource = sources.find((s) => s.scope === "project" && s.exists);
	if (projectSource) {
		const parsed = safeParse(projectSource.path, errors);
		for (const c of entriesToConfigs(parsed)) byName.set(c.name, c);
		if (parsed?.settings) settings = { ...settings, ...parsed.settings };
	}

	return {
		servers: [...byName.values()],
		settings,
		sources,
		errors,
	};
}
