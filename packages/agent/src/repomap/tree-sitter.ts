// T-032: web-tree-sitter wrapper — lazy init, graceful degradation.
//
// Loads WASM grammars from a configurable directory. If web-tree-sitter
// or any grammar fails to load, callers get `null` and fall back to regex.

import type { ParsedSymbol, RepoLanguage } from "./parser.js";

/* ------------------------------------------------------------------ */
/*  Types — we avoid importing web-tree-sitter at the top level so    */
/*  the module stays loadable even when the dep is missing.           */
/* ------------------------------------------------------------------ */

// biome-ignore lint/suspicious/noExplicitAny: dynamic import type
type WTSParser = any;
// biome-ignore lint/suspicious/noExplicitAny: dynamic import type
type WTSLanguage = any;
// biome-ignore lint/suspicious/noExplicitAny: dynamic import type
type WTSTreeCursor = any;

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

let ParserCtor: { new (): WTSParser; init: () => Promise<void>; Language: { load: (path: string) => Promise<WTSLanguage> } } | null = null;
let parser: WTSParser | null = null;
let initAttempted = false;
const loadedLanguages = new Map<string, WTSLanguage>();

/* ------------------------------------------------------------------ */
/*  Language → WASM filename mapping                                   */
/* ------------------------------------------------------------------ */

const LANG_WASM_NAME: Partial<Record<RepoLanguage, string>> = {
	ts: "typescript",
	js: "javascript",
	py: "python",
	go: "go",
	rs: "rust",
	java: "java",
	c: "c",
	cpp: "cpp",
};

/* ------------------------------------------------------------------ */
/*  Grammar directory — set before calling init()                      */
/* ------------------------------------------------------------------ */

let _grammarDir = "";

export function setGrammarDir(dir: string): void {
	_grammarDir = dir;
}

export function getGrammarDir(): string {
	return _grammarDir;
}

/* ------------------------------------------------------------------ */
/*  Lazy initialisation                                                */
/* ------------------------------------------------------------------ */

export async function init(): Promise<boolean> {
	if (initAttempted) return parser !== null;
	initAttempted = true;
	try {
		const mod = await import("web-tree-sitter");
		ParserCtor = mod.default;
		await ParserCtor!.init();
		parser = new ParserCtor!();
		return true;
	} catch {
		parser = null;
		return false;
	}
}

export function isAvailable(): boolean {
	return parser !== null;
}

/** Reset internal state — useful for tests. */
export function _reset(): void {
	parser = null;
	ParserCtor = null;
	initAttempted = false;
	loadedLanguages.clear();
	_grammarDir = "";
}

/* ------------------------------------------------------------------ */
/*  Language loading                                                    */
/* ------------------------------------------------------------------ */

async function loadLanguage(lang: RepoLanguage): Promise<WTSLanguage | null> {
	const name = LANG_WASM_NAME[lang];
	if (!name || !ParserCtor || !_grammarDir) return null;
	if (loadedLanguages.has(name)) return loadedLanguages.get(name);
	try {
		const { join } = await import("node:path");
		const wasmPath = join(_grammarDir, `tree-sitter-${name}.wasm`);
		const language = await ParserCtor.Language.load(wasmPath);
		loadedLanguages.set(name, language);
		return language;
	} catch {
		return null;
	}
}

/* ------------------------------------------------------------------ */
/*  AST node type → ParsedSymbol kind                                  */
/* ------------------------------------------------------------------ */

const KIND_MAP: Record<string, ParsedSymbol["kind"]> = {
	// TypeScript / JavaScript
	function_declaration: "function",
	generator_function_declaration: "function",
	method_definition: "function",
	method_signature: "function",
	// Python
	function_definition: "function",
	// Go
	function_declaration_go: "function", // alias — real node is function_declaration
	method_declaration: "function",
	// Rust
	function_item: "function",
	// Java
	method_declaration_java: "function", // alias — real node is method_declaration
	constructor_declaration: "function",
	// C / C++
	function_definition_c: "function", // alias — real node is function_definition

	// Classes / structs
	class_declaration: "class",
	class_definition: "class",
	struct_item: "class",
	enum_item: "class",
	trait_item: "class",
	impl_item: "class",
	enum_declaration: "class",
	struct_specifier: "class",
	class_specifier: "class",

	// Types
	interface_declaration: "type",
	type_alias_declaration: "type",
	type_declaration: "type",

	// Constants
	lexical_declaration: "const",
	variable_declaration: "const",
};

/* ------------------------------------------------------------------ */
/*  Symbol extraction via tree-sitter AST walk                         */
/* ------------------------------------------------------------------ */

export async function extractSymbols(
	file: string,
	source: string,
	lang: RepoLanguage,
): Promise<ParsedSymbol[] | null> {
	if (!parser) return null;
	const language = await loadLanguage(lang);
	if (!language) return null;

	parser.setLanguage(language);
	const tree = parser.parse(source);
	const symbols: ParsedSymbol[] = [];
	const cursor: WTSTreeCursor = tree.walk();

	function visit(): void {
		const node = cursor.currentNode;
		const kind = KIND_MAP[node.type];
		if (kind) {
			const nameNode = node.childForFieldName("name");
			if (nameNode) {
				// Build a one-line signature capped at 200 chars
				const startIdx: number = node.startIndex;
				const nextNewline = source.indexOf("\n", startIdx);
				const endIdx =
					nextNewline !== -1
						? Math.min(startIdx + 200, nextNewline)
						: Math.min(startIdx + 200, source.length);
				const signature = source.slice(startIdx, endIdx).trim();

				symbols.push({
					file,
					line: (node.startPosition.row as number) + 1,
					kind,
					name: nameNode.text as string,
					signature,
				});
			}
		}
		if (cursor.gotoFirstChild()) {
			do {
				visit();
			} while (cursor.gotoNextSibling());
			cursor.gotoParent();
		}
	}

	visit();
	tree.delete();
	return symbols;
}
