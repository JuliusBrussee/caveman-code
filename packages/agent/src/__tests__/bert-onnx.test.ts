import { describe, expect, it } from "vitest";
import { BertTokenizer } from "../compression/bert-tokenizer.js";
import { type OnnxSessionFactory, LLMLinguaMiddleware } from "../compression/llmlingua.js";

// ── Mini vocabulary for tests (no filesystem needed) ────────────────
// Line number = token id. Matches BERT special token convention.
const MINI_VOCAB = [
	"[PAD]",      // 0
	"[UNK]",      // 1 (normally 100, but mini vocab uses sequential ids)
	"[CLS]",      // 2
	"[SEP]",      // 3
	"hello",      // 4
	"world",      // 5
	"the",        // 6
	"quick",      // 7
	"brown",      // 8
	"fox",        // 9
	"jumps",      // 10
	"over",       // 11
	"lazy",       // 12
	"dog",        // 13
	"function",   // 14
	"return",     // 15
	"const",      // 16
	"##s",        // 17 (subword)
	"##ed",       // 18 (subword)
	"##ing",      // 19 (subword)
	"##ly",       // 20 (subword)
	"jump",       // 21
	".",          // 22
	",",          // 23
	"(",          // 24
	")",          // 25
	"test",       // 26
].join("\n");

function miniTokenizer(): BertTokenizer {
	return BertTokenizer.fromVocabTxt(MINI_VOCAB);
}

// ── BertTokenizer tests ─────────────────────────────────────────────

describe("BertTokenizer", () => {
	it("tokenizes known words with [CLS] and [SEP]", () => {
		const tok = miniTokenizer();
		const tokens = tok.tokenize("hello world");
		expect(tokens[0].text).toBe("[CLS]");
		expect(tokens[tokens.length - 1].text).toBe("[SEP]");
		const content = tokens.filter(t => t.wordIndex >= 0);
		expect(content.map(t => t.text)).toEqual(["hello", "world"]);
	});

	it("handles unknown words as [UNK]", () => {
		const tok = miniTokenizer();
		const tokens = tok.tokenize("supercalifragilistic");
		const content = tokens.filter(t => t.wordIndex >= 0);
		expect(content[0].text).toBe("[UNK]");
	});

	it("splits punctuation into separate tokens", () => {
		const tok = miniTokenizer();
		const tokens = tok.tokenize("hello, world.");
		const content = tokens.filter(t => t.wordIndex >= 0);
		expect(content.map(t => t.text)).toEqual(["hello", ",", "world", "."]);
	});

	it("applies WordPiece subword splitting", () => {
		const tok = miniTokenizer();
		// "quickly" is NOT in vocab, but "quick" + "##ly" are → subword split
		const tokens = tok.tokenize("quickly");
		const content = tokens.filter(t => t.wordIndex >= 0);
		expect(content.map(t => t.text)).toEqual(["quick", "##ly"]);
		expect(content[1].isSubword).toBe(true);
	});

	it("decode reverses tokenization for simple input", () => {
		const tok = miniTokenizer();
		const tokens = tok.tokenize("hello world");
		const decoded = tok.decode(tokens);
		expect(decoded).toBe("hello world");
	});

	it("decode merges subword tokens", () => {
		const tok = miniTokenizer();
		const tokens = tok.tokenize("jumps");
		const decoded = tok.decode(tokens);
		expect(decoded).toBe("jumps");
	});

	it("truncates at 512 tokens without throwing", () => {
		const tok = miniTokenizer();
		// Generate input that would exceed 512 tokens
		const long = "hello world ".repeat(300);
		const tokens = tok.tokenize(long);
		expect(tokens.length).toBeLessThanOrEqual(512);
		expect(tokens[0].text).toBe("[CLS]");
		expect(tokens[tokens.length - 1].text).toBe("[SEP]");
	});

	it("chunkText splits long inputs", () => {
		const tok = miniTokenizer();
		const long = "hello world ".repeat(300);
		const chunks = tok.chunkText(long, 100);
		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			const tokens = tok.tokenize(chunk);
			// Each chunk's content tokens should fit in 100
			const content = tokens.filter(t => t.wordIndex >= 0);
			expect(content.length).toBeLessThanOrEqual(100);
		}
	});

	it("handles empty input", () => {
		const tok = miniTokenizer();
		const tokens = tok.tokenize("");
		expect(tokens.length).toBe(2); // [CLS] + [SEP]
		expect(tok.decode(tokens)).toBe("");
	});

	it("vocabSize reflects loaded vocabulary", () => {
		const tok = miniTokenizer();
		expect(tok.vocabSize).toBe(27);
	});
});

