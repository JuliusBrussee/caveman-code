// T-083..T-092
import { describe, expect, it } from "vitest";
import {
	CostCapTracker,
	CostPanel,
	ProvenanceRegistry,
	renderTrace,
	replay,
	type TraceEvent,
} from "../cost/index.js";

describe("CostCapTracker", () => {
	it("fires cost_cap_turn when per-turn cap exceeded", () => {
		const events: unknown[] = [];
		const t = new CostCapTracker({ perTurnDollars: 0.1 });
		t.onEvent((e) => events.push(e));
		const cancel = t.recordIncremental({ turnIndex: 0, dollarsEstimated: 0.11 });
		expect(cancel).toBe(true);
		expect((events[0] as { type: string }).type).toBe("cost_cap_turn");
	});

	it("requires user confirmation on next turn after cap", () => {
		const t = new CostCapTracker({ perTurnDollars: 0.05 });
		t.recordIncremental({ turnIndex: 0, dollarsEstimated: 0.06 });
		expect(t.requiresConfirmation()).toBe(true);
		t.acknowledgeConfirmation();
		expect(t.requiresConfirmation()).toBe(false);
	});

	it("fires cost_cap_session when session cap exceeded", () => {
		const events: unknown[] = [];
		const t = new CostCapTracker({ perSessionDollars: 1.0 });
		t.onEvent((e) => events.push(e));
		t.recordIncremental({ turnIndex: 0, dollarsEstimated: 0.5 });
		t.recordIncremental({ turnIndex: 1, dollarsEstimated: 0.6 });
		expect(events.find((e) => (e as { type: string }).type === "cost_cap_session")).toBeDefined();
		expect(t.isSessionCapped()).toBe(true);
	});

	it("no cap means call streams to completion", () => {
		const t = new CostCapTracker();
		const cancel = t.recordIncremental({ turnIndex: 0, dollarsEstimated: 999 });
		expect(cancel).toBe(false);
	});
});

describe("CostPanel", () => {
	it("shows all five metrics", () => {
		const panel = new CostPanel();
		panel.record({
			sessionDollars: 1.23,
			inputTokens: 10000,
			cachedInputTokens: 6000,
			uncachedInputTokens: 4000,
			outputTokens: 500,
			cachedToolResults: 2,
		});
		const out = panel.render();
		expect(out).toContain("$1.2300 spent");
		expect(out).toContain("input: 10000");
		expect(out).toContain("output: 500");
		expect(out).toContain("tool cache hits: 2");
		expect(out).toContain("60.0%");
	});

	it("hit rate = cached / (cached + uncached)", () => {
		const panel = new CostPanel();
		panel.record({ cachedInputTokens: 750, uncachedInputTokens: 250 });
		expect(panel.snapshot().hitRate).toBeCloseTo(0.75);
	});

	it("updates as calls complete", () => {
		const panel = new CostPanel();
		panel.record({ sessionDollars: 0.5 });
		expect(panel.snapshot().sessionDollars).toBe(0.5);
		panel.record({ sessionDollars: 0.8 });
		expect(panel.snapshot().sessionDollars).toBe(0.8);
	});
});

describe("trace viewer", () => {
	const events: TraceEvent[] = [
		{ type: "llm_call", turn: 0, seq: 0, ts: 1, payload: { model: "opus", inputTokens: 10, outputTokens: 5, dollars: 0.01 } },
		{ type: "tool_call", turn: 0, seq: 1, ts: 2, payload: { tool: "read", cacheState: "miss" } },
		{ type: "tool_cache_hit", turn: 0, seq: 2, ts: 3, payload: { tool: "read", cacheState: "hit" } },
		{ type: "llm_call", turn: 1, seq: 3, ts: 4, payload: { model: "sonnet", inputTokens: 20, outputTokens: 3, dollars: 0.002 } },
	];

	it("renders events in timestamp order", () => {
		const out = renderTrace(events);
		const lines = out.split("\n");
		expect(lines[0]).toContain("opus");
		expect(lines[3]).toContain("sonnet");
	});

	it("filter shows only given type", () => {
		const out = renderTrace(events, { filter: "llm_call" });
		const lines = out.split("\n");
		expect(lines.length).toBe(2);
		for (const l of lines) expect(l).toContain("llm");
	});

	it("llm rows display model/tokens/dollars", () => {
		const out = renderTrace(events, { filter: "llm_call" });
		expect(out).toContain("in=10");
		expect(out).toContain("out=5");
		expect(out).toContain("$0.0100");
	});

	it("tool rows display cache hit/miss", () => {
		const out = renderTrace(events, { filter: "tool" });
		expect(out).toContain("cache=miss");
		expect(out).toContain("cache=hit");
	});
});

describe("replay", () => {
	const events: TraceEvent[] = [
		{ type: "llm_call", turn: 0, seq: 0, ts: 1, payload: { model: "opus" } },
		{ type: "tool_call", turn: 0, seq: 1, ts: 2, payload: { tool: "write" } },
		{ type: "llm_call", turn: 1, seq: 2, ts: 3, payload: { model: "opus" } },
		{ type: "tool_call", turn: 1, seq: 3, ts: 4, payload: { tool: "bash" } },
	];

	it("replay reproduces llm call sequence", () => {
		const seen: string[] = [];
		const res = replay(events, {
			dryRun: true,
			onLlmCall: (e) => seen.push((e.payload as { model: string }).model),
		});
		expect(res.llmCalls).toBe(2);
		expect(seen).toEqual(["opus", "opus"]);
	});

	it("without --apply no tool is executed", () => {
		const executed: string[] = [];
		const res = replay(events, {
			dryRun: true,
			onToolCall: (e) => executed.push((e.payload as { tool: string }).tool),
		});
		expect(res.toolCallsPlanned).toBe(2);
		expect(res.toolCallsExecuted).toBe(0);
		expect(executed).toEqual([]);
	});

	it("with --apply tool calls are dispatched", () => {
		const executed: string[] = [];
		const res = replay(events, {
			dryRun: false,
			onToolCall: (e) => executed.push((e.payload as { tool: string }).tool),
		});
		expect(res.toolCallsExecuted).toBe(2);
		expect(executed).toEqual(["write", "bash"]);
	});
});

describe("ProvenanceRegistry", () => {
	it("stamps memory entries with turn_index and source_message_ids", () => {
		const r = new ProvenanceRegistry();
		r.register("m-1");
		r.register("m-2");
		const entry = r.stamp("summary", 5, ["m-1", "m-2"]);
		expect(entry.provenance.turnIndex).toBe(5);
		expect(entry.provenance.sourceMessageIds).toEqual(["m-1", "m-2"]);
	});

	it("throws on unknown source message id (test-visible failure)", () => {
		const r = new ProvenanceRegistry();
		expect(() => r.stamp("x", 0, ["m-unknown"])).toThrow(/unknown source/);
	});

	it("all() returns registered entries", () => {
		const r = new ProvenanceRegistry();
		r.register("m-1");
		r.stamp("a", 0, ["m-1"]);
		r.stamp("b", 1, ["m-1"]);
		expect(r.all().length).toBe(2);
	});
});
