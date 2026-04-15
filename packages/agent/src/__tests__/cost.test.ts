// T-034, T-035, T-036, T-037
import { describe, expect, it } from "vitest";
import {
	createInMemoryTraceSink,
	DEFAULT_PRICING,
	PricingResolver,
	TraceEmitter,
} from "../cost/index.js";

describe("PricingResolver", () => {
	it("knows default claude-opus-4-6 pricing", () => {
		const r = new PricingResolver();
		const p = r.priceOf("claude-opus-4-6");
		expect(p?.inputPerMillion).toBe(15.0);
		expect(p?.outputPerMillion).toBe(75.0);
	});

	it("estimateDollars computes from tokens", () => {
		const r = new PricingResolver();
		// 1M input + 500K output on opus = 15 + 37.5 = 52.5
		const dollars = r.estimateDollars("claude-opus-4-6", 1_000_000, 0, 0, 500_000);
		expect(dollars).toBeCloseTo(52.5, 6);
	});

	it("override changes next estimate", () => {
		const r = new PricingResolver();
		const before = r.estimateDollars("claude-opus-4-6", 1_000_000, 0, 0, 0);
		r.override("claude-opus-4-6", {
			inputPerMillion: 30.0,
			cachedInputPerMillion: 3.0,
			cacheWritePerMillion: 37.5,
			outputPerMillion: 150.0,
		});
		const after = r.estimateDollars("claude-opus-4-6", 1_000_000, 0, 0, 0);
		expect(after).toBe(before * 2);
	});

	it("unknown model returns 0 dollars (gracefully)", () => {
		const r = new PricingResolver();
		expect(r.estimateDollars("unknown", 1000, 0, 0, 0)).toBe(0);
	});

	it("DEFAULT_PRICING exposes haiku/sonnet/opus", () => {
		expect(DEFAULT_PRICING["claude-haiku-4-5"]).toBeDefined();
		expect(DEFAULT_PRICING["claude-sonnet-4-6"]).toBeDefined();
		expect(DEFAULT_PRICING["claude-opus-4-6"]).toBeDefined();
	});
});

describe("trace writer", () => {
	it("writes one event per line with type field", () => {
		const sink = createInMemoryTraceSink("session.trace.jsonl");
		const e = new TraceEmitter(sink);
		e.emit("llm_call", 0, { model: "opus" });
		e.emit("tool_call", 0, { tool: "read" });
		const lines = sink.snapshot();
		expect(lines).toHaveLength(2);
		for (const line of lines) {
			const obj = JSON.parse(line);
			expect(obj.type).toBeDefined();
		}
	});

	it("produces monotonically increasing seq values", () => {
		const sink = createInMemoryTraceSink("s");
		const e = new TraceEmitter(sink);
		for (let i = 0; i < 5; i++) e.emit("llm_call", i, {});
		const seqs = sink.snapshot().map((l) => JSON.parse(l).seq as number);
		expect(seqs).toEqual([0, 1, 2, 3, 4]);
	});

	it("rotates when size threshold crossed, preserving prior bytes", () => {
		const sink = createInMemoryTraceSink("s", 100); // tiny threshold
		const e = new TraceEmitter(sink);
		for (let i = 0; i < 20; i++) {
			e.emit("llm_call", i, { payload: "xxxxxxxxxxxxxxxxxxxx" });
		}
		expect(sink.rotations()).toBeGreaterThan(0);
		const files = sink.files();
		const fileKeys = Object.keys(files);
		expect(fileKeys.length).toBeGreaterThan(1);
		const totalLines = Object.values(files).reduce((a, b) => a + b.length, 0);
		expect(totalLines).toBe(20);
	});

	it("never rewrites an event in place (snapshot returns all)", () => {
		const sink = createInMemoryTraceSink("s");
		const e = new TraceEmitter(sink);
		const ev1 = e.emit("llm_call", 0, { v: 1 });
		e.emit("llm_call", 1, { v: 2 });
		const snap = sink.snapshot();
		const first = JSON.parse(snap[0]);
		expect(first.seq).toBe(ev1.seq);
		expect(first.payload).toEqual({ v: 1 });
	});
});
