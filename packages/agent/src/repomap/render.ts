// T-063, T-064, T-065, T-070, T-071: caveman-style renderer + full-prose fallback.

import type { SymbolNode } from "./symbol-graph.js";
import type { RankedSymbol } from "./pagerank.js";

export type RepoMapStyle = "caveman" | "full";

export interface RenderOptions {
	style: RepoMapStyle;
	workdir: string;
}

function relPath(absPath: string, workdir: string): string {
	if (!workdir) return absPath;
	return absPath.startsWith(workdir) ? absPath.slice(workdir.length).replace(/^\//, "") : absPath;
}

function kindGlyph(kind: SymbolNode["kind"]): string {
	switch (kind) {
		case "function":
			return "fn";
		case "class":
			return "cls";
		case "type":
			return "t";
		case "const":
			return "k";
	}
}

/** Estimate tokens a symbol will consume when rendered in the given style. */
export function estimateRenderTokens(sym: SymbolNode, style: RepoMapStyle): number {
	if (style === "caveman") {
		// `fn foo@file.ts:12` ≈ 6-8 tokens
		return Math.max(1, Math.ceil((sym.name.length + sym.file.length + 8) / 4));
	}
	// full prose: `function foo(x: number) {} — file.ts:12`
	return Math.max(1, Math.ceil((sym.signature.length + sym.file.length + 12) / 4));
}

export function renderRepomap(
	symbols: RankedSymbol[],
	opts: RenderOptions,
): string {
	const lines: string[] = [];
	// Deterministic secondary sort when scores are equal is already applied
	// in pagerank; renderer preserves the order.
	for (const { node } of symbols) {
		const path = relPath(node.file, opts.workdir);
		if (opts.style === "caveman") {
			lines.push(`${kindGlyph(node.kind)} ${node.name}@${path}:${node.line}`);
		} else {
			lines.push(`${node.signature} — ${path}:${node.line}`);
		}
	}
	return lines.join("\n");
}

/** T-070: inject a repomap block into the project-layer context string. */
export function injectRepomap(projectLayer: string, repomapBlock: string): string {
	const marker = "\n\n<!-- repomap -->\n";
	return `${projectLayer}${marker}${repomapBlock}`;
}

/** T-071: strip the repomap block; returns the layer without it. */
export function stripRepomap(projectLayerWithMap: string): string {
	const marker = "\n\n<!-- repomap -->\n";
	const idx = projectLayerWithMap.indexOf(marker);
	return idx === -1 ? projectLayerWithMap : projectLayerWithMap.slice(0, idx);
}
