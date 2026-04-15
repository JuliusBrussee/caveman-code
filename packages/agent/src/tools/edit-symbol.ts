// T-095..T-100: edit_symbol via AST traversal (regex heuristic + language guard).
//
// Real tree-sitter AST traversal will replace the heuristic without
// changing the interface. The contract:
// - Preserve signature line; only replace body
// - Return unsupported_language for files outside the top-8
// - Return ambiguous { candidates } when the qualified name matches multiple symbols
// - Atomic: parse failure rolls back; successful write is temp+rename

import { isSupported, languageFor, parseFile } from "../repomap/parser.js";

export type EditSymbolStatus = "ok" | "unsupported_language" | "ambiguous" | "not_found" | "parse_error";

export interface EditSymbolMatch {
	file: string;
	name: string;
	line: number;
	signature: string;
}

export interface EditSymbolOk {
	status: "ok";
	newContent: string;
	match: EditSymbolMatch;
	hunk: { beforeLine: number; afterLine: number; lineRange: [number, number] };
}

export interface EditSymbolAmbiguous {
	status: "ambiguous";
	reason: "ambiguous";
	candidates: EditSymbolMatch[];
}

export interface EditSymbolNotFound {
	status: "not_found";
	reason: "not_found";
}

export interface EditSymbolUnsupported {
	status: "unsupported_language";
	reason: "unsupported_language";
	language: string;
}

export interface EditSymbolParseError {
	status: "parse_error";
	reason: "parse_error";
	diagnostic: string;
}

export type EditSymbolResult =
	| EditSymbolOk
	| EditSymbolAmbiguous
	| EditSymbolNotFound
	| EditSymbolUnsupported
	| EditSymbolParseError;

function lineRange(source: string, startLine: number, endLine: number): [number, number] {
	return [startLine, endLine];
}

/** Find a symbol's body range by matching signature line + brace balancing. */
function findSymbolRange(
	source: string,
	name: string,
): { startLine: number; endLine: number; startOffset: number; endOffset: number; signature: string }[] {
	const lines = source.split("\n");
	const results: ReturnType<typeof findSymbolRange> = [];
	const sigRe = new RegExp(
		`(?:^|\\s)(?:function|class|struct|trait|interface|enum|def|func|fn|const|type)\\s+${name}\\b`,
	);
	for (let i = 0; i < lines.length; i++) {
		if (sigRe.test(lines[i])) {
			const openIdx = lines[i].indexOf("{");
			if (openIdx === -1 && !lines[i].includes("=")) {
				// Python/Go def-style: use indent-based body or single statement
				continue;
			}
			// Brace-balance forward
			let depth = openIdx === -1 ? 0 : 1;
			let startOffset = lineStart(source, i);
			let endLine = i;
			let endOffset = source.length;
			if (openIdx !== -1) {
				let idx = lineStart(source, i) + openIdx + 1;
				for (; idx < source.length; idx++) {
					const ch = source[idx];
					if (ch === "{") depth++;
					else if (ch === "}") {
						depth--;
						if (depth === 0) {
							endOffset = idx + 1;
							endLine = offsetLine(source, idx);
							break;
						}
					}
				}
			}
			results.push({
				startLine: i + 1,
				endLine: endLine + 1,
				startOffset,
				endOffset,
				signature: lines[i].trim(),
			});
		}
	}
	return results;
}

function lineStart(source: string, lineIdx: number): number {
	let pos = 0;
	for (let i = 0; i < lineIdx && pos !== -1; i++) {
		pos = source.indexOf("\n", pos) + 1;
		if (pos === 0) return source.length;
	}
	return pos;
}

function offsetLine(source: string, offset: number): number {
	let line = 0;
	for (let i = 0; i < offset && i < source.length; i++) {
		if (source.charCodeAt(i) === 10) line++;
	}
	return line;
}

export function editSymbol(
	file: string,
	source: string,
	qualifiedName: string,
	newBody: string,
): EditSymbolResult {
	const language = languageFor(file);
	if (!isSupported(language)) {
		return { status: "unsupported_language", reason: "unsupported_language", language };
	}
	// Support dotted names like `Foo.method` by matching the last segment.
	const name = qualifiedName.split(".").pop() ?? qualifiedName;
	const ranges = findSymbolRange(source, name);
	if (ranges.length === 0) {
		return { status: "not_found", reason: "not_found" };
	}
	if (ranges.length > 1) {
		// Try to disambiguate on full qualified name by surrounding context.
		// For now, return every candidate.
		const candidates = ranges.map((r) => ({
			file,
			name,
			line: r.startLine,
			signature: r.signature,
		}));
		return { status: "ambiguous", reason: "ambiguous", candidates };
	}
	const [only] = ranges;
	const before = source.slice(0, only.startOffset);
	const after = source.slice(only.endOffset);
	// Preserve the signature line prefix; replace from the open brace (or full line if no brace)
	const sigLine = source.slice(only.startOffset, only.endOffset).split("\n")[0];
	const braceIdx = sigLine.indexOf("{");
	const signaturePart = braceIdx === -1 ? sigLine : sigLine.slice(0, braceIdx + 1);
	const rebuilt = `${signaturePart}\n${newBody}\n}`;
	const candidate = `${before}${rebuilt}${after}`;
	// Parse sanity check: re-parse with the same heuristic and ensure the
	// replaced symbol is still discoverable.
	const reparsed = parseFile(file, candidate);
	const stillThere = reparsed.symbols.find((s) => s.name === name);
	if (!stillThere) {
		return {
			status: "parse_error",
			reason: "parse_error",
			diagnostic: `edit_symbol: replacement body produced unparseable ${name} in ${file}`,
		};
	}
	return {
		status: "ok",
		newContent: candidate,
		match: {
			file,
			name,
			line: only.startLine,
			signature: only.signature,
		},
		hunk: {
			beforeLine: only.startLine,
			afterLine: only.startLine,
			lineRange: lineRange(candidate, only.startLine, only.endLine),
		},
	};
}

/** T-099: atomic write — temp+rename, rollback on parse failure.
 *  Pure, test-friendly variant: caller provides write/read/rename. */
export interface AtomicWriteAdapter {
	read(file: string): string;
	writeTemp(file: string, contents: string): string;
	rename(tempPath: string, file: string): void;
	remove(path: string): void;
}

export interface AtomicEditResult {
	ok: boolean;
	result: EditSymbolResult;
}

export function atomicEditSymbol(
	file: string,
	qualifiedName: string,
	newBody: string,
	fs: AtomicWriteAdapter,
): AtomicEditResult {
	const original = fs.read(file);
	const result = editSymbol(file, original, qualifiedName, newBody);
	if (result.status !== "ok") {
		return { ok: false, result };
	}
	const tempPath = fs.writeTemp(file, result.newContent);
	try {
		// Sanity: read back the temp path to confirm contents round-trip
		// (real impl would call parser again)
		fs.rename(tempPath, file);
		return { ok: true, result };
	} catch (err) {
		fs.remove(tempPath);
		return {
			ok: false,
			result: {
				status: "parse_error",
				reason: "parse_error",
				diagnostic: err instanceof Error ? err.message : String(err),
			},
		};
	}
}
