import { describe, expect, it, vi } from "vitest";
import { getModel } from "../src/models.js";
import { getAnthropicCapabilities, supportsAdaptiveThinking } from "../src/providers/anthropic-capabilities.js";
import { streamSimple } from "../src/stream.js";
import type { Context, Model, ThinkingLevel } from "../src/types.js";

// ============================================================================
// Mock the Anthropic SDK so we can inspect the outgoing request body and
// headers without opening a network connection.
// ============================================================================

const mockState = vi.hoisted(() => ({
	constructorOpts: undefined as Record<string, unknown> | undefined,
	streamParams: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@anthropic-ai/sdk", () => {
	const fakeStream = {
		async *[Symbol.asyncIterator]() {
			yield { type: "message_start", message: { usage: { input_tokens: 1, output_tokens: 0 } } };
			yield { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 1 } };
		},
		finalMessage: async () => ({
			usage: {
				input_tokens: 1,
				output_tokens: 1,
				cache_creation_input_tokens: 0,
				cache_read_input_tokens: 0,
			},
		}),
	};

	class FakeAnthropic {
		constructor(opts: Record<string, unknown>) {
			mockState.constructorOpts = opts;
		}
		messages = {
			stream: (params: Record<string, unknown>) => {
				mockState.streamParams = params;
				return fakeStream;
			},
		};
	}

	return { default: FakeAnthropic };
});

function ctx(): Context {
	return { messages: [{ role: "user", content: "Hello", timestamp: Date.now() }] };
}

async function runWith(
	model: Model<"anthropic-messages">,
	reasoning?: ThinkingLevel,
): Promise<{ params: Record<string, unknown>; headers: Record<string, string> }> {
	mockState.constructorOpts = undefined;
	mockState.streamParams = undefined;
	const s = streamSimple(model, ctx(), { apiKey: "fake-key", reasoning });
	for await (const event of s) {
		if (event.type === "error") break;
	}
	if (!mockState.constructorOpts || !mockState.streamParams) {
		throw new Error("Expected SDK to be invoked");
	}
	const opts = mockState.constructorOpts as Record<string, unknown>;
	return {
		params: mockState.streamParams as Record<string, unknown>,
		headers: opts.defaultHeaders as Record<string, string>,
	};
}

// ============================================================================
// Capability table — provider-scoped contract
// ============================================================================

