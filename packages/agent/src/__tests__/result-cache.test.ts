// T-028, T-029, T-030, T-031
import { describe, expect, it } from "vitest";
import { ToolResultCache, keyHash, normalizeToolOutput } from "../tools/result-cache.js";

describe("ToolResultCache", () => {
	const fp = { gitSha: "abc", mtime: 100, size: 42 };

	it("two identical reads produce one write, one hit", () => {
		const c = new ToolResultCache();
		const key = { sessionId: "s1", tool: "read", args: { path: "f" }, fingerprint: fp };
		expect(c.get(key)).toBeUndefined();
		c.put(key, "contents");
		const second = c.get(key);
		expect(second?.bytes).toBe("contents");
		expect(c.size()).toBe(1);
	});

	it("semantic-equivalent arg ordering hits same entry", () => {
		const c = new ToolResultCache();
		const key1 = {
			sessionId: "s1",
			tool: "read",
			args: { a: 1, b: 2 },
			fingerprint: fp,
		};
		const key2 = {
			sessionId: "s1",
			tool: "read",
			args: { b: 2, a: 1 },
			fingerprint: fp,
		};
		c.put(key1, "content");
		expect(c.get(key2)?.bytes).toBe("content");
	});

	it("fingerprint change causes miss", () => {
		const c = new ToolResultCache();
		const key = { sessionId: "s1", tool: "read", args: {}, fingerprint: fp };
		c.put(key, "old");
		const newKey = { ...key, fingerprint: { ...fp, mtime: 200 } };
		expect(c.get(newKey)).toBeUndefined();
	});

	it("two sessions do not share entries", () => {
		const c = new ToolResultCache();
		const a = { sessionId: "s1", tool: "read", args: {}, fingerprint: fp };
		const b = { sessionId: "s2", tool: "read", args: {}, fingerprint: fp };
		c.put(a, "A");
		expect(c.get(b)).toBeUndefined();
		expect(c.get(a)?.bytes).toBe("A");
	});

	it("bypassed tools are never cached", () => {
		const c = new ToolResultCache(["bash"]);
		const key = { sessionId: "s", tool: "bash", args: { cmd: "ls" }, fingerprint: fp };
		c.put(key, "output");
		expect(c.get(key)).toBeUndefined();
		expect(c.size()).toBe(0);
	});

	it("keyHash is deterministic", () => {
		const key = { sessionId: "s", tool: "read", args: { x: 1 }, fingerprint: fp };
		expect(keyHash(key)).toBe(keyHash(key));
	});
});

describe("normalizeToolOutput", () => {
	it("strips ANSI escapes", () => {
		const input = "\u001B[31mred\u001B[0m plain";
		expect(normalizeToolOutput(input, "")).toBe("red plain");
	});

	it("rewrites absolute workdir path to .", () => {
		const input = "error in /Users/alice/proj/src/file.ts at line 10";
		expect(normalizeToolOutput(input, "/Users/alice/proj")).toBe(
			"error in ./src/file.ts at line 10",
		);
	});

	it("redacts ISO timestamps", () => {
		const input = "logged at 2025-03-15T12:34:56Z";
		expect(normalizeToolOutput(input, "")).toBe("logged at <ts>");
	});

	it("same-file reads at different times are byte-identical after normalize", () => {
		const a = "2025-03-15T12:00:00Z /Users/a/proj/f.ts line 1";
		const b = "2025-08-01T03:00:00Z /Users/a/proj/f.ts line 1";
		expect(normalizeToolOutput(a, "/Users/a/proj")).toBe(
			normalizeToolOutput(b, "/Users/a/proj"),
		);
	});

	it("normalizes CRLF to LF and strips trailing whitespace", () => {
		const input = "line1   \r\nline2\r\n";
		expect(normalizeToolOutput(input, "")).toBe("line1\nline2\n");
	});
});
