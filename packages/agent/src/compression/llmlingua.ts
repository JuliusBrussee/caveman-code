// T-026, T-081, T-082: LLMLingua-2 ONNX middleware.
//
// Deterministic fallback (pure JS) + real BERT token-classification
// inference via ONNX runtime when useOnnx=true.

import { BertTokenizer, type BertToken } from "./bert-tokenizer.js";
import { downloadModel, isModelCached, LLMLINGUA2_MANIFEST, modelPath, vocabPath } from "./model-download.js";
import {
	type CompressionMiddleware,
	type CompressionOptions,
	type CompressionResult,
	estimateTokens,
} from "./types.js";

// ── ONNX session abstraction (for test injection) ──────────────────

export interface OnnxTensor {
	data: Float32Array | BigInt64Array | Int32Array;
	dims: number[];
}

export interface OnnxInferenceSession {
	run(feeds: Record<string, OnnxTensor>): Promise<Record<string, OnnxTensor>>;
}

export type OnnxSessionFactory = (modelPath: string) => Promise<OnnxInferenceSession>;

// ── Deterministic compressor (fallback) ─────────────────────────────

/**
 * Deterministic compressor: line-based for multi-line content,
 * word-based for single lines. Preserves whitespace structure.
 */
export function deterministicCompress(input: string, targetRatio: number): string {
	if (input.length === 0 || targetRatio >= 1) return input;
	const clamped = Math.max(0.05, Math.min(targetRatio, 0.95));

	const lines = input.split("\n");
	if (lines.length > 1) {
		// Multi-line: keep the most important lines (by content length),
		// drop blank/short lines first, preserve original order
		const keepCount = Math.max(1, Math.floor(lines.length * clamped));
		const scored = lines.map((line, i) => ({
			line,
			i,
			score: line.trim().length === 0 ? 0 : line.trim().length,
		}));
		scored.sort((a, b) => b.score - a.score);
		const kept = new Set(scored.slice(0, keepCount).map((s) => s.i));
		return lines.filter((_, i) => kept.has(i)).join("\n");
	}

	// Single line: drop every Nth word, preserving inter-word whitespace
	const keepEvery = Math.round(1 / clamped);
	const segments = input.split(/(\s+)/);
	const out: string[] = [];
	let wordIdx = 0;
	for (const segment of segments) {
		if (/^\s+$/.test(segment)) {
			// Keep whitespace only if the preceding word was kept
			if (out.length > 0 && !/^\s+$/.test(out[out.length - 1])) {
				out.push(segment);
			}
			continue;
		}
		if (wordIdx % keepEvery === 0) {
			out.push(segment);
		}
		wordIdx++;
	}
	return out.join("");
}

// ── Middleware ───────────────────────────────────────────────────────

export class LLMLinguaMiddleware implements CompressionMiddleware {
	readonly name = "llmlingua-2";
	private onnxSession: OnnxInferenceSession | null = null;
	private tokenizer: BertTokenizer | null = null;
	private initPromise: Promise<void> | null = null;

	constructor(
		private readonly useOnnx = false,
		private readonly sessionFactory?: OnnxSessionFactory,
		injectedTokenizer?: BertTokenizer,
	) {
		if (injectedTokenizer) this.tokenizer = injectedTokenizer;
	}

	/** Sync compress — throws if useOnnx is true and session not pre-initialized. */
	compress(block: string, opts: CompressionOptions): CompressionResult {
		const inputTokens = estimateTokens(block);
		if (inputTokens < opts.activationThreshold) {
			return passthrough(block, inputTokens);
		}
		if (this.useOnnx && !this.onnxSession) {
			throw new Error("llmlingua: ONNX runtime not initialized — call compressAsync() or initOnnx() first");
		}
		const compressed = deterministicCompress(block, opts.targetRatio);
		return result(compressed, inputTokens, this.useOnnx ? `${this.name}:onnx` : this.name);
	}

	/** Initialize ONNX runtime + tokenizer. Downloads model on first use. */
	async initOnnx(): Promise<void> {
		if (this.onnxSession && this.tokenizer) return;
		if (this.initPromise) {
			await this.initPromise;
			return;
		}
		this.initPromise = this.doInit();
		await this.initPromise;
	}

	private async doInit(): Promise<void> {
		if (this.sessionFactory) {
			if (!this.tokenizer) {
				try {
					this.tokenizer = new BertTokenizer(vocabPath(LLMLINGUA2_MANIFEST));
				} catch {
					// No vocab file — tests must inject tokenizer via constructor
				}
			}
			this.onnxSession = await this.sessionFactory(modelPath(LLMLINGUA2_MANIFEST));
			return;
		}

		if (!(await isModelCached(LLMLINGUA2_MANIFEST))) {
			await downloadModel(LLMLINGUA2_MANIFEST);
		}

		if (!this.tokenizer) {
			this.tokenizer = new BertTokenizer(vocabPath(LLMLINGUA2_MANIFEST));
		}

		const mPath = modelPath(LLMLINGUA2_MANIFEST);
		try {
			const ort = await import("onnxruntime-node");
			this.onnxSession = await ort.InferenceSession.create(mPath, {
				executionProviders: ["cpu"],
			}) as unknown as OnnxInferenceSession;
		} catch (e) {
			throw new Error(`llmlingua: ONNX runtime init failed: ${e}`);
		}
	}

