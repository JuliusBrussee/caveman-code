// T-023, T-024, T-025
import { describe, expect, it } from "vitest";
import {
	isMutatingTool,
	JSONL_V3_COMPAT,
	ShadowCheckpoints,
	shadowRepoPath,
} from "../checkpoints/shadow-git.js";

describe("shadowRepoPath", () => {
	it("uses ~/.cave/checkpoints/<session>/.git", () => {
		const p = shadowRepoPath("sess-123", "/home/user");
		expect(p.dir).toBe("/home/user/.cave/checkpoints/sess-123");
		expect(p.gitDir).toBe("/home/user/.cave/checkpoints/sess-123/.git");
	});
});

describe("isMutatingTool", () => {
	it("classifies write/edit/bash as mutating", () => {
		expect(isMutatingTool("write")).toBe(true);
		expect(isMutatingTool("edit")).toBe(true);
		expect(isMutatingTool("apply_sr_diff")).toBe(true);
		expect(isMutatingTool("edit_symbol")).toBe(true);
		expect(isMutatingTool("bash")).toBe(true);
	});

	it("classifies read/grep/ls as non-mutating", () => {
		expect(isMutatingTool("read")).toBe(false);
		expect(isMutatingTool("grep")).toBe(false);
		expect(isMutatingTool("ls")).toBe(false);
	});
});

describe("ShadowCheckpoints", () => {
	it("records a commit for mutating tool call tagged to entry id", () => {
		const cp = new ShadowCheckpoints("sess-1", "/home/user");
		const entry = cp.record("e-42", "write");
		expect(entry).not.toBeNull();
		expect(entry?.entryId).toBe("e-42");
		expect(entry?.sessionId).toBe("sess-1");
		expect(entry?.commitSha).toMatch(/^[0-9a-f]{40}$/);
		expect(entry?.mutating).toBe(true);
	});

	it("produces no commit for non-mutating tool call", () => {
		const cp = new ShadowCheckpoints("sess-2", "/home/user");
		const entry = cp.record("e-1", "read");
		expect(entry).toBeNull();
		expect(cp.count()).toBe(0);
	});

	it("increments count per mutating call", () => {
		const cp = new ShadowCheckpoints("sess-3", "/home/user");
		cp.record("e-1", "write");
		cp.record("e-2", "edit");
		cp.record("e-3", "read");
		cp.record("e-4", "bash");
		expect(cp.count()).toBe(3);
	});

	it("repo path is correct per session", () => {
		const cp = new ShadowCheckpoints("s-abc", "/home/user");
		expect(cp.repoPath.gitDir).toBe("/home/user/.cave/checkpoints/s-abc/.git");
	});

	it("shadow repo dir is disjoint from session jsonl dir (v3 compat)", () => {
		expect(JSONL_V3_COMPAT.schemaVersion).toBe(3);
		expect(JSONL_V3_COMPAT.disjoint).toBe(true);
		expect(JSONL_V3_COMPAT.shadowRepoDir).not.toBe(JSONL_V3_COMPAT.sessionJsonlDir);
	});
});
