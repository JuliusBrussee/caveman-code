import { describe, expect, it } from "vitest";
import { BertTokenizer } from "../compression/bert-tokenizer.js";
import { type OnnxSessionFactory, LLMLinguaMiddleware, deterministicCompress } from "../compression/llmlingua.js";

// ── Mini vocabulary for tests (no filesystem needed) ────────────────
const MINI_VOCAB = [
	"[PAD]",      // 0
	"[UNK]",      // 1
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
	"##s",        // 17
	"##ed",       // 18
	"##ing",      // 19
	"##ly",       // 20
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

	it("tracks character offsets correctly", () => {
		const tok = miniTokenizer();
		const tokens = tok.tokenize("hello world");
		const content = tokens.filter(t => t.wordIndex >= 0);
		expect(content[0].startOffset).toBe(0);
		expect(content[0].endOffset).toBe(5);
		expect(content[1].startOffset).toBe(6);
		expect(content[1].endOffset).toBe(11);
	});

	it("preserves offsets across multiple whitespace types", () => {
		const tok = miniTokenizer();
		const tokens = tok.tokenize("hello\n  world");
		const content = tokens.filter(t => t.wordIndex >= 0);
		expect(content[0].startOffset).toBe(0);
		expect(content[0].endOffset).toBe(5);
		// "world" starts after "hello\n  " = index 8
		expect(content[1].startOffset).toBe(8);
		expect(content[1].endOffset).toBe(13);
	});

	it("handles unknown words as [UNK]", () => {
		const tok = miniTokenizer();
		const tokens = tok.tokenize("supercalifragilistic");
		const content = tokens.filter(t => t.wordIndex >= 0);
		expect(content[0].text).toBe("[UNK]");
	});

	it("splits punctuation into separate tokens with correct offsets", () => {
		const tok = miniTokenizer();
		const tokens = tok.tokenize("hello, world.");
		const content = tokens.filter(t => t.wordIndex >= 0);
		expect(content.map(t => t.text)).toEqual(["hello", ",", "world", "."]);
		expect(content[1].startOffset).toBe(5); // comma
		expect(content[2].startOffset).toBe(7); // "world" after ", "
	});

	it("applies WordPiece subword splitting", () => {
		const tok = miniTokenizer();
		// "quickly" is NOT in vocab, but "quick" + "##ly" are
		const tokens = tok.tokenize("quickly");
		const content = tokens.filter(t => t.wordIndex >= 0);
		expect(content.map(t => t.text)).toEqual(["quick", "##ly"]);
		expect(content[1].isSubword).toBe(true);
		// Both subwords share the parent word's span
		expect(content[0].startOffset).toBe(0);
		expect(content[1].startOffset).toBe(0);
		expect(content[1].endOffset).toBe(7);
	});

	it("decode still works for backward compatibility", () => {
		const tok = miniTokenizer();
		const tokens = tok.tokenize("hello world");
		expect(tok.decode(tokens)).toBe("hello world");
	});

	it("reconstructFromOriginal preserves newlines", () => {
		const tok = miniTokenizer();
		const original = "hello\n  world";
		const tokens = tok.tokenize(original);
		const content = tokens.filter(t => t.wordIndex >= 0);
		const reconstructed = tok.reconstructFromOriginal(original, content);
		expect(reconstructed).toBe("hello\n  world");
	});

	it("reconstructFromOriginal handles partial token selection", () => {
		const tok = miniTokenizer();
		const original = "hello world test";
		const tokens = tok.tokenize(original);
		const content = tokens.filter(t => t.wordIndex >= 0);
		// Keep only "hello" and "test" (skip "world")
		const kept = [content[0], content[2]];
		const reconstructed = tok.reconstructFromOriginal(original, kept);
		// Should preserve the gap between hello and test
		expect(reconstructed).toContain("hello");
		expect(reconstructed).toContain("test");
		expect(reconstructed).not.toContain("world");
	});

	it("truncates at 512 tokens without throwing", () => {
		const tok = miniTokenizer();
		const long = "hello world ".repeat(300);
		const tokens = tok.tokenize(long);
		expect(tokens.length).toBeLessThanOrEqual(512);
		expect(tokens[0].text).toBe("[CLS]");
		expect(tokens[tokens.length - 1].text).toBe("[SEP]");
	});

	it("chunkText returns chunks with offsets", () => {
		const tok = miniTokenizer();
		const long = "hello world ".repeat(300);
		const chunks = tok.chunkText(long, 100);
		expect(chunks.length).toBeGreaterThan(1);
		// First chunk starts at 0
		expect(chunks[0].start).toBe(0);
		// Each chunk has valid start/end
		for (const chunk of chunks) {
			expect(chunk.end).toBeGreaterThan(chunk.start);
			expect(chunk.text).toBe(long.slice(chunk.start, chunk.end));
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

// ── deterministicCompress tests ─────────────────────────────────────

describe("deterministicCompress", () => {
	it("preserves newlines in multi-line content", () => {
		const input = "line one\nline two\nline three\nline four";
		const result = deterministicCompress(input, 0.5);
		expect(result).toContain("\n");
		// Should keep approximately half the lines
		const lines = result.split("\n");
		expect(lines.length).toBeGreaterThanOrEqual(2);
		expect(lines.length).toBeLessThanOrEqual(3);
	});

	it("drops blank lines first in multi-line content", () => {
		const input = "important code\n\n\nmore important code\n\nanother line";
		const result = deterministicCompress(input, 0.5);
		// Should keep content lines over blank lines
		expect(result).toContain("important code");
		expect(result).toContain("more important code");
	});

	it("preserves code indentation within kept lines", () => {
		const input = "function foo() {\n  return 1;\n  const x = 2;\n}";
		const result = deterministicCompress(input, 0.75);
		// Each kept line should have its original indentation
		for (const line of result.split("\n")) {
			expect(input).toContain(line);
		}
	});

	it("handles single-line input", () => {
		const input = "one two three four five six";
		const result = deterministicCompress(input, 0.5);
		expect(result.length).toBeLessThan(input.length);
	});

	it("returns empty string for empty input", () => {
		expect(deterministicCompress("", 0.5)).toBe("");
	});

	it("returns input unchanged when ratio >= 1", () => {
		expect(deterministicCompress("hello world", 1.0)).toBe("hello world");
	});
});

// ── Mock ONNX session ───────────────────────────────────────────────

function createMockFactory(): OnnxSessionFactory {
	return async (_modelPath: string) => ({
		async run(feeds: Record<string, { data: BigInt64Array | Float32Array | Int32Array; dims: number[] }>) {
			const seqLen = feeds.input_ids.dims[1];
			const logits = new Float32Array(seqLen * 2);
			for (let i = 0; i < seqLen; i++) {
				logits[i * 2 + 0] = i % 2 === 0 ? -2.0 : 2.0;
				logits[i * 2 + 1] = i % 2 === 0 ? 2.0 : -2.0;
			}
			return { logits: { data: logits, dims: [1, seqLen, 2] } };
		},
	});
}

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
