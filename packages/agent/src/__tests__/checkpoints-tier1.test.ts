// T-104..T-111
import { describe, expect, it } from "vitest";
import {
	buildPickerEntries,
	fuzzyFilter,
	PlanMode,
	rewindSession,
	selectGcCandidates,
	ShadowCheckpoints,
	sortByRecency,
	type CheckpointDirMetadata,
	type RewindAdapter,
	type SessionRow,
} from "../checkpoints/shadow-git.js";

function goodAdapter(): RewindAdapter {
	return {
		checkout: () => {},
		truncateJsonl: () => {},
		reconstructSummary: (id) => `summary for ${id}`,
	};
}

function failingAdapter(failOn: "checkout" | "truncate"): RewindAdapter {
	return {
		checkout: () => {
			if (failOn === "checkout") throw new Error("checkout failed");
		},
		truncateJsonl: () => {
			if (failOn === "truncate") throw new Error("truncate failed");
		},
		reconstructSummary: () => "",
	};
}

describe("rewindSession", () => {
	it("successful rewind returns summary + ok", () => {
		const cp = new ShadowCheckpoints("s1", "/home/u");
		cp.record("e-1", "write");
		cp.record("e-2", "edit");
		const r = rewindSession(cp, "e-1", goodAdapter());
		expect(r.status).toBe("ok");
		expect(r.summary).toContain("e-1");
	});

	it("nonexistent entry id returns not_found with no mutation", () => {
		const cp = new ShadowCheckpoints("s2", "/home/u");
		cp.record("e-1", "write");
		let checkoutCalled = false;
		const adapter: RewindAdapter = {
			checkout: () => {
				checkoutCalled = true;
			},
			truncateJsonl: () => {},
			reconstructSummary: () => "",
		};
		const r = rewindSession(cp, "e-missing", adapter);
		expect(r.status).toBe("not_found");
		expect(checkoutCalled).toBe(false);
	});

	it("truncation failure triggers rollback checkout", () => {
		const cp = new ShadowCheckpoints("s3", "/home/u");
		cp.record("e-1", "write");
		cp.record("e-2", "edit");
		const r = rewindSession(cp, "e-1", failingAdapter("truncate"));
		expect(r.status).toBe("rollback");
		expect(r.error).toMatch(/truncate failed/);
	});
});

describe("picker entries", () => {
	it("lists recent entries with summaries", () => {
		const cp = new ShadowCheckpoints("s", "/home/u");
		cp.record("e-1", "write");
		cp.record("e-2", "edit");
		const entries = buildPickerEntries(cp, (id) => `diff for ${id}`);
		expect(entries).toHaveLength(2);
		expect(entries[0].summary).toBe("diff for e-1");
	});
});

describe("cave resume picker", () => {
	const rows: SessionRow[] = [
		{
			sessionId: "s-a",
			lastActivity: "2026-04-10T10:00:00Z",
			messageCount: 5,
			title: "cache policy work",
			dollars: 0.12,
		},
		{
			sessionId: "s-b",
			lastActivity: "2026-04-16T08:00:00Z",
			messageCount: 20,
			title: "router determinism",
			dollars: 0.5,
		},
		{
			sessionId: "s-c",
			lastActivity: "2026-04-15T12:00:00Z",
			messageCount: 3,
			title: "repomap rendering",
			dollars: 0.03,
		},
	];

	it("sortByRecency orders newest first", () => {
		const sorted = sortByRecency(rows);
		expect(sorted.map((r) => r.sessionId)).toEqual(["s-b", "s-c", "s-a"]);
	});

	it("entries carry all four display fields", () => {
		for (const r of rows) {
			expect(r.sessionId).toBeDefined();
			expect(r.lastActivity).toBeDefined();
			expect(r.messageCount).toBeGreaterThanOrEqual(0);
			expect(r.title).toBeDefined();
		}
	});

	it("fuzzyFilter narrows on title substring", () => {
		const filtered = fuzzyFilter(rows, "router");
		expect(filtered).toHaveLength(1);
		expect(filtered[0].sessionId).toBe("s-b");
	});

	it("fuzzyFilter matches on session id", () => {
		expect(fuzzyFilter(rows, "s-a")).toHaveLength(1);
	});
});

describe("PlanMode", () => {
	it("blocks write/edit/bash when active", () => {
		const p = new PlanMode();
		p.enter();
		expect(p.isBlocked("write")).toBe(true);
		expect(p.isBlocked("edit")).toBe(true);
		expect(p.isBlocked("bash")).toBe(true);
		expect(p.isBlocked("apply_sr_diff")).toBe(true);
	});

	it("allows grep/read/find/ls when active", () => {
		const p = new PlanMode();
		p.enter();
		expect(p.isAllowed("read")).toBe(true);
		expect(p.isAllowed("grep")).toBe(true);
		expect(p.isAllowed("find")).toBe(true);
		expect(p.isAllowed("ls")).toBe(true);
	});

	it("inactive mode allows everything", () => {
		const p = new PlanMode();
		expect(p.isBlocked("write")).toBe(false);
		expect(p.isAllowed("write")).toBe(true);
	});

	it("persists across isActive checks until exit", () => {
		const p = new PlanMode();
		p.enter();
		expect(p.isActive()).toBe(true);
		expect(p.isActive()).toBe(true); // multiple queries do not exit
		p.exit();
		expect(p.isActive()).toBe(false);
	});
});

describe("checkpoint GC", () => {
	it("selects repos older than retention, excluding active session", () => {
		const now = Date.now();
		const day = 24 * 60 * 60 * 1000;
		const dirs: CheckpointDirMetadata[] = [
			{ sessionId: "s-old", lastModifiedMs: now - 40 * day },
			{ sessionId: "s-recent", lastModifiedMs: now - 5 * day },
			{ sessionId: "s-active", lastModifiedMs: now - 40 * day },
		];
		const candidates = selectGcCandidates(dirs, { retentionDays: 30, activeSessionId: "s-active" }, now);
		expect(candidates.map((c) => c.sessionId)).toEqual(["s-old"]);
	});

	it("retentionDays is configurable", () => {
		const now = Date.now();
		const day = 24 * 60 * 60 * 1000;
		const dirs: CheckpointDirMetadata[] = [
			{ sessionId: "s", lastModifiedMs: now - 10 * day },
		];
		expect(selectGcCandidates(dirs, { retentionDays: 7 }, now)).toHaveLength(1);
		expect(selectGcCandidates(dirs, { retentionDays: 30 }, now)).toHaveLength(0);
	});
});
