// T-059, T-060: symbol graph with function/class/type/const kinds + reference edges.

import type { ParsedFile, ParsedSymbol } from "./parser.js";

export interface SymbolNode {
	id: string;
	file: string;
	line: number;
	kind: ParsedSymbol["kind"];
	name: string;
	signature: string;
}

export interface SymbolEdge {
	from: string;
	to: string;
}

export interface SymbolGraph {
	nodes: Map<string, SymbolNode>;
	edges: SymbolEdge[];
	incomingCount: Map<string, number>;
}

function nodeId(file: string, name: string, line: number): string {
	return `${file}#${name}@${line}`;
}

// A name with more than this many definitions is treated as overloaded noise
// (e.g. `result`, `model`) and produces no edges. Beyond this, each ref would
// fan out to dozens of unrelated targets.
const MAX_DEFINITIONS_PER_NAME = 5;

// A name referenced by more than this fraction of files is treated as a
// language-level token (`from`, `type`, `length`, `error`) and produces no
// edges — these dominate the cross-product without carrying information.
const MAX_REF_FILE_FRACTION = 0.25;

// Belt-and-braces cap on total edges. The filters above should keep us
// well under this on real repos; this only kicks in for pathological inputs.
const MAX_EDGES = 250_000;

const IDENTIFIER_RE = /[A-Za-z_][A-Za-z0-9_]*/g;

/** Build a symbol graph from parsed files. Edges are references: any
 *  token in a file's source that matches another file's symbol name becomes
 *  an edge from each of that file's symbols to the referenced symbol.
 *
 *  Common identifiers (>{@link MAX_DEFINITIONS_PER_NAME} definitions, or
 *  referenced by >{@link MAX_REF_FILE_FRACTION} of files) are filtered out
 *  before edge generation. Without this filter the cross-product on a
 *  ~500-file TypeScript monorepo blows up to ~20M edges and ~1.4GB heap. */
export function buildSymbolGraph(files: ParsedFile[], sources: Map<string, string>): SymbolGraph {
	const nodes = new Map<string, SymbolNode>();
	for (const file of files) {
		for (const sym of file.symbols) {
			const id = nodeId(sym.file, sym.name, sym.line);
			nodes.set(id, {
				id,
				file: sym.file,
				line: sym.line,
				kind: sym.kind,
				name: sym.name,
				signature: sym.signature,
			});
		}
	}

	// Index symbols by name for fast reference lookup.
	const byName = new Map<string, SymbolNode[]>();
	for (const node of nodes.values()) {
		const list = byName.get(node.name) ?? [];
		list.push(node);
		byName.set(node.name, list);
	}

	// Per-file set of referenced names that resolve to known symbols.
	const referencedByFile = new Map<string, Set<string>>();
	// How many files reference each name (file-frequency, used for noise filter).
	const fileFrequency = new Map<string, number>();
	for (const file of files) {
		const source = sources.get(file.file) ?? "";
		const tokens = source.match(IDENTIFIER_RE);
		const relevant = new Set<string>();
		if (tokens) {
			for (const tok of tokens) {
				if (byName.has(tok)) relevant.add(tok);
			}
		}
		referencedByFile.set(file.file, relevant);
		for (const name of relevant) fileFrequency.set(name, (fileFrequency.get(name) ?? 0) + 1);
	}

	const noisyRefThreshold = Math.max(10, Math.floor(files.length * MAX_REF_FILE_FRACTION));

	// Filter byName: drop overloaded names + drop names referenced from too many files.
	const usefulByName = new Map<string, SymbolNode[]>();
	for (const [name, defs] of byName) {
		if (defs.length > MAX_DEFINITIONS_PER_NAME) continue;
		if ((fileFrequency.get(name) ?? 0) > noisyRefThreshold) continue;
		usefulByName.set(name, defs);
	}

	// For each file, compute the deduplicated target node set ONCE. Without
	// dedup, two refNames in F whose def sets overlap would each emit edges
	// to the same target — and all symbols in F would repeat that work.
	const edges: SymbolEdge[] = [];
	const incomingCount = new Map<string, number>();
	let edgeBudget = MAX_EDGES;

	for (const file of files) {
		if (edgeBudget <= 0) break;
		const relevant = referencedByFile.get(file.file) ?? new Set<string>();
		const fileTargets: SymbolNode[] = [];
		const seenTargets = new Set<string>();
		for (const refName of relevant) {
			const defs = usefulByName.get(refName);
			if (!defs) continue;
			for (const def of defs) {
				if (def.file === file.file) continue; // skip self-file targets
				if (seenTargets.has(def.id)) continue;
				seenTargets.add(def.id);
				fileTargets.push(def);
			}
		}
		if (fileTargets.length === 0) continue;
		for (const fromSym of file.symbols) {
			const fromId = nodeId(fromSym.file, fromSym.name, fromSym.line);
			for (const target of fileTargets) {
				if (target.id === fromId) continue;
				edges.push({ from: fromId, to: target.id });
				incomingCount.set(target.id, (incomingCount.get(target.id) ?? 0) + 1);
				edgeBudget--;
				if (edgeBudget <= 0) break;
			}
			if (edgeBudget <= 0) break;
		}
	}

	// Deterministic edge ordering
	edges.sort((a, b) => (a.from === b.from ? a.to.localeCompare(b.to) : a.from.localeCompare(b.from)));
	return { nodes, edges, incomingCount };
}
