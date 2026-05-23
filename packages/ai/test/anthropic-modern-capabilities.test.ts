import { describe, expect, it, vi } from "vitest";
import { getModel } from "../src/models.js";
import {
	_clearDiscoveredCapabilitiesForTests,
	getAnthropicCapabilities,
	getDiscoveredCapabilities,
	setDiscoveredCapabilities,
	supportsAdaptiveThinking,
} from "../src/providers/anthropic-capabilities.js";
import { _clearDiscoveryStateForTests, discoverAnthropicCapabilities } from "../src/providers/anthropic-discovery.js";
import { streamSimple } from "../src/stream.js";
import type { Context, Model, ThinkingLevel } from "../src/types.js";

// ============================================================================
// Mock the Anthropic SDK so we can inspect the outgoing request body and
// headers that the provider would have sent without opening a network
// connection.
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
// Static fallback table — conservative defaults
// ============================================================================

describe("static capability fallback table", () => {
	it("classifies opus-4-7 as adaptive but does not assume xhighEffort or contextBeta", () => {
		const caps = getAnthropicCapabilities("claude-opus-4-7");
		expect(caps.thinkingSchema).toBe("adaptive");
		expect(caps.xhighEffort).toBeFalsy();
		expect(caps.contextBeta).toBeUndefined();
	});

	it("classifies opus-4-6 as adaptive but does not assume xhighEffort or contextBeta", () => {
		const caps = getAnthropicCapabilities("claude-opus-4-6");
		expect(caps.thinkingSchema).toBe("adaptive");
		expect(caps.xhighEffort).toBeFalsy();
		expect(caps.contextBeta).toBeUndefined();
	});

	it("classifies opus-4-5 as legacy without contextBeta (only discovery may enable it)", () => {
		const caps = getAnthropicCapabilities("claude-opus-4-5");
		expect(caps.thinkingSchema).toBe("legacy");
		expect(caps.contextBeta).toBeUndefined();
	});

	it("classifies sonnet-4-6 as adaptive", () => {
		const caps = getAnthropicCapabilities("claude-sonnet-4-6");
		expect(caps.thinkingSchema).toBe("adaptive");
	});

	it("classifies sonnet-4-5 and unknown ids as legacy", () => {
		expect(getAnthropicCapabilities("claude-sonnet-4-5").thinkingSchema).toBe("legacy");
		expect(getAnthropicCapabilities("claude-something-future").thinkingSchema).toBe("legacy");
	});

	it("supportsAdaptiveThinking aligns with the static table", () => {
		expect(supportsAdaptiveThinking("claude-opus-4-7")).toBe(true);
		expect(supportsAdaptiveThinking("claude-opus-4-6")).toBe(true);
		expect(supportsAdaptiveThinking("claude-sonnet-4-6")).toBe(true);
		expect(supportsAdaptiveThinking("claude-opus-4-5")).toBe(false);
		expect(supportsAdaptiveThinking("claude-sonnet-4-5")).toBe(false);
	});
});

// ============================================================================
// Discovery cache overrides the static fallback
// ============================================================================

describe("discovery cache override", () => {
	it("returns provider-specific overrides when set", () => {
		_clearDiscoveredCapabilitiesForTests();
		setDiscoveredCapabilities("github-copilot", "claude-opus-4.6-1m", {
			thinkingSchema: "adaptive",
			contextWindow: 1_000_000,
		});
		expect(getAnthropicCapabilities("claude-opus-4.6-1m", "github-copilot").contextWindow).toBe(1_000_000);
		// Without provider scoping, falls back to the static table.
		expect(getAnthropicCapabilities("claude-opus-4.6-1m").contextWindow).toBeUndefined();
	});

	it("different providers can hold different capabilities for the same id", () => {
		_clearDiscoveredCapabilitiesForTests();
		setDiscoveredCapabilities("github-copilot", "claude-opus-4.6", {
			thinkingSchema: "adaptive",
			contextWindow: 200_000,
		});
		setDiscoveredCapabilities("anthropic", "claude-opus-4.6", {
			thinkingSchema: "adaptive",
			xhighEffort: true,
			contextWindow: 200_000,
		});
		expect(getAnthropicCapabilities("claude-opus-4.6", "github-copilot").xhighEffort).toBeFalsy();
		expect(getAnthropicCapabilities("claude-opus-4.6", "anthropic").xhighEffort).toBe(true);
	});
});

