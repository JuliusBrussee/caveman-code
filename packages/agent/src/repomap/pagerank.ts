// T-061, T-062, T-065, T-069: deterministic PageRank over symbol reference graph.

import type { SymbolGraph, SymbolNode } from "./symbol-graph.js";

export interface RankedSymbol {
	node: SymbolNode;
	score: number;
}

export interface PageRankOptions {
	damping?: number;
	iterations?: number;
}

export function pagerank(graph: SymbolGraph, opts: PageRankOptions = {}): RankedSymbol[] {
	const damping = opts.damping ?? 0.85;
	const iterations = opts.iterations ?? 40;
	const nodeIds = [...graph.nodes.keys()].sort();
	const n = nodeIds.length;
	if (n === 0) return [];
	const idx = new Map<string, number>();
	nodeIds.forEach((id, i) => idx.set(id, i));
	const outgoing: number[][] = Array.from({ length: n }, () => []);
	const outDegree = new Array(n).fill(0);
	for (const edge of graph.edges) {
		const from = idx.get(edge.from);
		const to = idx.get(edge.to);
		if (from === undefined || to === undefined) continue;
		outgoing[from].push(to);
		outDegree[from]++;
	}
	let rank = new Array(n).fill(1 / n);
	for (let iter = 0; iter < iterations; iter++) {
		const next = new Array(n).fill((1 - damping) / n);
		for (let i = 0; i < n; i++) {
			if (outDegree[i] === 0) {
				// Dangling: distribute evenly
				const share = (damping * rank[i]) / n;
				for (let j = 0; j < n; j++) next[j] += share;
				continue;
			}
			const share = (damping * rank[i]) / outDegree[i];
			for (const j of outgoing[i]) next[j] += share;
		}
		rank = next;
	}
	const ranked: RankedSymbol[] = nodeIds.map((id, i) => ({
		node: graph.nodes.get(id)!,
		score: rank[i],
	}));
	// Deterministic ordering: score desc, then by (file, line, name) asc
	ranked.sort((a, b) => {
		if (a.score !== b.score) return b.score - a.score;
		if (a.node.file !== b.node.file) return a.node.file.localeCompare(b.node.file);
		if (a.node.line !== b.node.line) return a.node.line - b.node.line;
		return a.node.name.localeCompare(b.node.name);
	});
	return ranked;
}

/** Select top-K symbols whose rendered budget fits `tokenBudget`.
 *  Drops lowest-rank first; never splits a symbol mid-body. */
export function selectWithinBudget(
	ranked: RankedSymbol[],
	tokenBudget: number,
	estimate: (sym: SymbolNode) => number,
): RankedSymbol[] {
	const out: RankedSymbol[] = [];
	let used = 0;
	for (const item of ranked) {
		const cost = estimate(item.node);
		if (used + cost > tokenBudget) break;
		out.push(item);
		used += cost;
	}
	return out;
}
