import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Type } from "@sinclair/typebox";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getModel, getModels, isSelectableModel, supportsXhigh } from "../src/models.js";
import { streamAnthropic, streamSimpleAnthropic } from "../src/providers/anthropic.js";
import { streamSimpleOpenAICompletions } from "../src/providers/openai-completions.js";
import type { Context, SimpleStreamOptions } from "../src/types.js";

interface CapturedRequest {
	url: string;
	apiKey: string | undefined;
	body: {
		model: string;
		thinking?: { type: string; budget_tokens?: number };
		output_config?: { effort: string };
		reasoning?: { effort: string };
		reasoning_effort?: string;
		service_tier?: string;
		max_tokens?: number;
		messages: Array<{ role: string; content: Array<Record<string, unknown>> }>;
	};
}

const context: Context = {
	messages: [
		{
			role: "user",
			content: [
				{ type: "text", text: "Inspect this image using lookup" },
				{ type: "image", mimeType: "image/png", data: "aW1hZ2U=" },
			],
			timestamp: 0,
		},
	],
	tools: [{ name: "lookup", description: "Look up a value", parameters: Type.Object({ value: Type.String() }) }],
};

// Real SDK serialization into a local HTTP server. No payload callback or SDK mock.
describe("MiniMax HTTP contract", () => {
	let server: Server;
	let baseUrl: string;
	let openaiToolReply = false;
	const requests: CapturedRequest[] = [];

	beforeAll(async () => {
		server = createServer(async (req, res) => {
			const chunks: Buffer[] = [];
			for await (const chunk of req) chunks.push(Buffer.from(chunk));
			const body = JSON.parse(Buffer.concat(chunks).toString());
			requests.push({ url: req.url!, apiKey: req.headers["x-api-key"] as string | undefined, body });
			res.writeHead(200, { "content-type": "text/event-stream" });
			if (req.url?.endsWith("/chat/completions")) {
				if (openaiToolReply) {
					const choice = {
						index: 0,
						delta: {
							reasoning_content: "Use lookup.",
							tool_calls: [
								{
									index: 0,
									id: "call_1",
									type: "function",
									function: { name: "lookup", arguments: '{"value":"ok"}' },
								},
							],
						},
						finish_reason: "tool_calls",
					};
					res.end(`data: ${JSON.stringify({ id: "reply", choices: [choice] })}\n\ndata: [DONE]\n\n`);
					return;
				}
				res.end(
					`data: ${JSON.stringify({ id: "reply", choices: [{ index: 0, delta: { content: "ok" }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
				);
				return;
			}
			const events = [
				{
					type: "message_start",
					message: {
						id: "reply",
						type: "message",
						role: "assistant",
						model: body.model,
						content: [],
						stop_reason: null,
						usage: { input_tokens: 10, output_tokens: 0 },
					},
				},
				{ type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } },
				{ type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Use lookup." } },
				{ type: "content_block_stop", index: 0 },
				{
					type: "content_block_start",
					index: 1,
					content_block: { type: "tool_use", id: "call_1", name: "lookup", input: {} },
				},
				{
					type: "content_block_delta",
					index: 1,
					delta: { type: "input_json_delta", partial_json: '{"value":"ok"}' },
				},
				{ type: "content_block_stop", index: 1 },
				{ type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 5 } },
				{ type: "message_stop" },
			];
			res.end(events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
		});
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});

	afterAll(async () => {
		await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
	});

	for (const provider of ["minimax", "minimax-cn"] as const) {
		for (const reasoning of [undefined, "minimal", "low", "medium", "high", "xhigh"] as const) {
			it(`${provider} Flash ${reasoning ?? "off/default"} reaches HTTP as adaptive with valid effort`, async () => {
				const model = { ...getModel(provider, "MiniMax-M3.1-Flash"), baseUrl: `${baseUrl}/anthropic` };
				const result = await streamSimpleAnthropic(model, context, {
					apiKey: "fixture-key",
					reasoning,
					maxTokens: 4096,
				}).result();
				expect(result.stopReason, result.errorMessage).toBe("toolUse");
				const sent = requests.at(-1)!;
				expect(sent.url).toBe("/anthropic/v1/messages");
				expect(sent.apiKey).toBe("fixture-key");
				expect(sent.body.model).toBe("MiniMax-M3.1-Flash");
				expect(sent.body.thinking).toEqual({ type: "adaptive" });
				expect(sent.body.output_config).toEqual({ effort: reasoning === "minimal" ? "low" : (reasoning ?? "max") });
				expect(sent.body.service_tier).toBeUndefined();
				expect(sent.body.max_tokens).toBe(4096);
				expect(sent.body.messages[0].content).toContainEqual({
					type: "image",
					source: { type: "base64", media_type: "image/png", data: "aW1hZ2U=" },
				});
			});
		}

		it(`${provider} M3 has no effort and only enables adaptive thinking when requested`, async () => {
			const model = { ...getModel(provider, "MiniMax-M3"), baseUrl: `${baseUrl}/anthropic` };
			for (const reasoning of [undefined, "high"] as const) {
				const result = await streamSimpleAnthropic(model, context, { apiKey: "fixture-key", reasoning }).result();
				expect(result.stopReason, result.errorMessage).toBe("toolUse");
				expect(requests.at(-1)!.body.thinking).toEqual(reasoning ? { type: "adaptive" } : undefined);
				expect(requests.at(-1)!.body.output_config).toBeUndefined();
			}
		});
	}

	it("keeps unsigned thinking and tool history on the next SDK request", async () => {
		const model = { ...getModel("minimax", "MiniMax-M3.1-Flash"), baseUrl: `${baseUrl}/anthropic` };
		const first = await streamAnthropic(model, context, { apiKey: "fixture-key", thinkingEnabled: false }).result();
		expect(first.stopReason, first.errorMessage).toBe("toolUse");
		const next: Context = {
			...context,
			messages: [
				...context.messages,
				first,
				{
					role: "toolResult",
					toolCallId: "call_1",
					toolName: "lookup",
					content: [{ type: "text", text: "ok" }],
					isError: false,
					timestamp: 1,
				},
			],
		};
		const result = await streamAnthropic(model, next, { apiKey: "fixture-key", effort: "max" }).result();
		expect(result.stopReason, result.errorMessage).toBe("toolUse");
		const body = requests.at(-1)!.body;
		expect(body.messages[1].content).toEqual([
			{ type: "thinking", thinking: "Use lookup." },
			{ type: "tool_use", id: "call_1", name: "lookup", input: { value: "ok" } },
		]);
		expect(body.messages[2].content[0]).toMatchObject({ type: "tool_result", tool_use_id: "call_1" });
		expect(body.output_config).toEqual({ effort: "max" });
	});

	it("preserves legacy and custom direct requests without applying Flash rules", async () => {
		const legacy = { ...getModel("minimax", "MiniMax-M2.7"), baseUrl: `${baseUrl}/anthropic` };
		for (const model of [legacy, { ...legacy, id: "custom-model" }]) {
			const result = await streamAnthropic(model, context, {
				apiKey: "fixture-key",
				thinkingEnabled: false,
			}).result();
			expect(result.stopReason, result.errorMessage).toBe("toolUse");
			expect(requests.at(-1)!.body.model).toBe(model.id);
			expect(requests.at(-1)!.body.thinking).toEqual({ type: "disabled" });
			expect(requests.at(-1)!.body.output_config).toBeUndefined();
		}
	});

	for (const configured of [
		getModel("openrouter", "minimax/minimax-m3.1-flash:free"),
		getModel("opencode", "minimax-m3.1-flash-free"),
		getModel("opencode-go", "minimax-m3.1-flash-free"),
	]) {
		it(`${configured.provider} replays reasoning and tool calls through the SDK`, async () => {
			const model = { ...configured, baseUrl: `${baseUrl}/v1` };
			openaiToolReply = true;
			try {
				const first = await streamSimpleOpenAICompletions(model, context, { apiKey: "fixture-key" }).result();
				expect(first.stopReason, first.errorMessage).toBe("toolUse");
				const next: Context = {
					...context,
					messages: [
						...context.messages,
						first,
						{
							role: "toolResult",
							toolCallId: "call_1",
							toolName: "lookup",
							content: [{ type: "text", text: "ok" }],
							isError: false,
							timestamp: 1,
						},
					],
				};
				const result = await streamSimpleOpenAICompletions(model, next, { apiKey: "fixture-key" }).result();
				expect(result.stopReason, result.errorMessage).toBe("toolUse");
				expect(requests.at(-1)!.body.messages[1]).toMatchObject({
					role: "assistant",
					reasoning_content: "Use lookup.",
					tool_calls: [
						{ id: "call_1", type: "function", function: { name: "lookup", arguments: '{"value":"ok"}' } },
					],
				});
				expect(requests.at(-1)!.body.messages[2]).toMatchObject({ role: "tool", tool_call_id: "call_1" });
			} finally {
				openaiToolReply = false;
			}
		});
	}

	for (const provider of ["opencode", "opencode-go"] as const) {
		for (const reasoning of [undefined, "minimal", "low", "medium", "high", "xhigh"] as const) {
			it(`${provider} Flash keeps its own route and ${reasoning ?? "default"} effort`, async () => {
				const configured = getModel(provider, "minimax-m3.1-flash-free");
				const model = { ...configured, baseUrl: `${baseUrl}${new URL(configured.baseUrl).pathname}` };
				const result = await streamSimpleOpenAICompletions(model, context, {
					apiKey: "fixture-key",
					reasoning,
				}).result();
				expect(result.stopReason, result.errorMessage).toBe("stop");
				expect(requests.at(-1)!.url).toBe(`${new URL(configured.baseUrl).pathname}/chat/completions`);
				expect(requests.at(-1)!.body.model).toBe("minimax-m3.1-flash-free");
				expect(requests.at(-1)!.body.reasoning_effort).toBe(reasoning === "minimal" ? "low" : (reasoning ?? "max"));
			});
		}
	}

	it("Go M3 uses its independently documented Anthropic route and adaptive toggle", async () => {
		const configured = getModel("opencode-go", "minimax-m3");
		const model = { ...configured, baseUrl: `${baseUrl}${new URL(configured.baseUrl).pathname}` };
		const result = await streamSimpleAnthropic(model, context, { apiKey: "fixture-key", reasoning: "high" }).result();
		expect(result.stopReason, result.errorMessage).toBe("toolUse");
		expect(requests.at(-1)!.url).toBe("/inference/go/anthropic/v1/messages");
		expect(requests.at(-1)!.body.model).toBe("minimax-m3");
		expect(requests.at(-1)!.body.thinking).toEqual({ type: "adaptive" });
		expect(requests.at(-1)!.body.output_config).toBeUndefined();
	});

	it("Zen M3 does not inherit effort controls from Flash", async () => {
		const configured = getModel("opencode", "minimax-m3");
		const model = { ...configured, baseUrl: `${baseUrl}${new URL(configured.baseUrl).pathname}` };
		const result = await streamSimpleOpenAICompletions(model, context, {
			apiKey: "fixture-key",
			reasoning: "high",
		}).result();
		expect(result.stopReason, result.errorMessage).toBe("stop");
		expect(requests.at(-1)!.body.reasoning_effort).toBeUndefined();
	});

	for (const reasoning of [undefined, "minimal", "xhigh"] satisfies SimpleStreamOptions["reasoning"][]) {
		it(`OpenRouter preserves the verified :free ID and ${reasoning ?? "default"} effort`, async () => {
			const model = { ...getModel("openrouter", "minimax/minimax-m3.1-flash:free"), baseUrl: `${baseUrl}/v1` };
			const result = await streamSimpleOpenAICompletions(model, context, {
				apiKey: "fixture-key",
				reasoning,
			}).result();
			expect(result.stopReason, result.errorMessage).toBe("stop");
			expect(requests.at(-1)!.url).toBe("/v1/chat/completions");
			expect(requests.at(-1)!.body.model).toBe("minimax/minimax-m3.1-flash:free");
			expect(requests.at(-1)!.body.reasoning).toEqual({
				effort: reasoning === "minimal" ? "low" : (reasoning ?? "max"),
			});
		});
	}
});

describe("MiniMax catalogs", () => {
	it.each(["minimax", "minimax-cn"] as const)(
		"%s lists Flash first and M3 while retaining explicit legacy lookup",
		(provider) => {
			expect(getModels(provider).map((model) => model.id)).toEqual(["MiniMax-M3.1-Flash", "MiniMax-M3"]);
			const flash = getModel(provider, "MiniMax-M3.1-Flash");
			expect(flash.contextWindow).toBe(1_000_000);
			expect(flash.maxTokens).toBe(524_288);
			expect(flash.cost).toEqual({ input: 0.15, output: 0.6, cacheRead: 0.015, cacheWrite: 0 });
			expect(supportsXhigh(flash)).toBe(true);
			expect(getModel(provider, "MiniMax-M3").cost).toEqual({
				input: 0.3,
				output: 1.2,
				cacheRead: 0.06,
				cacheWrite: 0,
			});
			const legacy = getModel(provider, "MiniMax-M2.7");
			expect(getModels(provider, { includeLegacy: true })).toContain(legacy);
			expect(isSelectableModel(legacy)).toBe(false);
			expect(isSelectableModel({ ...legacy, baseUrl: "https://custom.example/v1" })).toBe(true);
			expect(isSelectableModel({ ...legacy, id: "speech-2.8-hd" })).toBe(true);
		},
	);

	it("keeps unrelated models and gateway metadata", () => {
		expect(getModels("anthropic")).toContain(getModel("anthropic", "claude-opus-4-6"));
		const models = getModels("openrouter").filter((model) => model.id.startsWith("minimax/"));
		expect(models.map((model) => model.id)).toEqual(["minimax/minimax-m3.1-flash:free", "minimax/minimax-m3"]);
		expect(models[0].cost.input).toBe(0);
		expect(models[1].contextWindow).toBe(1_048_576);
		for (const provider of ["opencode", "opencode-go"] as const) {
			expect(
				getModels(provider)
					.filter((model) => model.id.startsWith("minimax-"))
					.map((model) => model.id),
			).toEqual(["minimax-m3.1-flash-free", "minimax-m3"]);
			expect(getModel(provider, "minimax-m3.1-flash-free").maxTokens).toBe(512_000);
		}
		expect(getModel("opencode", "minimax-m3").contextWindow).toBe(512_000);
		expect(getModel("opencode-go", "minimax-m3").maxTokens).toBe(131_072);
	});
});
