// T-032, T-033: tree-sitter parser layer interface + fallback.
//
// Real tree-sitter bindings land in the live integration. For Tier 0 we
// ship the parser-layer contract and language classification so
// downstream (symbol graph T-059, pagerank T-061) can build against a
// stable interface.

export type RepoLanguage =
	| "ts"
	| "js"
	| "py"
	| "go"
	| "rs"
	| "java"
	| "c"
	| "cpp"
	| "unknown";

export interface ParsedSymbol {
	file: string;
	line: number;
	kind: "function" | "class" | "type" | "const";
	name: string;
	signature: string;
}

export interface ParsedFile {
	file: string;
	language: RepoLanguage;
	symbols: ParsedSymbol[];
	/** Fallback entry: filename + line count only. */
	fallback?: { lineCount: number };
}

const EXT_MAP: Record<string, RepoLanguage> = {
	".ts": "ts",
	".tsx": "ts",
	".mts": "ts",
	".cts": "ts",
	".js": "js",
	".mjs": "js",
	".cjs": "js",
	".jsx": "js",
	".py": "py",
	".pyi": "py",
	".go": "go",
	".rs": "rs",
	".java": "java",
	".c": "c",
	".h": "c",
	".cc": "cpp",
	".cpp": "cpp",
	".cxx": "cpp",
	".hpp": "cpp",
	".hxx": "cpp",
};

export function languageFor(filename: string): RepoLanguage {
	const idx = filename.lastIndexOf(".");
	if (idx === -1) return "unknown";
	const ext = filename.slice(idx).toLowerCase();
	return EXT_MAP[ext] ?? "unknown";
}

export const SUPPORTED_LANGUAGES: readonly RepoLanguage[] = [
	"ts",
	"js",
	"py",
	"go",
	"rs",
	"java",
	"c",
	"cpp",
] as const;

export function isSupported(lang: RepoLanguage): boolean {
	return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

/** Placeholder parser: consumes source text and emits symbols using
 *  lightweight regex heuristics. Real tree-sitter will replace this
 *  module's impl without changing the interface. */
export function parseFile(file: string, source: string): ParsedFile {
	const language = languageFor(file);
	if (!isSupported(language)) {
		return {
			file,
			language,
			symbols: [],
			fallback: { lineCount: source.split("\n").length },
		};
	}
	const symbols = extractSymbols(file, source, language);
	return { file, language, symbols };
}

const PATTERNS: Partial<Record<RepoLanguage, RegExp>> = {
	ts: /^\s*(?:export\s+)?(?:async\s+)?(function|class|type|const)\s+(\w+)/gm,
	js: /^\s*(?:export\s+)?(?:async\s+)?(function|class|const)\s+(\w+)/gm,
	py: /^\s*(def|class)\s+(\w+)/gm,
	go: /^\s*(func|type|const)\s+(\w+)/gm,
	rs: /^\s*(?:pub\s+)?(fn|struct|enum|trait|type|const)\s+(\w+)/gm,
	java: /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:class|interface|enum)\s+(\w+)/gm,
	c: /^\s*(?:static\s+)?(?:\w+\s+)+(\w+)\s*\([^)]*\)\s*\{/gm,
	cpp: /^\s*(?:static\s+)?(?:\w+\s+)+(\w+)\s*\([^)]*\)\s*\{/gm,
};

function extractSymbols(file: string, source: string, language: RepoLanguage): ParsedSymbol[] {
	const pattern = PATTERNS[language];
	if (!pattern) return [];
	const symbols: ParsedSymbol[] = [];
	let match: RegExpExecArray | null;
	pattern.lastIndex = 0;
	while ((match = pattern.exec(source)) !== null) {
		const name = match[2] ?? match[1];
		const rawKind = match[1] ?? "function";
		const kind = mapKind(rawKind);
		const line = source.slice(0, match.index).split("\n").length;
		symbols.push({
			file,
			line,
			kind,
			name,
			signature: match[0].trim(),
		});
	}
	return symbols;
}

function mapKind(raw: string): ParsedSymbol["kind"] {
	switch (raw) {
		case "class":
		case "struct":
		case "interface":
		case "enum":
		case "trait":
			return "class";
		case "type":
			return "type";
		case "const":
			return "const";
		default:
			return "function";
	}
}

/* ------------------------------------------------------------------ */
/*  T-032: async parser — tree-sitter first, regex fallback            */
/* ------------------------------------------------------------------ */

import * as treeSitter from "./tree-sitter.js";
export { treeSitter };

/** Async parser: tries tree-sitter first, falls back to regex. */
export async function parseFileAsync(
	file: string,
	source: string,
): Promise<ParsedFile> {
	const language = languageFor(file);
	if (!isSupported(language)) {
		return {
			file,
			language,
			symbols: [],
			fallback: { lineCount: source.split("\n").length },
		};
	}
	if (treeSitter.isAvailable()) {
		const symbols = await treeSitter.extractSymbols(file, source, language);
		if (symbols) return { file, language, symbols };
	}
	// Fallback to regex heuristic
	return { file, language, symbols: extractSymbols(file, source, language) };
}
