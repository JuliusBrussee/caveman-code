// T-026, T-027
import { describe, expect, it } from "vitest";
import {
	deterministicCompress,
	estimateTokens,
	LLMLinguaMiddleware,
	ProvenceMiddleware,
	rerank,
} from "../compression/index.js";

describe("LLMLinguaMiddleware", () => {
	it("halves a ~4000-token block at targetRatio 0.5", () => {
		// ~4000 tokens ≈ 16_000 chars of alpha+spaces
		const words: string[] = [];
		for (let i = 0; i < 3200; i++) words.push(`word${i}`);
		const block = words.join(" ");
		const m = new LLMLinguaMiddleware();
		const r = m.compress(block, { targetRatio: 0.5, activationThreshold: 100 });
		expect(r.compressed).toBe(true);
		expect(r.estimatedOutputTokens).toBeLessThan(r.estimatedInputTokens);
		// ±10% tolerance around 0.5 ratio
		const ratio = r.estimatedOutputTokens / r.estimatedInputTokens;
		expect(ratio).toBeGreaterThan(0.4);
		expect(ratio).toBeLessThan(0.6);
	});

	it("passes through blocks below activation threshold", () => {
		const m = new LLMLinguaMiddleware();
		const r = m.compress("small", { targetRatio: 0.5, activationThreshold: 100 });
		expect(r.compressed).toBe(false);
		expect(r.via).toBe("passthrough");
		expect(r.bytes).toBe("small");
	});

	it("runs without spawning a Python process (sync, pure JS)", () => {
		const m = new LLMLinguaMiddleware();
		const r = m.compress("hello world ".repeat(500), {
			targetRatio: 0.5,
			activationThreshold: 100,
		});
		expect(r.compressed).toBe(true);
		expect(typeof r.bytes).toBe("string");
	});

	it("is deterministic: same input returns same output across 100 runs", () => {
		const m = new LLMLinguaMiddleware();
		const input = "lorem ipsum dolor sit amet ".repeat(200);
		const first = m.compress(input, { targetRatio: 0.5, activationThreshold: 100 }).bytes;
		for (let i = 0; i < 100; i++) {
			const r = m.compress(input, { targetRatio: 0.5, activationThreshold: 100 });
			expect(r.bytes).toBe(first);
		}
	});

	it("deterministicCompress honors target ratio roughly", () => {
		const input = Array.from({ length: 100 }, (_, i) => `w${i}`).join(" ");
		const halved = deterministicCompress(input, 0.5);
		const quartered = deterministicCompress(input, 0.25);
		expect(halved.split(/\s+/).length).toBeLessThan(input.split(/\s+/).length);
		expect(quartered.split(/\s+/).length).toBeLessThan(halved.split(/\s+/).length);
	});
});

describe("ProvenceMiddleware / rerank", () => {
	const chunks = [
		"this chunk talks about cache policy and breakpoints",
		"unrelated paragraph about puppies",
		"more on cache breakpoints and token budgets",
		"random walk on a graph",
	];

	it("returns a pruned ordered list relevant to query", () => {
		const out = rerank({
			chunks,
			query: "cache breakpoints",
			keepRatio: 0.5,
			dropBelow: 0,
		});
		expect(out.kept.length).toBe(2);
		expect(out.kept[0].chunk).toContain("cache");
	});

	it("drops chunks below threshold", () => {
		const out = rerank({
			chunks,
			query: "puppies",
			keepRatio: 1.0,
			dropBelow: 0.5,
		});
		expect(out.kept.length).toBeLessThan(chunks.length);
		expect(out.kept[0].chunk).toContain("puppies");
	});

	it("same input returns same ordering (deterministic)", () => {
		const a = rerank({ chunks, query: "cache", keepRatio: 0.75, dropBelow: 0 });
		const b = rerank({ chunks, query: "cache", keepRatio: 0.75, dropBelow: 0 });
		expect(a.kept.map((k) => k.chunk)).toEqual(b.kept.map((k) => k.chunk));
	});

	it("Provence class wraps rerank()", () => {
		const p = new ProvenceMiddleware();
		const out = p.prune({ chunks, query: "cache", keepRatio: 0.5, dropBelow: 0 });
		expect(out.kept.length).toBe(2);
	});
});

describe("estimateTokens", () => {
	it("scales with input length", () => {
		expect(estimateTokens("")).toBe(0);
		expect(estimateTokens("hi")).toBe(1);
		expect(estimateTokens("a".repeat(400))).toBe(100);
	});
});
