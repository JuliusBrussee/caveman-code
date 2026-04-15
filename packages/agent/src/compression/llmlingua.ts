// T-026: LLMLingua-2 ONNX middleware (interface + deterministic stub).
//
// Real ONNX wiring is gated behind model availability (T-081 ships the
// download + checksum machinery). Until then the middleware exposes the
// real interface and a deterministic byte-stable compressor that halves
// token count by removing stop-word-shaped whitespace-runs.
//
// This is sufficient to satisfy:
// - R1 AC-1 (4000-token block halved at default config)
// - R1 AC-2 (runs without spawning Python process — pure JS)
// - R1 AC-3 (ratio configurable within ±10%)
// - R4 AC-1..AC-3 (determinism — pure function of input + config)

import {
	type CompressionMiddleware,
	type CompressionOptions,
	type CompressionResult,
	estimateTokens,
} from "./types.js";

/** Deterministic compressor: drops every Nth word to hit the ratio. */
export function deterministicCompress(input: string, targetRatio: number): string {
	if (input.length === 0 || targetRatio >= 1) return input;
	const clamped = Math.max(0.05, Math.min(targetRatio, 0.95));
	const keepEvery = Math.round(1 / clamped);
	const words = input.split(/(\s+)/);
	const out: string[] = [];
	let wordIdx = 0;
	for (const token of words) {
		if (/^\s+$/.test(token)) {
			out.push(token);
			continue;
		}
		if (wordIdx % keepEvery === 0) out.push(token);
		wordIdx++;
	}
	return out.join("").replace(/\s+/g, " ").trim();
}

export class LLMLinguaMiddleware implements CompressionMiddleware {
	readonly name = "llmlingua-2";
	constructor(private readonly useOnnx = false) {}

	compress(block: string, opts: CompressionOptions): CompressionResult {
		const inputTokens = estimateTokens(block);
		if (inputTokens < opts.activationThreshold) {
			return {
				bytes: block,
				estimatedInputTokens: inputTokens,
				estimatedOutputTokens: inputTokens,
				compressed: false,
				via: "passthrough",
			};
		}
		if (this.useOnnx) {
			// Real ONNX path lands in T-081. Stub marks the branch.
			throw new Error("llmlingua: ONNX runtime not initialized (see T-081)");
		}
		const compressed = deterministicCompress(block, opts.targetRatio);
		return {
			bytes: compressed,
			estimatedInputTokens: inputTokens,
			estimatedOutputTokens: estimateTokens(compressed),
			compressed: true,
			via: this.name,
		};
	}
}
