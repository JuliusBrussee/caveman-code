// T-118..T-130
import { describe, expect, it } from "vitest";
import {
	applyReview,
	batchDecisions,
} from "../review/hunk-review.js";
import {
	canRetryReflexion,
	clampSummaryToTokenLimit,
	incrementReflexion,
	localize,
	localizerFeed,
	runSubagentWithBudget,
	verifyBestOfN,
	type Candidate,
} from "../localizer/index.js";
import { parseFile, buildSymbolGraph, pagerank } from "../repomap/index.js";

const src = `function cachePolicy() { return "long"; }
function routerRoute() { return "plan"; }
function unrelated() {}
`;
const parsed = parseFile("src/cache.ts", src);
const graph = buildSymbolGraph([parsed], new Map([["src/cache.ts", src]]));
const ranked = pagerank(graph);

describe("hunk review (T-118, T-119)", () => {
	const payload = {
		file: "a.ts",
		hunks: [
			{ before: "old one", after: "new one", lineRange: [1, 1] as [number, number] },
			{ before: "old two", after: "new two", lineRange: [3, 3] as [number, number] },
		],
	};

	it("auto-accept applies all hunks", () => {
		const src = "old one\nplain middle\nold two\n";
		const decisions = batchDecisions("auto-accept", 2);
		const r = applyReview(src, payload, decisions);
		expect(r.applied).toHaveLength(2);
		expect(r.finalContent).toContain("new one");
		expect(r.finalContent).toContain("new two");
	});

	it("rejected hunks leave the corresponding region byte-identical", () => {
		const src = "old one\nplain middle\nold two\n";
		const decisions = batchDecisions("review-each", 2, [false, false]);
		const r = applyReview(src, payload, decisions);
		expect(r.applied).toHaveLength(0);
		expect(r.finalContent).toBe(src);
	});

	it("review-each supports per-hunk decisions", () => {
		const src = "old one\nplain middle\nold two\n";
		const decisions = batchDecisions("review-each", 2, [true, false]);
		const r = applyReview(src, payload, decisions);
		expect(r.applied).toHaveLength(1);
		expect(r.finalContent).toContain("new one");
		expect(r.finalContent).toContain("old two");
	});

	it("throws on mismatched decision count", () => {
		expect(() => applyReview("x", payload, [{ accept: true }])).toThrow(/decision count/);
	});
});

describe("localizer (T-120, T-121)", () => {
	it("fixture bug location in top-K", () => {
		const result = localize({ ranked, query: "cache policy", topK: 2 });
		expect(result.length).toBeLessThanOrEqual(2);
		expect(result[0].symbol).toBe("cachePolicy");
	});

	it("output contains file/symbol/line_range/confidence", () => {
		const [first] = localize({ ranked, query: "router", topK: 1 });
		expect(first.file).toBeDefined();
		expect(first.symbol).toBeDefined();
		expect(first.lineRange.length).toBe(2);
		expect(first.confidence).toBeGreaterThanOrEqual(0);
	});

	it("deterministic across runs", () => {
		const a = localize({ ranked, query: "router", topK: 3 });
		const b = localize({ ranked, query: "router", topK: 3 });
		expect(a.map((c) => c.symbol)).toEqual(b.map((c) => c.symbol));
	});

	it("localizerFeed produces a stable block in replace mode", () => {
		const candidates = localize({ ranked, query: "cache", topK: 2 });
		const block = localizerFeed(candidates, { mode: "replace" });
		expect(block).toContain("replace");
		expect(block).toContain("cachePolicy");
	});

	it("localizerFeed empty string in off mode", () => {
		expect(localizerFeed([], { mode: "off" })).toBe("");
	});
});

describe("verifier best-of-N (T-126..T-128)", () => {
	const c1: Candidate = { id: "c1", diff: "d1", patchedSource: "", diffSize: 5 };
	const c2: Candidate = { id: "c2", diff: "d2", patchedSource: "", diffSize: 3 };
	const c3: Candidate = { id: "c3", diff: "d3", patchedSource: "", diffSize: 10 };

	it("N=3 produces three attempts", () => {
		const o = verifyBestOfN([c1, c2, c3], {
			n: 3,
			maxReflexionDepth: 2,
			runTest: () => true,
		});
		expect(o.attempts).toBe(3);
		expect(o.passed).toHaveLength(3);
	});

	it("default N=1 only tests the first candidate", () => {
		const o = verifyBestOfN([c1, c2, c3], {
			n: 1,
			maxReflexionDepth: 2,
			runTest: () => true,
		});
		expect(o.attempts).toBe(1);
	});

	it("winner is passing candidate with smallest diff", () => {
		const o = verifyBestOfN([c1, c2, c3], {
			n: 3,
			maxReflexionDepth: 2,
			runTest: () => true,
		});
		expect(o.winner?.id).toBe("c2");
	});

	it("tie-break by smallest-diff deterministic key", () => {
		const equal: Candidate[] = [
			{ id: "zeta", diff: "z", patchedSource: "", diffSize: 4 },
			{ id: "alpha", diff: "a", patchedSource: "", diffSize: 4 },
		];
		const o = verifyBestOfN(equal, {
			n: 2,
			maxReflexionDepth: 2,
			runTest: () => true,
		});
		expect(o.winner?.id).toBe("alpha");
	});

	it("returns no_candidate_passes when all fail", () => {
		const o = verifyBestOfN([c1], {
			n: 1,
			maxReflexionDepth: 2,
			runTest: () => false,
		});
		expect(o.verdict).toBe("no_candidate_passes");
		expect(o.winner).toBeNull();
	});
});

describe("reflexion depth (T-130)", () => {
	it("allows retry at depth 0 and 1", () => {
		expect(canRetryReflexion({ depth: 0, roleTag: "plan" })).toBe(true);
		expect(canRetryReflexion({ depth: 1, roleTag: "plan" })).toBe(true);
	});

	it("rejects retry at depth 2", () => {
		expect(canRetryReflexion({ depth: 2, roleTag: "plan" })).toBe(false);
	});

	it("incrementReflexion throws past max depth", () => {
		const s = { depth: 2, roleTag: "plan" };
		expect(() => incrementReflexion(s)).toThrow(/max depth/);
	});

	it("retry carries same role tag", () => {
		const s = { depth: 0, roleTag: "edit" };
		const next = incrementReflexion(s);
		expect(next.roleTag).toBe("edit");
	});
});

describe("subagent budget (T-122, T-123, T-124)", () => {
	it("returns ok with summary ≤500 tokens when under budget", () => {
		const r = runSubagentWithBudget(
			["short history block"],
			{ maxInputTokens: 1000 },
			(h) => `ran on ${h.length} turns`,
		);
		expect(r.verdict).toBe("ok");
		expect(r.summary.length).toBeLessThanOrEqual(500 * 4);
	});

	it("terminates with budget_exceeded verdict when over", () => {
		const bigHistory = ["x".repeat(40_000)];
		const r = runSubagentWithBudget(bigHistory, { maxInputTokens: 100 }, () => "v");
		expect(r.verdict).toBe("budget_exceeded");
	});

	it("clampSummaryToTokenLimit truncates with ellipsis", () => {
		const huge = "a".repeat(10_000);
		const out = clampSummaryToTokenLimit(huge, 100); // max 400 chars
		expect(out.length).toBeLessThanOrEqual(400);
		expect(out.endsWith("…")).toBe(true);
	});
});