describe("getAnthropicCapabilities (provider-scoped)", () => {
	it("opus-4-7 on direct Anthropic is adaptive + xhighEffort", () => {
		const caps = getAnthropicCapabilities("claude-opus-4-7", "anthropic");
		expect(caps.thinkingSchema).toBe("adaptive");
		expect(caps.xhighEffort).toBe(true);
		expect(caps.contextBeta).toBeUndefined();
	});

	it("opus-4-7 on Bedrock matches direct Anthropic", () => {
		const caps = getAnthropicCapabilities("anthropic.claude-opus-4-7", "amazon-bedrock");
		expect(caps.thinkingSchema).toBe("adaptive");
		expect(caps.xhighEffort).toBe(true);
	});

	it("opus-4-7 on Copilot is adaptive but NOT xhighEffort (Copilot rejects effort=max on the bare id)", () => {
		const caps = getAnthropicCapabilities("claude-opus-4.7", "github-copilot");
		expect(caps.thinkingSchema).toBe("adaptive");
		expect(caps.xhighEffort).toBeFalsy();
	});

	it("opus-4-6 mirrors opus-4-7 (adaptive everywhere, xhighEffort only on native providers)", () => {
		expect(getAnthropicCapabilities("claude-opus-4-6", "anthropic").xhighEffort).toBe(true);
		expect(getAnthropicCapabilities("claude-opus-4.6", "github-copilot").xhighEffort).toBeFalsy();
	});

	it("opus-4-5 on direct Anthropic is legacy + context-1m beta + 1M window", () => {
		const caps = getAnthropicCapabilities("claude-opus-4-5", "anthropic");
		expect(caps.thinkingSchema).toBe("legacy");
		expect(caps.contextBeta).toBe("context-1m-2025-08-07");
		expect(caps.contextWindow).toBe(1_000_000);
	});

	it("opus-4-5 dated variant matches", () => {
		const caps = getAnthropicCapabilities("claude-opus-4-5-20251101", "anthropic");
		expect(caps.contextBeta).toBe("context-1m-2025-08-07");
		expect(caps.contextWindow).toBe(1_000_000);
	});

	it("opus-4-5 on Bedrock also gets the beta (regional ids included)", () => {
		const caps = getAnthropicCapabilities("eu.anthropic.claude-opus-4-5-20251101-v1:0", "amazon-bedrock");
		expect(caps.contextBeta).toBe("context-1m-2025-08-07");
	});

	it("opus-4-5 on Copilot is legacy WITHOUT context-1m beta (Copilot rejects it)", () => {
		const caps = getAnthropicCapabilities("claude-opus-4.5", "github-copilot");
		expect(caps.thinkingSchema).toBe("legacy");
		expect(caps.contextBeta).toBeUndefined();
		expect(caps.contextWindow).toBeUndefined();
	});

	it("sonnet-4-6 is adaptive on every provider (no beta/effort divergence)", () => {
		expect(getAnthropicCapabilities("claude-sonnet-4-6", "anthropic").thinkingSchema).toBe("adaptive");
		expect(getAnthropicCapabilities("claude-sonnet-4.6", "github-copilot").thinkingSchema).toBe("adaptive");
	});

	it("sonnet-4-5 and unknown ids stay legacy", () => {
		expect(getAnthropicCapabilities("claude-sonnet-4-5", "anthropic").thinkingSchema).toBe("legacy");
		expect(getAnthropicCapabilities("claude-something-future", "anthropic").thinkingSchema).toBe("legacy");
	});

	it("supportsAdaptiveThinking is provider-aware where it matters", () => {
		expect(supportsAdaptiveThinking("claude-opus-4-7", "anthropic")).toBe(true);
		expect(supportsAdaptiveThinking("claude-opus-4.7", "github-copilot")).toBe(true);
		expect(supportsAdaptiveThinking("claude-opus-4-5", "anthropic")).toBe(false);
		expect(supportsAdaptiveThinking("claude-sonnet-4-5", "anthropic")).toBe(false);
	});
});

// ============================================================================
// Bug A: adaptive vs legacy thinking request shape
// ============================================================================

describe("Anthropic thinking request shape", () => {
	it("opus-4-7 sends adaptive thinking + output_config.effort, no budget_tokens", async () => {
		const { params } = await runWith(getModel("anthropic", "claude-opus-4-7"), "medium");
		expect(params.thinking).toEqual({ type: "adaptive" });
		expect(params.output_config).toEqual({ effort: "medium" });
		expect(params.thinking).not.toHaveProperty("budget_tokens");
	});

	it("opus-4-6 sends adaptive thinking + output_config.effort", async () => {
		const { params } = await runWith(getModel("anthropic", "claude-opus-4-6"), "high");
		expect(params.thinking).toEqual({ type: "adaptive" });
		expect(params.output_config).toEqual({ effort: "high" });
	});

	it("xhigh on direct-Anthropic opus-4-7 maps to effort=max", async () => {
		const { params } = await runWith(getModel("anthropic", "claude-opus-4-7"), "xhigh");
		expect(params.output_config).toEqual({ effort: "max" });
	});

	it("xhigh on Copilot opus-4.7 clamps to effort=high (Copilot rejects max on the bare id)", async () => {
		const { params } = await runWith(getModel("github-copilot", "claude-opus-4.7"), "xhigh");
		expect(params.output_config).toEqual({ effort: "high" });
	});

	it("legacy sonnet-4-5 still uses budget-based thinking", async () => {
		const { params } = await runWith(getModel("anthropic", "claude-sonnet-4-5"), "medium");
		const thinking = params.thinking as { type: string; budget_tokens?: number };
		expect(thinking.type).toBe("enabled");
		expect(thinking.budget_tokens).toBeGreaterThan(0);
		expect(params.output_config).toBeUndefined();
	});

	it("reasoning=off omits thinking/output_config for both schemas", async () => {
		const adaptive = await runWith(getModel("anthropic", "claude-opus-4-7"), undefined);
		expect(adaptive.params.thinking).toEqual({ type: "disabled" });
		expect(adaptive.params.output_config).toBeUndefined();
		const legacy = await runWith(getModel("anthropic", "claude-sonnet-4-5"), undefined);
		expect(legacy.params.thinking).toEqual({ type: "disabled" });
		expect(legacy.params.output_config).toBeUndefined();
	});
});

