// T-028, T-029, T-030, T-031: tool result cache +
// output normalization + session scoping.
//
// Cache key: (tool, normalized(args), fingerprint). Fingerprint is a
// function of the workdir fingerprint tuple `(git-sha, mtime, size)` for
// the files the tool touches. Call sites supply the fingerprint —
// this module just keys/stores/invalidates.

import { createHash } from "node:crypto";

export interface Fingerprint {
	gitSha?: string;
	mtime?: number;
	size?: number;
}

export interface CacheKey {
	sessionId: string;
	tool: string;
	args: unknown;
	fingerprint: Fingerprint;
}

export interface CachedResult {
	bytes: string;
	createdAt: number;
	hits: number;
}

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	const obj = value as Record<string, unknown>;
	const keys = Object.keys(obj).sort();
	return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export function keyHash(key: CacheKey): string {
	const src = [
		key.sessionId,
		key.tool,
		canonicalJson(key.args),
		key.fingerprint.gitSha ?? "",
		String(key.fingerprint.mtime ?? ""),
		String(key.fingerprint.size ?? ""),
	].join("|");
	return createHash("sha256").update(src).digest("hex");
}

// T-030: normalization — ANSI strip, path rewrite, ISO timestamp redaction.
const ANSI_RE = /\u001B\[[0-9;]*[A-Za-z]/g;
const ISO_RE =
	/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g;

export function normalizeToolOutput(output: string, workdir: string): string {
	let out = output.replace(ANSI_RE, "");
	if (workdir) {
		const esc = workdir.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
		out = out.replace(new RegExp(esc, "g"), ".");
	}
	out = out.replace(ISO_RE, "<ts>");
	// Collapse CRLF to LF for byte-stable equality
	out = out.replace(/\r\n/g, "\n");
	// Trim trailing whitespace per line
	out = out
		.split("\n")
		.map((l) => l.replace(/\s+$/u, ""))
		.join("\n");
	return out;
}

export interface CachedEntry {
	key: CacheKey;
	hash: string;
	bytes: string;
	byteLen: number;
	createdAt: number;
	lastAccessed: number;
	turnAccessed: number;
	hits: number;
}

export interface CacheTraceEvent {
	type: "tool_cache_hit" | "tool_cache_miss";
	tool: string;
	sessionId: string;
	savedTokens?: number;
}

export type CacheTraceSink = (event: CacheTraceEvent) => void;

export class ToolResultCache {
	private store = new Map<string, CachedEntry>();
	private readonly bypass = new Set<string>();
	private currentTurn = 0;
	private tokenBudget: number | undefined;
	private currentTokens = 0;
	private traceSink?: CacheTraceSink;

	constructor(options: { bypass?: string[]; tokenBudget?: number; traceSink?: CacheTraceSink } = {}) {
		for (const name of options.bypass ?? []) this.bypass.add(name);
		this.tokenBudget = options.tokenBudget;
		this.traceSink = options.traceSink;
	}

	setTurn(turn: number): void {
		this.currentTurn = turn;
	}

	isBypass(tool: string): boolean {
		return this.bypass.has(tool);
	}

	get(key: CacheKey, now: () => number = Date.now): CachedEntry | undefined {
		if (this.bypass.has(key.tool)) {
			this.traceSink?.({ type: "tool_cache_miss", tool: key.tool, sessionId: key.sessionId });
			return undefined;
		}
		const k = keyHash(key);
		const hit = this.store.get(k);
		if (hit) {
			hit.hits++;
			hit.lastAccessed = now();
			hit.turnAccessed = this.currentTurn;
			this.traceSink?.({
				type: "tool_cache_hit",
				tool: key.tool,
				sessionId: key.sessionId,
				savedTokens: Math.ceil(hit.byteLen / 4),
			});
			return hit;
		}
		this.traceSink?.({ type: "tool_cache_miss", tool: key.tool, sessionId: key.sessionId });
		return undefined;
	}

	put(key: CacheKey, bytes: string, now: () => number = Date.now): void {
		if (this.bypass.has(key.tool)) return;
		const k = keyHash(key);
		const byteLen = Buffer.byteLength(bytes, "utf8");
		const prev = this.store.get(k);
		if (prev) this.currentTokens -= Math.ceil(prev.byteLen / 4);
		const entry: CachedEntry = {
			key,
			hash: k,
			bytes,
			byteLen,
			createdAt: now(),
			lastAccessed: now(),
			turnAccessed: this.currentTurn,
			hits: 0,
		};
		this.store.set(k, entry);
		this.currentTokens += Math.ceil(byteLen / 4);
		this.maybeEvict();
	}

	/** T-072: invalidate all entries whose key matches predicate. */
	invalidate(predicate: (key: CacheKey) => boolean): number {
		let removed = 0;
		for (const [hash, entry] of this.store) {
			if (predicate(entry.key)) {
				this.currentTokens -= Math.ceil(entry.byteLen / 4);
				this.store.delete(hash);
				removed++;
			}
		}
		return removed;
	}

	/** T-072: file-level invalidation — drop every entry whose fingerprint mentions the touched path. */
	invalidateFile(touchedFile: string): number {
		return this.invalidate((key) => {
			const args = key.args as Record<string, unknown> | undefined;
			const path = (args?.path ?? args?.file) as string | undefined;
			return path === touchedFile;
		});
	}

	size(): number {
		return this.store.size;
	}

	tokenEstimate(): number {
		return this.currentTokens;
	}

	counter(): number {
		let total = 0;
		for (const e of this.store.values()) total += e.hits;
		return total;
	}

	/** T-076: token-bounded LRU eviction. Entries accessed in the current
	 *  turn are never evicted (T-077). */
	private maybeEvict(): void {
		if (this.tokenBudget === undefined) return;
		if (this.currentTokens <= this.tokenBudget) return;
		const candidates = [...this.store.values()]
			.filter((e) => e.turnAccessed !== this.currentTurn)
			.sort((a, b) => a.lastAccessed - b.lastAccessed);
		for (const victim of candidates) {
			if (this.currentTokens <= this.tokenBudget) break;
			this.currentTokens -= Math.ceil(victim.byteLen / 4);
			this.store.delete(victim.hash);
		}
	}
}
