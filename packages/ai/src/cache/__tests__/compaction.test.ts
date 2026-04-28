// T-044..T-054
import { describe, expect, it } from "vitest";
import {
	type CacheRetention,
	type CacheUsageReport,
	resolveRetention,
	totalInputTokens,
} from "../policy.js";
import {
	KeepaliveScheduler,
	summarize,
	trimMiddle,
	type Turn,
} from "../compaction.js";

describe("cache usage report (T-044, T-046)", () => {
	it("exposes three token fields", () => {
		const u: CacheUsageReport = {
			cachedInputTokens: 100,
			cacheWriteTokens: 10,
			uncachedInputTokens: 50,
		};
		expect(u.cachedInputTokens).toBeDefined();
		expect(u.cacheWriteTokens).toBeDefined();
		expect(u.uncachedInputTokens).toBeDefined();
	});

	it("cached + uncached equals total input", () => {
		const u: CacheUsageReport = {
			cachedInputTokens: 300,
			cacheWriteTokens: 25,
			uncachedInputTokens: 200,
		};
		expect(totalInputTokens(u)).toBe(500);
	});
});

describe("resolveRetention (T-047, T-048, T-049)", () => {
	it("defaults to role default when no override", () => {
		expect(resolveRetention({ roleDefault: "long" })).toBe("long");
	});

	it("CLI flag overrides role default", () => {
		expect(
			resolveRetention({ roleDefault: "long", cliFlag: "none" }),
		).toBe("none");
	});
});

describe("trimMiddle (T-050, T-051, T-052)", () => {
	function mkTurns(n: number): Turn[] {
		return Array.from({ length: n }, (_, i) => ({
			index: i,
			bytes: `turn-${i}`,
		}));
	}

	it("drops 1..24, preserves 25..30 with N=5 recent floor (30-turn history)", () => {
		const turns = mkTurns(30);
		const result = trimMiddle(turns, { recentFloor: 5 });
		expect(result.kept.length).toBe(6); // summary + 5 recent
		// Last 5 kept
		const recent = result.kept.slice(1);
		expect(recent.map((t) => t.index)).toEqual([25, 26, 27, 28, 29]);
		// Dropped 25 turns
		expect(result.droppedCount).toBe(25);
	});

	it("produces deterministic stable summary block", () => {
		const turns = mkTurns(20);
		const a = trimMiddle(turns, { recentFloor: 5 }).summary;
		const b = trimMiddle(turns, { recentFloor: 5 }).summary;
		expect(a.bytes).toBe(b.bytes);
		expect(a.bytes).toContain("compact");
	});

	it("no-op when turns ≤ recentFloor + 1", () => {
		const turns = mkTurns(3);
		const result = trimMiddle(turns, { recentFloor: 5 });
		expect(result.droppedCount).toBe(0);
		expect(result.kept).toEqual(turns);
	});

	it("summarize includes dropped indices for auditability", () => {
		const s = summarize([
			{ index: 1, bytes: "a" },
			{ index: 2, bytes: "bb" },
		]);
		expect(s).toContain("[1,2]");
		expect(s).toContain("3 bytes");
	});
});

describe("KeepaliveScheduler (T-053, T-054)", () => {
	it("returns skip when retention=none", () => {
		const k = new KeepaliveScheduler();
		k.markActivity(0);
		expect(k.tick(10_000, { intervalMs: 5_000, retention: "none", enabled: true })).toBe("skip");
	});

	it("returns skip when disabled", () => {
		const k = new KeepaliveScheduler();
		k.markActivity(0);
		expect(k.tick(10_000, { intervalMs: 5_000, retention: "long", enabled: false })).toBe("skip");
	});

	it("returns ping after interval elapsed with retention=long", () => {
		const k = new KeepaliveScheduler();
		k.markActivity(0);
		expect(k.tick(5_000, { intervalMs: 5_000, retention: "long", enabled: true })).toBe("ping");
	});

	it("shuts off after idle 2x interval", () => {
		const k = new KeepaliveScheduler();
		k.markActivity(0);
		expect(k.tick(11_000, { intervalMs: 5_000, retention: "long", enabled: true })).toBe("shutoff");
	});

	it("default off: enabled=false skips even when interval passed", () => {
		const k = new KeepaliveScheduler();
		k.markActivity(0);
		const r = k.tick(10_000, { intervalMs: 5_000, retention: "long", enabled: false });
		expect(r).toBe("skip");
	});
});
