// T-132..T-137
import { describe, expect, it } from "vitest";
import {
	aggregateBench,
	buildTokensVsResolvedSpec,
	requireTwoComparisonSystems,
	runBench,
	type BenchInstance,
	type SystemDatapoint,
} from "../bench/index.js";

const instances: BenchInstance[] = [
	{ id: "i1", repo: "a/b", base_commit: "abc", problem_statement: "bug 1" },
	{ id: "i2", repo: "a/b", base_commit: "def", problem_statement: "bug 2" },
	{ id: "i3", repo: "c/d", base_commit: "ghi", problem_statement: "bug 3" },
];

describe("runBench (T-132, T-133)", () => {
	it("returns per-instance result JSON with resolved/dollars/duration", async () => {
		const results = await runBench(instances, {
			perInstanceCapDollars: 5.0,
			runInstance: async (inst) => ({
				resolved: inst.id !== "i3",
				attempts: 1,
				dollarsSpent: 0.5,
				durationMs: 1000,
				traces: [],
			}),
		});
		expect(results).toHaveLength(3);
		expect(results[0].instance_id).toBe("i1");
		expect(results[0].resolved).toBe(true);
		expect(results[2].resolved).toBe(false);
	});

	it("flags cost_cap_failure when instance exceeds cap", async () => {
		const results = await runBench(instances.slice(0, 1), {
			perInstanceCapDollars: 1.0,
			runInstance: async () => ({
				resolved: false,
				attempts: 1,
				dollarsSpent: 7.5,
				durationMs: 500,
				traces: [],
			}),
		});
		expect(results[0].cost_cap_failure).toBe(true);
	});

	it("two runs produce same aggregate score (determinism via stub)", async () => {
		const opts = {
			perInstanceCapDollars: 5.0,
			runInstance: async (inst: BenchInstance) => ({
				resolved: inst.id === "i1",
				attempts: 1,
				dollarsSpent: 0.1,
				durationMs: 100,
				traces: [],
			}),
		};
		const a = aggregateBench(await runBench(instances, opts));
		const b = aggregateBench(await runBench(instances, opts));
		expect(a.resolvedRate).toBe(b.resolvedRate);
	});

	it("aggregate ≤ cap × instance count", async () => {
		const results = await runBench(instances, {
			perInstanceCapDollars: 2.0,
			runInstance: async () => ({
				resolved: false,
				attempts: 1,
				dollarsSpent: 1.5,
				durationMs: 100,
				traces: [],
			}),
		});
		const agg = aggregateBench(results);
		expect(agg.dollarsTotal).toBeLessThanOrEqual(2.0 * instances.length);
	});
});

describe("plot builder (T-136, T-137)", () => {
	const systems: SystemDatapoint[] = [
		{ name: "cave", inputTokensTotal: 100_000, outputTokensTotal: 10_000, resolvedCount: 30, totalInstances: 50 },
		{ name: "baseline", inputTokensTotal: 300_000, outputTokensTotal: 20_000, resolvedCount: 28, totalInstances: 50 },
	];

	it("produces a tokens-vs-resolved plot spec", () => {
		const spec = buildTokensVsResolvedSpec(systems);
		expect(spec.title).toContain("Tokens");
		expect(spec.series[0].points).toHaveLength(2);
		expect(spec.series[0].points[0].y).toBe(0.6); // 30/50
	});

	it("deterministically regenerates the same spec", () => {
		const a = buildTokensVsResolvedSpec(systems);
		const b = buildTokensVsResolvedSpec(systems);
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
	});

	it("requires at least two comparison systems", () => {
		expect(() => requireTwoComparisonSystems(systems)).not.toThrow();
		expect(() => requireTwoComparisonSystems(systems.slice(0, 1))).toThrow(/≥2/);
	});
});
