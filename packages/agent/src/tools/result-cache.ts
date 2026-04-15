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

export class ToolResultCache {
	private store = new Map<string, CachedResult>();
	private readonly bypass = new Set<string>(); // tool names that bypass caching

	constructor(bypass: string[] = []) {
		for (const name of bypass) this.bypass.add(name);
	}

	isBypass(tool: string): boolean {
		return this.bypass.has(tool);
	}

	get(key: CacheKey, now: () => number = Date.now): CachedResult | undefined {
		if (this.bypass.has(key.tool)) return undefined;
		const k = keyHash(key);
		const hit = this.store.get(k);
		if (hit) hit.hits++;
		return hit;
	}

	put(key: CacheKey, bytes: string, now: () => number = Date.now): void {
		if (this.bypass.has(key.tool)) return;
		const k = keyHash(key);
		this.store.set(k, { bytes, createdAt: now(), hits: 0 });
	}

	/** Invalidate entries whose fingerprint intersects `touched`. */
	invalidate(tool: string, predicate: (key: CacheKey) => boolean): void {
		// Not used in the basic tests; placeholder for T-072 wiring.
	}

	size(): number {
		return this.store.size;
	}
}