// ============================================================================
// Bug A: adaptive vs legacy thinking request shape (provider-aware)
// ============================================================================

describe("Anthropic thinking request shape", () => {
	it("opus-4-7 sends adaptive thinking + output_config.effort, no budget_tokens", async () => {
		_clearDiscoveredCapabilitiesForTests();
		const { params } = await runWith(getModel("anthropic", "claude-opus-4-7"), "medium");
		expect(params.thinking).toEqual({ type: "adaptive" });
		expect(params.output_config).toEqual({ effort: "medium" });
		expect(params.thinking).not.toHaveProperty("budget_tokens");
	});

	it("opus-4-6 sends adaptive thinking + output_config.effort", async () => {
		_clearDiscoveredCapabilitiesForTests();
		const { params } = await runWith(getModel("anthropic", "claude-opus-4-6"), "high");
		expect(params.thinking).toEqual({ type: "adaptive" });
		expect(params.output_config).toEqual({ effort: "high" });
	});

	it("xhigh on direct-Anthropic opus-4-7 maps to effort=max per the static provider-scoped table", async () => {
		_clearDiscoveredCapabilitiesForTests();
		const { params } = await runWith(getModel("anthropic", "claude-opus-4-7"), "xhigh");
		expect(params.output_config).toEqual({ effort: "max" });
	});

	it("xhigh on Copilot opus-4.6 clamps to effort=high without discovery (Copilot relay rejects max)", async () => {
		_clearDiscoveredCapabilitiesForTests();
		const { params } = await runWith(getModel("github-copilot", "claude-opus-4.6"), "xhigh");
		expect(params.output_config).toEqual({ effort: "high" });
	});

	it("xhigh maps to effort=max once discovery confirms xhighEffort for a Copilot model", async () => {
		_clearDiscoveredCapabilitiesForTests();
		setDiscoveredCapabilities("anthropic", "claude-opus-4-7", {
			thinkingSchema: "adaptive",
			xhighEffort: true,
		});
		const { params } = await runWith(getModel("anthropic", "claude-opus-4-7"), "xhigh");
		expect(params.output_config).toEqual({ effort: "max" });
	});

	it("xhigh on opus-4-7 maps to effort=max once discovery confirms xhighEffort", async () => {
		_clearDiscoveredCapabilitiesForTests();
		setDiscoveredCapabilities("github-copilot", "claude-opus-4.7", {
			thinkingSchema: "adaptive",
			xhighEffort: true,
		});
		const { params } = await runWith(getModel("github-copilot", "claude-opus-4.7"), "xhigh");
		expect(params.output_config).toEqual({ effort: "max" });
	});

	it("legacy sonnet-4-5 still uses budget-based thinking", async () => {
		_clearDiscoveredCapabilitiesForTests();
		const { params } = await runWith(getModel("anthropic", "claude-sonnet-4-5"), "medium");
		const thinking = params.thinking as { type: string; budget_tokens?: number };
		expect(thinking.type).toBe("enabled");
		expect(thinking.budget_tokens).toBeGreaterThan(0);
		expect(params.output_config).toBeUndefined();
	});

	it("reasoning=off omits thinking/output_config for both schemas", async () => {
		_clearDiscoveredCapabilitiesForTests();
		const adaptive = await runWith(getModel("anthropic", "claude-opus-4-7"), undefined);
		expect(adaptive.params.thinking).toEqual({ type: "disabled" });
		expect(adaptive.params.output_config).toBeUndefined();
		const legacy = await runWith(getModel("anthropic", "claude-sonnet-4-5"), undefined);
		expect(legacy.params.thinking).toEqual({ type: "disabled" });
		expect(legacy.params.output_config).toBeUndefined();
	});
});

