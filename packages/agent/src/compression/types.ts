// T-026, T-027: compression middleware types.

export interface CompressionMiddleware {
	readonly name: string;
	compress(block: string, opts: CompressionOptions): CompressionResult;
}

export interface CompressionOptions {
	/** Target ratio 0..1; 0.5 = aim for 50% of original tokens. */
	targetRatio: number;
	/** If input block is below this token estimate, passthrough unchanged. */
	activationThreshold: number;
}

export interface CompressionResult {
	bytes: string;
	estimatedInputTokens: number;
	estimatedOutputTokens: number;
	compressed: boolean;
	/** Middleware name or "passthrough". */
	via: string;
}

export interface RerankerInput {
	chunks: string[];
	query: string;
	keepRatio: number;
	dropBelow: number;
}

export interface RerankerOutput {
	kept: { chunk: string; score: number }[];
	dropped: number;
}

// Simple whitespace-based token estimate. Good enough for routing decisions;
// real tokenizers live in packages/ai.
export function estimateTokens(text: string): number {
	if (!text) return 0;
	// ~1 token per 4 chars heuristic, min 1 for non-empty.
	return Math.max(1, Math.ceil(text.length / 4));
}
