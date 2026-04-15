// T-032, T-033
import { describe, expect, it } from "vitest";
import {
	isSupported,
	languageFor,
	parseFile,
	SUPPORTED_LANGUAGES,
} from "../repomap/index.js";

describe("languageFor", () => {
	it("classifies each supported extension", () => {
		expect(languageFor("a.ts")).toBe("ts");
		expect(languageFor("a.tsx")).toBe("ts");
		expect(languageFor("a.js")).toBe("js");
		expect(languageFor("a.py")).toBe("py");
		expect(languageFor("a.go")).toBe("go");
		expect(languageFor("a.rs")).toBe("rs");
		expect(languageFor("a.java")).toBe("java");
		expect(languageFor("a.c")).toBe("c");
		expect(languageFor("a.cpp")).toBe("cpp");
	});

	it("returns unknown for unsupported extensions", () => {
		expect(languageFor("a.md")).toBe("unknown");
		expect(languageFor("Makefile")).toBe("unknown");
	});

	it("exposes 8 supported languages", () => {
		expect(SUPPORTED_LANGUAGES.length).toBe(8);
	});

	it("isSupported matches SUPPORTED_LANGUAGES", () => {
		expect(isSupported("ts")).toBe(true);
		expect(isSupported("unknown")).toBe(false);
	});
});

describe("parseFile", () => {
	it("extracts TypeScript function/class/type/const symbols", () => {
		const source = `export function foo(x: number) {}\nclass Bar {}\ntype T = string;\nexport const k = 1;`;
		const parsed = parseFile("a.ts", source);
		expect(parsed.language).toBe("ts");
		expect(parsed.symbols.length).toBeGreaterThanOrEqual(4);
		const kinds = parsed.symbols.map((s) => s.kind).sort();
		expect(kinds).toContain("function");
		expect(kinds).toContain("class");
		expect(kinds).toContain("type");
		expect(kinds).toContain("const");
	});

	it("emits fallback entry for unsupported languages", () => {
		const parsed = parseFile("README.md", "line1\nline2\nline3");
		expect(parsed.language).toBe("unknown");
		expect(parsed.symbols).toEqual([]);
		expect(parsed.fallback?.lineCount).toBe(3);
	});

	it("extracts Python function and class", () => {
		const parsed = parseFile("a.py", "def foo():\n  pass\nclass Bar:\n  pass\n");
		expect(parsed.language).toBe("py");
		expect(parsed.symbols.map((s) => s.name).sort()).toEqual(["Bar", "foo"]);
	});

	it("extracts Go function and type", () => {
		const parsed = parseFile(
			"a.go",
			"func main() {}\ntype Node struct{}\nconst Pi = 3.14\n",
		);
		expect(parsed.language).toBe("go");
		expect(parsed.symbols.length).toBeGreaterThanOrEqual(3);
	});

	it("extracts Rust fn, struct, trait, const", () => {
		const parsed = parseFile(
			"a.rs",
			"pub fn add() {}\nstruct S;\ntrait T {}\nconst K: i32 = 1;\n",
		);
		expect(parsed.language).toBe("rs");
		expect(parsed.symbols.length).toBeGreaterThanOrEqual(4);
	});

	it("records symbol file and line number", () => {
		const parsed = parseFile("a.ts", "// comment\nfunction foo() {}");
		expect(parsed.symbols[0].file).toBe("a.ts");
		expect(parsed.symbols[0].line).toBe(2);
	});

	it("new file contributes symbols deterministically", () => {
		const src = "function a(){}\nfunction b(){}";
		const p1 = parseFile("f.ts", src);
		const p2 = parseFile("f.ts", src);
		expect(p1.symbols.map((s) => s.name)).toEqual(p2.symbols.map((s) => s.name));
	});
});