// ============================================================================
// Bug B: context-1m beta only sent when discovery confirms it
// ============================================================================

describe("context-1m beta opt-in is discovery-gated", () => {
	it("does NOT send the context-1m beta header under the conservative static table", async () => {
		_clearDiscoveredCapabilitiesForTests();
		const cases = ["claude-opus-4-7", "claude-opus-4-6", "claude-opus-4-5", "claude-sonnet-4-5"];
		for (const id of cases) {
			const { headers } = await runWith(getModel("anthropic", id as never));
			const beta = headers["anthropic-beta"] ?? "";
			expect(beta).not.toContain("context-1m");
		}
	});

	it("sends the context-1m beta header once discovery confirms it on opus-4-5", async () => {
		_clearDiscoveredCapabilitiesForTests();
		setDiscoveredCapabilities("anthropic", "claude-opus-4-5", {
			thinkingSchema: "legacy",
			contextBeta: "context-1m-2025-08-07",
			contextWindow: 1_000_000,
		});
		const { headers } = await runWith(getModel("anthropic", "claude-opus-4-5"));
		expect(headers["anthropic-beta"]).toContain("context-1m-2025-08-07");
	});

	it("preserves the existing fine-grained-tool-streaming beta", async () => {
		_clearDiscoveredCapabilitiesForTests();
		const { headers } = await runWith(getModel("anthropic", "claude-opus-4-7"));
		expect(headers["anthropic-beta"]).toContain("fine-grained-tool-streaming-2025-05-14");
	});
});

// ============================================================================
// Discovery dispatcher: Copilot /models
// ============================================================================

