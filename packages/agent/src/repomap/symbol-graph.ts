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

/** Build a symbol graph from parsed files. Edges are references: any
 *  token in a file's source that matches another file's symbol name becomes
 *  an edge from that file's primary symbol to the referenced symbol. */
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
	const edges: SymbolEdge[] = [];
	const incomingCount = new Map<string, number>();
	for (const file of files) {
		const source = sources.get(file.file) ?? "";
		const tokens = source.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
		const referenced = new Set<string>();
		for (const tok of tokens) referenced.add(tok);
		for (const fromSym of file.symbols) {
			const fromId = nodeId(fromSym.file, fromSym.name, fromSym.line);
			for (const refName of referenced) {
				if (refName === fromSym.name) continue;
				const targets = byName.get(refName);
				if (!targets) continue;
				for (const target of targets) {
					if (target.file === fromSym.file && target.name === fromSym.name) continue;
					const edge = { from: fromId, to: target.id };
					edges.push(edge);
					incomingCount.set(target.id, (incomingCount.get(target.id) ?? 0) + 1);
				}
			}
		}
	}
	// Deterministic edge ordering
	edges.sort((a, b) => (a.from === b.from ? a.to.localeCompare(b.to) : a.from.localeCompare(b.from)));
	return { nodes, edges, incomingCount };
}
