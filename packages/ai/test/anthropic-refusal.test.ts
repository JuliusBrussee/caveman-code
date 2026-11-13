import { expect, it, vi } from "vitest";
import { getModel } from "../src/models.js";
import { streamSimple } from "../src/stream.js";

vi.mock("@anthropic-ai/sdk", () => {
	const fakeStream = {
		async *[Symbol.asyncIterator]() {
			yield { type: "message_start", message: { id: "msg_1", usage: { input_tokens: 1, output_tokens: 0 } } };
			yield { type: "message_delta", delta: { stop_reason: "refusal" }, usage: { output_tokens: 1 } };
		},
	};
	class FakeAnthropic {
		messages = { stream: () => fakeStream };
	}
	return { default: FakeAnthropic };
});

it("names the stop reason when a streaming classifier refuses", async () => {
	const s = streamSimple(
		getModel("anthropic", "claude-opus-4-6"),
		{ messages: [{ role: "user", content: "Hello", timestamp: Date.now() }] },
		{ apiKey: "fake-key" },
	);
	let errorMessage: string | undefined;
	for await (const event of s) {
		if (event.type === "error") errorMessage = event.error.errorMessage;
	}
	expect(errorMessage).toBe("Response stopped by safety classifier (stop_reason: refusal)");
});
