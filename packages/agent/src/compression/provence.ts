// T-027: Provence reranker-pruner middleware over chunk lists.
//
// Deterministic scoring: bag-of-words overlap between each chunk and the
// query, normalized by chunk length. Sort desc, keep top-K by ratio, drop
// anything below `dropBelow` threshold. Real ONNX reranker lands in T-081.

import type { RerankerInput, RerankerOutput } from "./types.js";

function tokenize(text: string): string[] {
	return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

export function scoreChunk(chunk: string, query: string): number {
	const chunkTokens = tokenize(chunk);
	const queryTokens = new Set(tokenize(query));
	if (chunkTokens.length === 0 || queryTokens.size === 0) return 0;
	let overlap = 0;
	for (const t of chunkTokens) if (queryTokens.has(t)) overlap++;
	return overlap / Math.sqrt(chunkTokens.length);
}

export function rerank(input: RerankerInput): RerankerOutput {
	const scored = input.chunks
		.map((chunk) => ({ chunk, score: scoreChunk(chunk, input.query) }))
		.sort((a, b) => b.score - a.score || a.chunk.localeCompare(b.chunk));
	const keepCount = Math.max(1, Math.floor(input.chunks.length * input.keepRatio));
	const kept = scored
		.slice(0, keepCount)
		.filter((s) => s.score >= input.dropBelow);
	return { kept, dropped: input.chunks.length - kept.length };
}

export class ProvenceMiddleware {
	readonly name = "provence";
	prune(input: RerankerInput): RerankerOutput {
		return rerank(input);
	}
}
