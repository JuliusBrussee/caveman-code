// T-059..T-071
import { describe, expect, it } from "vitest";
import { parseFile } from "../repomap/parser.js";
import { buildSymbolGraph } from "../repomap/symbol-graph.js";
import { pagerank, selectWithinBudget } from "../repomap/pagerank.js";
import {
	estimateRenderTokens,
	injectRepomap,
	renderRepomap,
	stripRepomap,
} from "../repomap/render.js";
import { RepomapCache } from "../repomap/cache.js";

const fileA = `export function alpha() {}
export const beta = 1;
export class Gamma {}
`;
const fileB = `import { alpha, beta, Gamma } from './a';
export function delta() { return alpha() + beta; }
`;

describe("buildSymbolGraph", () => {
	it("produces A→B edge when B references A", () => {
		const parsedA = parseFile("a.ts", fileA);
		const parsedB = parseFile("b.ts", fileB);
		const sources = new Map([
			["a.ts", fileA],
			["b.ts", fileB],
		]);
		const graph = buildSymbolGraph([parsedA, parsedB], sources);
		expect(graph.nodes.size).toBeGreaterThanOrEqual(4);
		// edges from delta → alpha, delta → beta, delta → Gamma
		const fromDelta = graph.edges.filter((e) => e.from.includes("delta"));
		expect(fromDelta.length).toBeGreaterThanOrEqual(2);
	});

	it("emits all four symbol kinds from TS", () => {
		const source = `function a() {}\nclass B {}\ntype C = string;\nconst d = 1;`;
		const parsed = parseFile("s.ts", source);
		const graph = buildSymbolGraph([parsed], new Map([["s.ts", source]]));
		const kinds = new Set([...graph.nodes.values()].map((n) => n.kind));
		expect(kinds.has("function")).toBe(true);
		expect(kinds.has("class")).toBe(true);
		expect(kinds.has("type")).toBe(true);
		expect(kinds.has("const")).toBe(true);
	});

	it("every node carries file/line/kind/signature", () => {
		const parsed = parseFile("s.ts", fileA);
		const graph = buildSymbolGraph([parsed], new Map([["s.ts", fileA]]));
		for (const node of graph.nodes.values()) {
			expect(node.file).toBeDefined();
			expect(node.line).toBeGreaterThan(0);
			expect(node.kind).toBeDefined();
			expect(node.signature.length).toBeGreaterThan(0);
		}
	});
});

describe("pagerank", () => {
	it("returns deterministic ranked list", () => {
		const a = parseFile("a.ts", fileA);
		const b = parseFile("b.ts", fileB);
		const sources = new Map([
			["a.ts", fileA],
			["b.ts", fileB],
		]);
		const graph = buildSymbolGraph([a, b], sources);
		const r1 = pagerank(graph);
		const r2 = pagerank(graph);
		expect(r1.map((r) => r.node.id)).toEqual(r2.map((r) => r.node.id));
	});

	it("ranks referenced symbols higher than unreferenced", () => {
		const a = parseFile("a.ts", fileA);
		const b = parseFile("b.ts", fileB);
		const sources = new Map([
			["a.ts", fileA],
			["b.ts", fileB],
		]);
		const graph = buildSymbolGraph([a, b], sources);
		const ranked = pagerank(graph);
		const top = ranked[0].node;
		// alpha / beta / Gamma are referenced by b.ts; delta is a leaf
		expect(["alpha", "beta", "Gamma"]).toContain(top.name);
	});

	it("selectWithinBudget drops lowest-rank first", () => {
		const a = parseFile("a.ts", fileA);
		const graph = buildSymbolGraph([a], new Map([["a.ts", fileA]]));
		const ranked = pagerank(graph);
		const budget = ranked.length - 1;
		const selected = selectWithinBudget(ranked, budget, () => 1);
		expect(selected.length).toBe(budget);
		expect(selected.map((r) => r.node.name)).toEqual(
			ranked.slice(0, budget).map((r) => r.node.name),
		);
	});
});

describe("renderRepomap", () => {
	const parsed = parseFile("/workdir/a.ts", fileA);
	const graph = buildSymbolGraph([parsed], new Map([["/workdir/a.ts", fileA]]));
	const ranked = pagerank(graph);

	it("caveman style fits more symbols at equal budget than full", () => {
		// For the same symbols, caveman tokens per symbol < full tokens per symbol
		for (const r of ranked) {
			const cav = estimateRenderTokens(r.node, "caveman");
			const full = estimateRenderTokens(r.node, "full");
			expect(cav).toBeLessThanOrEqual(full);
		}
	});

	it("full style produces human-readable signature + path", () => {
		const out = renderRepomap(ranked, { style: "full", workdir: "/workdir" });
		expect(out).toContain("a.ts");
		expect(out).toContain("—");
	});

	it("byte-stable across two renders", () => {
		const a = renderRepomap(ranked, { style: "caveman", workdir: "/workdir" });
		const b = renderRepomap(ranked, { style: "caveman", workdir: "/workdir" });
		expect(a).toBe(b);
	});

	it("uses relative path, no absolute workdir", () => {
		const out = renderRepomap(ranked, { style: "caveman", workdir: "/workdir" });
		expect(out).not.toContain("/workdir/");
		expect(out).toContain("a.ts");
	});

	it("injectRepomap + stripRepomap are inverses", () => {
		const base = "CLAUDE.md contents";
		const block = "fn alpha@a.ts:1";
		const injected = injectRepomap(base, block);
		expect(injected).toContain(block);
		expect(stripRepomap(injected)).toBe(base);
	});
});

describe("RepomapCache", () => {
	it("returns null when stale (head changed)", () => {
		const cache = new RepomapCache();
		const fp = {
			gitHead: "abc",
			mtimes: new Map([["a.ts", 100]]),
			intervalMs: 60_000,
			lastRefreshMs: Date.now(),
		};
		cache.put("block", fp);
		expect(cache.isStale("def", new Map([["a.ts", 100]]))).toBe(true);
	});

	it("returns null when stale (mtime changed)", () => {
		const cache = new RepomapCache();
		const fp = {
			gitHead: "abc",
			mtimes: new Map([["a.ts", 100]]),
			intervalMs: 60_000,
			lastRefreshMs: Date.now(),
		};
		cache.put("block", fp);
		expect(cache.isStale("abc", new Map([["a.ts", 200]]))).toBe(true);
	});

	it("returns entry when fresh", () => {
		const cache = new RepomapCache();
		const fp = {
			gitHead: "abc",
			mtimes: new Map([["a.ts", 100]]),
			intervalMs: 60_000,
			lastRefreshMs: Date.now(),
		};
		cache.put("block", fp);
		expect(cache.get()?.rendered).toBe("block");
	});

	it("invalidate clears entry", () => {
		const cache = new RepomapCache();
		cache.put("b", {
			gitHead: "a",
			mtimes: new Map(),
			intervalMs: 60_000,
			lastRefreshMs: Date.now(),
		});
		cache.invalidate();
		expect(cache.get()).toBeNull();
	});
});