describe("discoverAnthropicCapabilities — github-copilot", () => {
	it("parses Copilot /models response into the capability cache and registry", async () => {
		_clearDiscoveredCapabilitiesForTests();
		_clearDiscoveryStateForTests();

		const copilotResponse = {
			data: [
				{
					id: "claude-opus-4.6-1m",
					name: "Claude Opus 4.6 (1M context)",
					vendor: "Anthropic",
					supported_endpoints: ["/v1/messages", "/chat/completions"],
					capabilities: {
						family: "claude-opus-4.6-1m",
						supports: {
							adaptive_thinking: true,
							reasoning_effort: ["low", "medium", "high"],
							vision: true,
						},
						limits: { max_context_window_tokens: 1_000_000, max_output_tokens: 64_000 },
					},
				},
				{
					id: "claude-opus-4.7-preview-1m",
					name: "Claude Opus 4.7 (1M context, preview)",
					vendor: "Anthropic",
					supported_endpoints: ["/v1/messages"],
					capabilities: {
						supports: {
							adaptive_thinking: true,
							reasoning_effort: ["low", "medium", "high", "xhigh"],
							vision: true,
						},
						limits: { max_context_window_tokens: 1_000_000, max_output_tokens: 64_000 },
					},
				},
				{
					id: "claude-opus-4.6",
					name: "Claude Opus 4.6",
					vendor: "Anthropic",
					supported_endpoints: ["/v1/messages"],
					capabilities: {
						supports: {
							adaptive_thinking: true,
							reasoning_effort: ["low", "medium", "high"],
						},
						limits: { max_context_window_tokens: 200_000, max_output_tokens: 32_000 },
					},
				},
				{
					id: "gpt-5",
					vendor: "OpenAI",
					supported_endpoints: ["/chat/completions"],
				},
			],
		};

		const fetchMock = vi.fn(async () => new Response(JSON.stringify(copilotResponse), { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		await discoverAnthropicCapabilities("github-copilot", "https://api.individual.githubcopilot.com", "tid=fake");

		const opus46_1m = getDiscoveredCapabilities("github-copilot", "claude-opus-4.6-1m");
		expect(opus46_1m?.thinkingSchema).toBe("adaptive");
		expect(opus46_1m?.contextWindow).toBe(1_000_000);
		expect(opus46_1m?.xhighEffort).toBeFalsy();

		const opus47Preview = getDiscoveredCapabilities("github-copilot", "claude-opus-4.7-preview-1m");
		expect(opus47Preview?.xhighEffort).toBe(true);

		const opus46 = getDiscoveredCapabilities("github-copilot", "claude-opus-4.6");
		expect(opus46?.contextWindow).toBe(200_000);
		expect(opus46?.xhighEffort).toBeFalsy();

		// OpenAI vendor entries are ignored.
		expect(getDiscoveredCapabilities("github-copilot", "gpt-5")).toBeUndefined();

		// New ids are merged into the registry.
		const merged = getModel("github-copilot", "claude-opus-4.6-1m" as never);
		expect(merged).toBeDefined();
		expect(merged.contextWindow).toBe(1_000_000);

		vi.unstubAllGlobals();
	});

	it("silently no-ops on HTTP failure (leaves static fallback intact)", async () => {
		_clearDiscoveredCapabilitiesForTests();
		_clearDiscoveryStateForTests();
		const fetchMock = vi.fn(async () => new Response("oops", { status: 500 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			discoverAnthropicCapabilities("github-copilot", "https://api.example/", "tid=fake"),
		).resolves.toBeUndefined();

		expect(getDiscoveredCapabilities("github-copilot", "claude-opus-4.6-1m")).toBeUndefined();
		vi.unstubAllGlobals();
	});
});

// ============================================================================
// Discovery dispatcher: direct Anthropic /v1/models
// ============================================================================

describe("discoverAnthropicCapabilities — anthropic native", () => {
	it("parses /v1/models, double-probes for the context-1m beta, and reports the window delta", async () => {
		_clearDiscoveredCapabilitiesForTests();
		_clearDiscoveryStateForTests();

		const baseResponse = {
			data: [
				{
					id: "claude-opus-4-5",
					capabilities: {
						thinking: { types: { adaptive: { supported: false }, enabled: { supported: true } } },
						effort: { high: { supported: true } },
					},
					max_input_tokens: 200_000,
				},
				{
					id: "claude-opus-4-6",
					capabilities: {
						thinking: { types: { adaptive: { supported: true }, enabled: { supported: true } } },
						effort: { max: { supported: true } },
					},
					max_input_tokens: 200_000,
				},
			],
		};
		// With the beta, opus-4-5 reports a 1M window; opus-4-6 stays put.
		const betaResponse = {
			data: [
				{ id: "claude-opus-4-5", max_input_tokens: 1_000_000 },
				{ id: "claude-opus-4-6", max_input_tokens: 200_000 },
			],
		};

		const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
			const headers = (init.headers ?? {}) as Record<string, string>;
			const beta = headers["anthropic-beta"];
			return new Response(JSON.stringify(beta ? betaResponse : baseResponse), { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		await discoverAnthropicCapabilities("anthropic", "https://api.anthropic.com", "sk-test");

		const opus45 = getDiscoveredCapabilities("anthropic", "claude-opus-4-5");
		expect(opus45?.thinkingSchema).toBe("legacy");
		expect(opus45?.contextBeta).toBe("context-1m-2025-08-07");
		expect(opus45?.contextWindow).toBe(1_000_000);

		const opus46 = getDiscoveredCapabilities("anthropic", "claude-opus-4-6");
		expect(opus46?.thinkingSchema).toBe("adaptive");
		expect(opus46?.xhighEffort).toBe(true);
		expect(opus46?.contextBeta).toBeUndefined();
		expect(opus46?.contextWindow).toBe(200_000);

		vi.unstubAllGlobals();
	});
});

// ============================================================================
// Registry still honors capability-table contextWindow at load time
// ============================================================================

describe("static registry contextWindow", () => {
	it("opus-4-5 stays at the generated 200_000 (static table does not override)", () => {
		const m = getModel("anthropic", "claude-opus-4-5");
		expect(m.contextWindow).toBe(200_000);
	});

	it("sonnet-4-5 stays at 200_000", () => {
		const m = getModel("anthropic", "claude-sonnet-4-5");
		expect(m.contextWindow).toBe(200_000);
	});
});
