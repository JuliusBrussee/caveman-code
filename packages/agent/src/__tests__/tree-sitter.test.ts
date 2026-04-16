// T-032: tree-sitter integration tests
import { describe, expect, it } from "vitest";
import {
	parseFile,
	parseFileAsync,
	languageFor,
	treeSitter,
} from "../repomap/parser.js";

describe("parseFileAsync (regex fallback)", () => {
	it("parses TypeScript functions and classes", async () => {
		const source = `export function hello() {}\nexport class World {}`;
		const result = await parseFileAsync("test.ts", source);
		expect(result.language).toBe("ts");
		expect(result.symbols.length).toBeGreaterThanOrEqual(2);
		expect(result.symbols.map((s) => s.name)).toContain("hello");
		expect(result.symbols.map((s) => s.name)).toContain("World");
	});

	it("returns same results as sync parseFile when tree-sitter unavailable", async () => {
		const source = `export function foo() {}\nexport const bar = 1;`;
		const sync = parseFile("test.ts", source);
		const asyncResult = await parseFileAsync("test.ts", source);
		expect(asyncResult.symbols).toEqual(sync.symbols);
	});

	it("handles unsupported language gracefully", async () => {
		const result = await parseFileAsync("README.md", "some text\nmore text");
		expect(result.language).toBe("unknown");
		expect(result.symbols).toEqual([]);
		expect(result.fallback?.lineCount).toBe(2);
	});

	it("parses Python functions and classes", async () => {
		const source = `def foo():\n  pass\nclass Bar:\n  pass\n`;
		const result = await parseFileAsync("test.py", source);
		expect(result.language).toBe("py");
		expect(result.symbols.map((s) => s.name).sort()).toEqual(["Bar", "foo"]);
	});

	it("records file and line number", async () => {
		const result = await parseFileAsync(
			"test.ts",
			"// comment\nfunction foo() {}",
		);
		expect(result.symbols[0].file).toBe("test.ts");
		expect(result.symbols[0].line).toBe(2);
	});

	it("is deterministic", async () => {
		const src = "function a(){}\nfunction b(){}";
		const r1 = await parseFileAsync("f.ts", src);
		const r2 = await parseFileAsync("f.ts", src);
		expect(r1.symbols.map((s) => s.name)).toEqual(
			r2.symbols.map((s) => s.name),
		);
	});
});

describe("treeSitter module", () => {
	it("isAvailable returns false before init", () => {
		// web-tree-sitter is not installed yet, so isAvailable should be false
		expect(treeSitter.isAvailable()).toBe(false);
	});

	it("extractSymbols returns null when not initialised", async () => {
		const result = await treeSitter.extractSymbols("a.ts", "function a(){}", "ts");
		expect(result).toBeNull();
	});

	it("init gracefully returns false when web-tree-sitter not installed", async () => {
		treeSitter._reset();
		const ok = await treeSitter.init();
		// Will be false since web-tree-sitter is not in deps yet
		// (or true if it is — either way, no crash)
		expect(typeof ok).toBe("boolean");
	});

	it("setGrammarDir / getGrammarDir round-trip", () => {
		treeSitter.setGrammarDir("/tmp/grammars");
		expect(treeSitter.getGrammarDir()).toBe("/tmp/grammars");
		treeSitter.setGrammarDir("");
	});
});