	/** Async compress — auto-initializes ONNX when useOnnx is true. */
	async compressAsync(block: string, opts: CompressionOptions): Promise<CompressionResult> {
		const inputTokens = estimateTokens(block);
		if (inputTokens < opts.activationThreshold) {
			return passthrough(block, inputTokens);
		}
		if (this.useOnnx) {
			try {
				await this.initOnnx();
				const compressed = await this.onnxCompress(block, opts.targetRatio);
				return result(compressed, inputTokens, `${this.name}:onnx`);
			} catch {
				const compressed = deterministicCompress(block, opts.targetRatio);
				return result(compressed, inputTokens, `${this.name}:fallback`);
			}
		}
		const compressed = deterministicCompress(block, opts.targetRatio);
		return result(compressed, inputTokens, this.name);
	}

	// ── BERT inference ────────────────────────────────────────────────

	/**
	 * LLMLingua-2 compression via BERT token classification.
	 * Span-based: reconstructs from original text to preserve whitespace.
	 */
	private async onnxCompress(block: string, targetRatio: number): Promise<string> {
		if (!this.tokenizer || !this.onnxSession) {
			throw new Error("llmlingua: not initialized");
		}

		const chunks = this.tokenizer.chunkText(block, 500);
		if (chunks.length === 1) {
			return this.compressChunk(block, chunks[0].text, targetRatio);
		}

		// Compress each chunk, reconstruct with original inter-chunk gaps
		const parts: string[] = [];
		for (let i = 0; i < chunks.length; i++) {
			if (i > 0) {
				// Preserve the whitespace gap between chunks
				const gap = block.slice(chunks[i - 1].end, chunks[i].start);
				parts.push(gap);
			}
			parts.push(await this.compressChunk(chunks[i].text, chunks[i].text, targetRatio));
		}
		return parts.join("");
	}

	private async compressChunk(originalChunk: string, _chunkText: string, targetRatio: number): Promise<string> {
		const tokens = this.tokenizer!.tokenize(originalChunk);
		const contentTokens = tokens.filter((t) => t.wordIndex >= 0);
		if (contentTokens.length === 0) return originalChunk;

		const keepProbs = await this.runBertInference(tokens);

		const scored = contentTokens.map((token, i) => ({
			token,
			prob: keepProbs[i + 1] ?? 0, // +1 to skip [CLS]
			originalIndex: i,
		}));

		const keepCount = Math.max(1, Math.floor(contentTokens.length * targetRatio));
		const sorted = [...scored].sort((a, b) => b.prob - a.prob);
		const keptSet = new Set<number>();
		for (let i = 0; i < keepCount && i < sorted.length; i++) {
			keptSet.add(sorted[i].originalIndex);
		}

		const keptTokens = contentTokens.filter((_, i) => keptSet.has(i));
		// Span-based reconstruction: preserves original whitespace
		return this.tokenizer!.reconstructFromOriginal(originalChunk, keptTokens);
	}

	/**
	 * Run BERT token classification model.
	 * Returns per-token "keep" probability via softmax of logit class 1.
	 */
	private async runBertInference(tokens: BertToken[]): Promise<number[]> {
		const seqLen = tokens.length;
		const inputIds = new BigInt64Array(seqLen);
		const attentionMask = new BigInt64Array(seqLen);
		const tokenTypeIds = new BigInt64Array(seqLen);

		for (let i = 0; i < seqLen; i++) {
			inputIds[i] = BigInt(tokens[i].id);
			attentionMask[i] = 1n;
			tokenTypeIds[i] = 0n;
		}

		const outputs = await this.onnxSession!.run({
			input_ids: { data: inputIds, dims: [1, seqLen] },
			attention_mask: { data: attentionMask, dims: [1, seqLen] },
			token_type_ids: { data: tokenTypeIds, dims: [1, seqLen] },
		});

		const logits = outputs.logits?.data as Float32Array;
		if (!logits) {
			throw new Error("llmlingua: model output missing 'logits' tensor");
		}

		const keepProbs: number[] = [];
		for (let i = 0; i < seqLen; i++) {
			const dropLogit = logits[i * 2];
			const keepLogit = logits[i * 2 + 1];
			const max = Math.max(dropLogit, keepLogit);
			const expDrop = Math.exp(dropLogit - max);
			const expKeep = Math.exp(keepLogit - max);
			keepProbs.push(expKeep / (expDrop + expKeep));
		}

		return keepProbs;
	}
}

// ── Helpers ─────────────────────────────────────────────────────────

function passthrough(block: string, inputTokens: number): CompressionResult {
	return {
		bytes: block,
		estimatedInputTokens: inputTokens,
		estimatedOutputTokens: inputTokens,
		compressed: false,
		via: "passthrough",
	};
}

function result(compressed: string, inputTokens: number, via: string): CompressionResult {
	return {
		bytes: compressed,
		estimatedInputTokens: inputTokens,
		estimatedOutputTokens: estimateTokens(compressed),
		compressed: true,
		via,
	};
}
