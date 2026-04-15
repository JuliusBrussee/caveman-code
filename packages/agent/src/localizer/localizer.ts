// T-120, T-121: deterministic file→symbol→line localizer over repomap.

import type { SymbolNode } from "../repomap/symbol-graph.js";
import type { RankedSymbol } from "../repomap/pagerank.js";

export interface LocalizerCandidate {
	file: string;
	symbol: string;
	lineRange: [number, number];
	confidence: number;
}

export interface LocalizerInput {
	ranked: RankedSymbol[];
	query: string;
	topK: number;
}

function tokenize(text: string): string[] {
	return text.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
}

function score(node: SymbolNode, queryTokens: Set<string>): number {
	const nodeTokens = tokenize(`${node.name} ${node.signature} ${node.file}`);
	let overlap = 0;
	for (const t of nodeTokens) if (queryTokens.has(t)) overlap++;
	return overlap;
}

export function localize(input: LocalizerInput): LocalizerCandidate[] {
	const queryTokens = new Set(tokenize(input.query));
	const scored = input.ranked.map(({ node, score: pageRank }) => ({
		node,
		score: score(node, queryTokens) + pageRank * 10,
	}));
	// Deterministic ordering: score desc, then file/line
	scored.sort((a, b) => {
		if (a.score !== b.score) return b.score - a.score;
		if (a.node.file !== b.node.file) return a.node.file.localeCompare(b.node.file);
		return a.node.line - b.node.line;
	});
	return scored.slice(0, input.topK).map(({ node, score: s }) => ({
		file: node.file,
		symbol: node.name,
		lineRange: [node.line, node.line + 1],
		confidence: s,
	}));
}

export type LocalizerMode = "replace" | "augment" | "off";

export interface LocalizerFeedConfig {
	mode: LocalizerMode;
}

/** Produce a first-turn context block that either replaces or augments
 *  the existing initial context. `off` returns an empty string. */
export function localizerFeed(candidates: LocalizerCandidate[], config: LocalizerFeedConfig): string {
	if (config.mode === "off") return "";
	const lines = candidates.map(
		(c) => `${c.file}:${c.lineRange[0]} ${c.symbol} (conf=${c.confidence.toFixed(2)})`,
	);
	return `<!-- localizer ${config.mode} -->\n${lines.join("\n")}`;
}
