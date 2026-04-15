// T-038, T-039, T-040
import { describe, expect, it } from "vitest";
import { applySrDiff } from "../tools/apply-sr-diff.js";

describe("applySrDiff", () => {
	it("replaces exact single match", () => {
		const r = applySrDiff("hello world", "world", "cave");
		expect(r.status).toBe("ok");
		if (r.status === "ok") {
			expect(r.newContent).toBe("hello cave");
			expect(r.match.line).toBe(1);
		}
	});

	it("returns no_match when search string absent", () => {
		const r = applySrDiff("hello world", "absent", "x");
		expect(r.status).toBe("no_match");
		if (r.status === "no_match") expect(r.reason).toBe("no_match");
	});

	it("returns ambiguous with all matches when search appears multiple times", () => {
		const r = applySrDiff("foo bar foo baz foo", "foo", "X");
		expect(r.status).toBe("ambiguous");
		if (r.status === "ambiguous") {
			expect(r.reason).toBe("ambiguous");
			expect(r.matches.length).toBe(3);
			expect(r.matches[0].start).toBe(0);
		}
	});

	it("100-edit fixture: ≥95% apply success", () => {
		// SWE-bench-style: generate 100 unique file states with exactly one
		// unambiguous target and assert applySrDiff resolves them.
		let ok = 0;
		const total = 100;
		for (let i = 0; i < total; i++) {
			const content = `function f${i}() {\n  return ${i};\n}\nconst other = ${i + 1000};\n`;
			const search = `return ${i};`;
			const replace = `return ${i * 2};`;
			const result = applySrDiff(content, search, replace);
			if (result.status === "ok" && result.newContent.includes(`return ${i * 2};`)) {
				ok++;
			}
		}
		const rate = ok / total;
		expect(rate).toBeGreaterThanOrEqual(0.95);
		expect(ok).toBe(100); // in practice: all unambiguous
	});

	it("reports correct line number for multi-line matches", () => {
		const content = "line1\nline2\ntarget\nline4";
		const r = applySrDiff(content, "target", "hit");
		expect(r.status).toBe("ok");
		if (r.status === "ok") expect(r.match.line).toBe(3);
	});

	it("empty search returns no_match (safety)", () => {
		const r = applySrDiff("anything", "", "x");
		expect(r.status).toBe("no_match");
	});
});
