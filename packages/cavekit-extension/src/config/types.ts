/**
 * CaveKit configuration types.
 * Stored in .cavekit/config (project-local) or ~/.pi/cavekit/config (global).
 */

export type ModelPreset = "expensive" | "quality" | "balanced" | "fast";
export type TierGateMode = "severity" | "strict" | "permissive" | "off";
export type CommandGateMode = "allowlist" | "blocklist" | "codex" | "off";
export type CavemanLevel = 0 | 1 | 2 | 3;

export interface CaveKitConfig {
	/** Model preset controlling which models are used per phase */
	preset: ModelPreset;
	/** Controls when Codex adversarial review fires at tier gates */
	tierGateMode: TierGateMode;
	/** Controls bash command safety interception */
	commandGate: CommandGateMode;
	/** Caveman compression level (0=off, 1=light, 2=standard, 3=aggressive) */
	cavemanLevel: CavemanLevel;
	/** Max iterations per task before circuit breaker fires */
	maxIterations: number;
	/** Max parallel wave tasks (maps to createAgentSession concurrency) */
	maxParallel: number;
	/** Whether to use git worktree isolation for parallel wave tasks */
	worktreeIsolation: boolean;
	/** Codex CLI path or "auto" to detect from PATH */
	codexPath: string;
	/** Whether speculative review (tier N-1 while tier N builds) is enabled */
	speculativeReview: boolean;
}

export const DEFAULT_CONFIG: CaveKitConfig = {
	preset: "quality",
	tierGateMode: "severity",
	commandGate: "off",
	cavemanLevel: 2,
	maxIterations: 20,
	maxParallel: 4,
	worktreeIsolation: true,
	codexPath: "auto",
	speculativeReview: false,
};

/** Model assignments per DABI phase for each preset */
export const PRESET_MODELS: Record<ModelPreset, Record<string, string>> = {
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