// ── Mock ONNX session ───────────────────────────────────────────────

/**
 * Mock ONNX session that returns deterministic logits.
 * Even-indexed tokens get high "keep" score, odd get high "drop" score.
 */
function createMockFactory(): OnnxSessionFactory {
	return async (_modelPath: string) => ({
		async run(feeds: Record<string, { data: BigInt64Array | Float32Array | Int32Array; dims: number[] }>) {
			const seqLen = feeds.input_ids.dims[1];
			const logits = new Float32Array(seqLen * 2);
			for (let i = 0; i < seqLen; i++) {
				// Class 0 = drop, class 1 = keep
				// Alternate: even tokens kept, odd tokens dropped
				logits[i * 2 + 0] = i % 2 === 0 ? -2.0 : 2.0;  // drop logit
				logits[i * 2 + 1] = i % 2 === 0 ? 2.0 : -2.0;   // keep logit
			}
			return { logits: { data: logits, dims: [1, seqLen, 2] } };
		},
	});
}

/** Mock factory that throws on inference. */
function createThrowingFactory(): OnnxSessionFactory {
	return async (_modelPath: string) => ({
		async run() {
			throw new Error("GPU exploded");
		},
	});
}

// ── LLMLinguaMiddleware ONNX tests ──────────────────────────────────

describe("LLMLinguaMiddleware with mock ONNX", () => {
	const tok = miniTokenizer();

	it("compressAsync reduces output via mock BERT inference", async () => {
		const mw = new LLMLinguaMiddleware(true, createMockFactory(), tok);
		// Need enough text to exceed activation threshold
		const input = "hello world the quick brown fox jumps over the lazy dog ".repeat(20);
		const result = await mw.compressAsync(input, {
			targetRatio: 0.5,
			activationThreshold: 10,
		});
		expect(result.compressed).toBe(true);
		expect(result.via).toBe("llmlingua-2:onnx");
		expect(result.estimatedOutputTokens).toBeLessThan(result.estimatedInputTokens);
	});

	it("falls back to deterministic on ONNX error", async () => {
		const mw = new LLMLinguaMiddleware(true, createThrowingFactory(), tok);
		const input = "hello world ".repeat(50);
		const result = await mw.compressAsync(input, {
			targetRatio: 0.5,
			activationThreshold: 10,
		});
		expect(result.compressed).toBe(true);
		expect(result.via).toBe("llmlingua-2:fallback");
	});

	it("deterministic: same input + same mock → same output", async () => {
		const mw = new LLMLinguaMiddleware(true, createMockFactory(), tok);
		const input = "the quick brown fox jumps over the lazy dog ".repeat(10);
		const opts = { targetRatio: 0.5, activationThreshold: 10 };
		const r1 = await mw.compressAsync(input, opts);
		const r2 = await mw.compressAsync(input, opts);
		expect(r1.bytes).toBe(r2.bytes);
	});

	it("passthrough when below activation threshold", async () => {
		const mw = new LLMLinguaMiddleware(true, createMockFactory(), tok);
		const input = "short";
		const result = await mw.compressAsync(input, {
			targetRatio: 0.5,
			activationThreshold: 999999,
		});
		expect(result.compressed).toBe(false);
		expect(result.bytes).toBe(input);
		expect(result.via).toBe("passthrough");
	});
});

describe("LLMLinguaMiddleware without ONNX", () => {
	it("compressAsync uses deterministic compressor", async () => {
		const mw = new LLMLinguaMiddleware(false);
		const input = "word ".repeat(100);
		const result = await mw.compressAsync(input, {
			targetRatio: 0.5,
			activationThreshold: 10,
		});
		expect(result.compressed).toBe(true);
		expect(result.via).toBe("llmlingua-2");
	});

	it("sync compress works without ONNX", () => {
		const mw = new LLMLinguaMiddleware(false);
		const input = "word ".repeat(100);
		const result = mw.compress(input, {
			targetRatio: 0.5,
			activationThreshold: 10,
		});
		expect(result.compressed).toBe(true);
	});

	it("sync compress throws when useOnnx=true and not initialized", () => {
		const mw = new LLMLinguaMiddleware(true);
		const input = "word ".repeat(100);
		expect(() =>
			mw.compress(input, { targetRatio: 0.5, activationThreshold: 10 }),
		).toThrow("ONNX runtime not initialized");
	});
});
