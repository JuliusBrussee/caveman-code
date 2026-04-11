/**
 * CaveKit configuration types.
 * Stored in `.cavekit/config.json` (project-local) or `~/.cave/cavekit.json` (global).
 */

export const MODEL_PRESETS = ["expensive", "quality", "balanced", "fast"] as const;
export type ModelPreset = (typeof MODEL_PRESETS)[number];

export const TIER_GATE_MODES = ["severity", "strict", "permissive", "off"] as const;
export type TierGateMode = (typeof TIER_GATE_MODES)[number];

export const COMMAND_GATE_MODES = ["allowlist", "blocklist", "codex", "off"] as const;
export type CommandGateMode = (typeof COMMAND_GATE_MODES)[number];

export const CAVEMAN_LEVELS = [0, 1, 2, 3] as const;
export type CavemanLevel = (typeof CAVEMAN_LEVELS)[number];

export type CaveKitPhase = "draft" | "architect" | "build" | "research" | "subagent";

export interface CaveKitConfig {
	/** Model preset controlling which models are used per phase */
	preset: ModelPreset;
	/** Controls when Codex adversarial review fires at tier gates */
	tierGateMode: TierGateMode;
	/** Model identifier used when tier gate fires (e.g. "claude-opus-4-6") */
	tierGateModel: string;
	/** Controls bash command safety interception */
	commandGate: CommandGateMode;
	/** Caveman compression level (0=off, 1=light, 2=standard, 3=aggressive) */
	cavemanLevel: CavemanLevel;
	/** Max retries for a failed task before it is marked blocked */
	maxRetries: number;
	/** Max iterations per task before circuit breaker fires */
	maxIterations: number;
	/** Task timeout in milliseconds (0 = no timeout) */
	taskTimeout: number;
	/** Max parallel wave tasks (maps to createAgentSession concurrency) */
	maxParallel: number;
	/** Whether to use git worktree isolation for parallel wave tasks */
	worktreeIsolation: boolean;
	/** Codex CLI path or "auto" to detect from PATH */
	codexPath: string;
	/** Whether speculative review (tier N-1 while tier N builds) is enabled */
	speculativeReview: boolean;
	/** Whether caveman context compression is applied to subagent sessions */
	cavemanForSubagents: boolean;
	/** Whether scoped context (per-task context injection) is enabled */
	scopedContext: boolean;
}

export const CONFIG_KEYS = [
	"preset",
	"tierGateMode",
	"tierGateModel",
	"commandGate",
	"cavemanLevel",
	"maxRetries",
	"maxIterations",
	"taskTimeout",
	"maxParallel",
	"worktreeIsolation",
	"codexPath",
	"speculativeReview",
	"cavemanForSubagents",
	"scopedContext",
] as const satisfies ReadonlyArray<keyof CaveKitConfig>;

export type CaveKitConfigKey = (typeof CONFIG_KEYS)[number];
export type CaveKitConfigValue = CaveKitConfig[CaveKitConfigKey];

export const DEFAULT_CONFIG: CaveKitConfig = {
	preset: "quality",
	tierGateMode: "severity",
	tierGateModel: "claude-opus-4-6",
	commandGate: "off",
	cavemanLevel: 2,
	maxRetries: 3,
	maxIterations: 20,
	taskTimeout: 0,
	maxParallel: 4,
	worktreeIsolation: true,
	codexPath: "auto",
	speculativeReview: false,
	cavemanForSubagents: true,
	scopedContext: true,
};

/** Model assignments per DABI phase for each preset */
export const PRESET_MODELS: Record<ModelPreset, Record<CaveKitPhase, string>> = {
	expensive: {
		draft: "claude-opus-4-6",
		architect: "claude-opus-4-6",
		build: "claude-opus-4-6",
		research: "claude-sonnet-4-6",
		subagent: "claude-opus-4-6",
	},
	quality: {
		draft: "claude-opus-4-6",
		architect: "claude-opus-4-6",
		build: "claude-opus-4-6",
		research: "claude-sonnet-4-6",
		subagent: "claude-opus-4-6",
	},
	balanced: {
		draft: "claude-sonnet-4-6",
		architect: "claude-sonnet-4-6",
		build: "claude-sonnet-4-6",
		research: "claude-haiku-4-5-20251001",
		subagent: "claude-sonnet-4-6",
	},
	fast: {
		draft: "claude-haiku-4-5-20251001",
		architect: "claude-haiku-4-5-20251001",
		build: "claude-haiku-4-5-20251001",
		research: "claude-haiku-4-5-20251001",
		subagent: "claude-haiku-4-5-20251001",
	},
};

function parseInteger(value: unknown): number | undefined {
	if (typeof value === "number") {
		return Number.isInteger(value) && value >= 0 ? value : undefined;
	}

	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!/^\d+$/.test(trimmed)) return undefined;
		const parsed = Number(trimmed);
		return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
	}

	return undefined;
}

function parseBoolean(value: unknown): boolean | undefined {
	if (typeof value === "boolean") return value;
	if (typeof value !== "string") return undefined;

	const lowered = value.trim().toLowerCase();
	if (lowered === "true") return true;
	if (lowered === "false") return false;
	return undefined;
}

function parseStringEnum<T extends readonly string[]>(choices: T, value: unknown): T[number] | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return choices.includes(trimmed as T[number]) ? (trimmed as T[number]) : undefined;
}

function parseString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

const CONFIG_PARSERS: {
	[K in CaveKitConfigKey]: (value: unknown) => CaveKitConfig[K] | undefined;
} = {
	preset: (value) => parseStringEnum(MODEL_PRESETS, value),
	tierGateMode: (value) => parseStringEnum(TIER_GATE_MODES, value),
	tierGateModel: (value) => parseString(value),
	commandGate: (value) => parseStringEnum(COMMAND_GATE_MODES, value),
	cavemanLevel: (value) => {
		const parsed = parseInteger(value);
		return parsed !== undefined && CAVEMAN_LEVELS.includes(parsed as CavemanLevel)
			? (parsed as CavemanLevel)
			: undefined;
	},
	maxRetries: (value) => parseInteger(value),
	maxIterations: (value) => parseInteger(value),
	taskTimeout: (value) => parseInteger(value),
	maxParallel: (value) => parseInteger(value),
	worktreeIsolation: (value) => parseBoolean(value),
	codexPath: (value) => parseString(value),
	speculativeReview: (value) => parseBoolean(value),
	cavemanForSubagents: (value) => parseBoolean(value),
	scopedContext: (value) => parseBoolean(value),
};

export function isConfigKey(value: string): value is CaveKitConfigKey {
	return (CONFIG_KEYS as readonly string[]).includes(value);
}

export function parseConfigValue<K extends CaveKitConfigKey>(key: K, value: unknown): CaveKitConfig[K] | undefined {
	return CONFIG_PARSERS[key](value);
}

export function sanitizeConfigValue<K extends CaveKitConfigKey>(
	key: K,
	value: unknown,
	fallback: CaveKitConfig[K] = DEFAULT_CONFIG[key],
): CaveKitConfig[K] {
	return parseConfigValue(key, value) ?? fallback;
}
