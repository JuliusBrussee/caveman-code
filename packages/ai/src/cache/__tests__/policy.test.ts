import { describe, expect, it } from "vitest";
import {
	usageToCacheReport,
	totalInputTokens,
	resolveRetention,
	validateLayers,
	defaultPolicy,
} from "../policy.js";

describe("usageToCacheReport", () => {
	it("converts Usage to CacheUsageReport", () => {
		const report = usageToCacheReport({
			input: 500,
			output: 200,
			cacheRead: 300,
			cacheWrite: 100,
			totalTokens: 1100,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
		expect(report.cachedInputTokens).toBe(300);
		expect(report.cacheWriteTokens).toBe(100);
		expect(report.uncachedInputTokens).toBe(500);
		expect(totalInputTokens(report)).toBe(800);
	});

	it("clamps negative input to zero", () => {
		const report = usageToCacheReport({
			input: -10,
			output: 50,
			cacheRead: 100,
			cacheWrite: 0,
			totalTokens: 140,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
		expect(report.uncachedInputTokens).toBe(0);
	});

	it("handles zero-cache usage (e.g. Mistral)", () => {
		const report = usageToCacheReport({
			input: 1000,
			output: 200,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 1200,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
		expect(report.cachedInputTokens).toBe(0);
		expect(report.cacheWriteTokens).toBe(0);
		expect(report.uncachedInputTokens).toBe(1000);
		expect(totalInputTokens(report)).toBe(1000);
	});
});

describe("resolveRetention", () => {
	it("returns cliFlag when present", () => {
		expect(resolveRetention({ roleDefault: "short", cliFlag: "long" })).toBe("long");
	});

	it("returns cavekitPhaseOverride when no cliFlag", () => {
		expect(resolveRetention({ roleDefault: "short", cavekitPhaseOverride: "none" })).toBe("none");
	});

	it("returns roleDefault as fallback", () => {
		expect(resolveRetention({ roleDefault: "long" })).toBe("long");
	});
});

describe("validateLayers", () => {
	it("accepts valid layers in canonical order", () => {
		expect(() =>
			validateLayers([
				{ layer: "tools", bytes: "t" },
				{ layer: "system", bytes: "s" },
			]),
		).not.toThrow();
	});

	it("rejects duplicate layers", () => {
		expect(() =>
			validateLayers([
				{ layer: "tools", bytes: "a" },
				{ layer: "tools", bytes: "b" },
			]),
		).toThrow(/duplicate layer/);
	});

	it("rejects out-of-order layers", () => {
		expect(() =>
			validateLayers([
				{ layer: "system", bytes: "s" },
				{ layer: "tools", bytes: "t" },
			]),
		).toThrow(/out of canonical order/);
	});
});

describe("defaultPolicy", () => {
	it("returns short retention with no breakpoints", () => {
		const p = defaultPolicy();
		expect(p.retention).toBe("short");
		expect(p.supportsBreakpoints).toBe(false);
	});
});