// ============================================================================
// Bug B: 1M context beta header opt-in, provider-scoped
// ============================================================================

describe("Anthropic context-1m beta opt-in", () => {
	it("includes anthropic-beta: context-1m-2025-08-07 for opus-4-5 on direct Anthropic", async () => {
		const { headers } = await runWith(getModel("anthropic", "claude-opus-4-5"));
		expect(headers["anthropic-beta"]).toContain("context-1m-2025-08-07");
	});

	it("does NOT include context-1m beta for opus-4-5 on Copilot (Copilot rejects it)", async () => {
		const { headers } = await runWith(getModel("github-copilot", "claude-opus-4.5"));
		const beta = headers["anthropic-beta"] ?? "";
		expect(beta).not.toContain("context-1m");
	});

	it("does NOT include context-1m beta for opus-4-7 (Anthropic rejects it on 4.6/4.7)", async () => {
		const { headers } = await runWith(getModel("anthropic", "claude-opus-4-7"));
		const beta = headers["anthropic-beta"] ?? "";
		expect(beta).not.toContain("context-1m");
	});

	it("does NOT include context-1m beta for opus-4-6", async () => {
		const { headers } = await runWith(getModel("anthropic", "claude-opus-4-6"));
		const beta = headers["anthropic-beta"] ?? "";
		expect(beta).not.toContain("context-1m");
	});

	it("does NOT include context-1m beta for sonnet-4-5", async () => {
		const { headers } = await runWith(getModel("anthropic", "claude-sonnet-4-5"));
		const beta = headers["anthropic-beta"] ?? "";
		expect(beta).not.toContain("context-1m");
	});

	it("does NOT include context-1m beta for haiku", async () => {
		const { headers } = await runWith(getModel("anthropic", "claude-haiku-4-5"));
		const beta = headers["anthropic-beta"] ?? "";
		expect(beta).not.toContain("context-1m");
	});

	it("preserves the existing fine-grained-tool-streaming beta", async () => {
		const { headers } = await runWith(getModel("anthropic", "claude-opus-4-5"));
		expect(headers["anthropic-beta"]).toContain("fine-grained-tool-streaming-2025-05-14");
	});
});

// ============================================================================
// Bug B: registry reports 1M ceiling for direct-Anthropic opus-4-5
// ============================================================================

describe("Anthropic model registry contextWindow override", () => {
	it("reports 1_000_000 for opus-4-5 on direct Anthropic (overridden from generated 200000)", () => {
		const model = getModel("anthropic", "claude-opus-4-5");
		expect(model.contextWindow).toBe(1_000_000);
	});

	it("reports 1_000_000 for opus-4-5-20251101 (dated variant)", () => {
		const model = getModel("anthropic", "claude-opus-4-5-20251101");
		expect(model.contextWindow).toBe(1_000_000);
	});

	it("reports 1_000_000 for opus-4-7 (from generated registry)", () => {
		const model = getModel("anthropic", "claude-opus-4-7");
		expect(model.contextWindow).toBe(1_000_000);
	});

	it("reports 1_000_000 for opus-4-6 (from generated registry)", () => {
		const model = getModel("anthropic", "claude-opus-4-6");
		expect(model.contextWindow).toBe(1_000_000);
	});

	it("leaves sonnet-4-5 at 200_000", () => {
		const model = getModel("anthropic", "claude-sonnet-4-5");
		expect(model.contextWindow).toBe(200_000);
	});

	it("leaves Copilot opus-4.5 at the generated value (no override on Copilot)", () => {
		const model = getModel("github-copilot", "claude-opus-4.5");
		// The generator emitted 160K for this id. Whatever it is, it should
		// NOT be 1_000_000 — Copilot has no header-based 1M opt-in.
		expect(model.contextWindow).not.toBe(1_000_000);
	});
});
