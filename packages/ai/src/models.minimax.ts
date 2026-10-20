import type { Api, Model } from "./types.js";

// MiniMax's current direct API catalog. Keep this shared by generation and the
// runtime fallback so a stale upstream snapshot cannot restore old defaults.
// https://platform.minimax.io/docs/api-reference/text-anthropic-api
function directModels(provider: "minimax" | "minimax-cn", baseUrl: string) {
	const common = {
		api: "anthropic-messages" as const,
		provider,
		baseUrl,
		reasoning: true,
		input: ["text", "image"] as ("text" | "image")[],
		contextWindow: 1_000_000,
		maxTokens: 524_288,
	};
	return {
		"MiniMax-M3.1-Flash": {
			...common,
			id: "MiniMax-M3.1-Flash",
			name: "MiniMax M3.1 Flash",
			// cacheWrite is unknown; zero is the registry's unknown-price sentinel.
			cost: { input: 0.15, output: 0.6, cacheRead: 0.015, cacheWrite: 0 },
		},
		"MiniMax-M3": {
			...common,
			id: "MiniMax-M3",
			name: "MiniMax M3",
			// Standard pricing through 512k input. The registry cannot express
			// the higher-context tier (0.60/2.40/0.12) or priority pricing.
			cost: { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0 },
		},
	} satisfies Record<string, Model<"anthropic-messages">>;
}

// OpenCode's own catalogs separately list Zen and Go, including their distinct
// routes. Flash inherits its limits from models/minimax/MiniMax-M3.1-Flash.toml.
// https://github.com/anomalyco/models.dev/tree/dev/providers/opencode-go/models
function openCodeFlash(provider: "opencode" | "opencode-go", baseUrl: string): Model<"openai-completions"> {
	return {
		id: "minimax-m3.1-flash-free",
		name: "MiniMax M3.1 Flash Free",
		api: "openai-completions",
		provider,
		baseUrl,
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1_000_000,
		maxTokens: 512_000,
		compat: { reasoningEffortMap: { minimal: "low" }, maxTokensField: "max_tokens" },
	};
}

export const MINIMAX_MODELS = {
	minimax: directModels("minimax", "https://api.minimax.io/anthropic"),
	"minimax-cn": directModels("minimax-cn", "https://api.minimaxi.com/anthropic"),
	opencode: {
		"minimax-m3.1-flash-free": openCodeFlash("opencode", "https://opencode.ai/inference/openai/v1"),
		"minimax-m3": {
			id: "minimax-m3",
			name: "MiniMax M3",
			api: "openai-completions",
			provider: "opencode",
			baseUrl: "https://opencode.ai/inference/openai/v1",
			reasoning: true,
			input: ["text", "image"],
			cost: { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0 },
			contextWindow: 512_000,
			maxTokens: 128_000,
			compat: { supportsReasoningEffort: false, maxTokensField: "max_tokens" },
		} satisfies Model<"openai-completions">,
	},
	"opencode-go": {
		"minimax-m3.1-flash-free": openCodeFlash("opencode-go", "https://opencode.ai/inference/go/openai/v1"),
		"minimax-m3": {
			id: "minimax-m3",
			name: "MiniMax M3",
			api: "anthropic-messages",
			provider: "opencode-go",
			baseUrl: "https://opencode.ai/inference/go/anthropic",
			reasoning: true,
			input: ["text", "image"],
			cost: { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0 },
			contextWindow: 1_000_000,
			maxTokens: 131_072,
		} satisfies Model<"anthropic-messages">,
	},
	openrouter: {
		"minimax/minimax-m3": {
			id: "minimax/minimax-m3",
			name: "MiniMax: MiniMax M3",
			api: "openai-completions",
			provider: "openrouter",
			baseUrl: "https://openrouter.ai/api/v1",
			reasoning: true,
			input: ["text", "image"],
			cost: { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0 },
			contextWindow: 1_048_576,
			maxTokens: 512_000,
		} satisfies Model<"openai-completions">,
		// Gateway metadata from https://openrouter.ai/api/v1/models.
		"minimax/minimax-m3.1-flash:free": {
			id: "minimax/minimax-m3.1-flash:free",
			name: "MiniMax: MiniMax M3.1 Flash (free)",
			api: "openai-completions",
			provider: "openrouter",
			baseUrl: "https://openrouter.ai/api/v1",
			reasoning: true,
			input: ["text", "image"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 1_000_000,
			maxTokens: 524_288,
			compat: { reasoningEffortMap: { minimal: "low" } },
		} satisfies Model<"openai-completions">,
	},
};

/** Only recognize built-in MiniMax text families, never unrelated media IDs. */
export function isLegacyMiniMaxModel(model: Model<Api>): boolean {
	const id = model.id.toLowerCase();
	const miniMaxText = /^(?:minimax[/.]|minimaxai\/)?minimax-(?:m\d|01|text-01|vl-01)/.test(id);
	return miniMaxText && !/^(?:minimax[/.]|minimaxai\/)?minimax-m3(?:\.1-flash(?::free|-free)?)?$/.test(id);
}

export function isOpenCodeFlash(model: Model<Api>): boolean {
	return (model.provider === "opencode" || model.provider === "opencode-go") && model.id === "minimax-m3.1-flash-free";
}

export function usesMiniMaxAdaptiveThinking(model: Model<Api>): boolean {
	return isDirectMiniMaxM3(model) || (model.provider === "opencode-go" && model.id === "minimax-m3");
}

export function isDirectMiniMaxM3(model: Model<Api>): boolean {
	return (
		(model.provider === "minimax" || model.provider === "minimax-cn") &&
		(model.id === "MiniMax-M3" || model.id === "MiniMax-M3.1-Flash")
	);
}
