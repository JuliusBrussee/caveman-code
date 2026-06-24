/**
 * Shared MemoryProvider factory.
 *
 * AgentSession, the `/memory` slash command and the print-mode driver all need
 * the same backend instance: cavemem when its CLI is on $PATH, the markdown
 * `FilesProvider` otherwise. Constructing one provider per surface (as
 * interactive-mode.ts:4438 used to) means caches and MCP connections aren't
 * reused; this module hands out one cached instance per cwd.
 */

import { join } from "node:path";
import { memory as memoryNs } from "@juliusbrussee/caveman-agent";

type MemoryProvider = memoryNs.MemoryProvider;

export interface MemoryFactoryOptions {
	cwd: string;
	/** When false, force the FilesProvider fallback (skips cavemem probe). */
	allowCavemem?: boolean;
	/** Optional override for tests. */
	cavememOptions?: memoryNs.CavememProviderOptions;
}

interface CacheEntry {
	provider: MemoryProvider;
	cwd: string;
	allowCavemem: boolean;
}

const _cache = new Map<string, CacheEntry>();

function cacheKey(cwd: string, allowCavemem: boolean, hasHub: boolean): string {
	return `${allowCavemem ? "cm" : "fs"}:${hasHub ? "hub" : "nohub"}::${cwd}`;
}

/**
 * Returns a MemoryProvider for `cwd`. Cavemem when available, FilesProvider
 * otherwise. Cached per-cwd so successive `/memory` commands and the
 * `transformContext` chain hit the same instance.
 */
export async function resolveMemoryProvider(opts: MemoryFactoryOptions): Promise<MemoryProvider> {
	const allowCavemem = opts.allowCavemem !== false;
	const hasHub = Boolean(opts.cavememOptions?.hub);
	const key = cacheKey(opts.cwd, allowCavemem, hasHub);
	const cached = _cache.get(key);
	if (cached) return cached.provider;

	let provider: MemoryProvider;
	if (allowCavemem) {
		const cavemem = new memoryNs.CavememProvider(opts.cavememOptions);
		const ok = await cavemem.isAvailable().catch(() => false);
		provider = ok
			? cavemem
			: new memoryNs.FilesProvider({ cwd: opts.cwd, memoryDir: join(opts.cwd, ".cave", "memory") });
	} else {
		provider = new memoryNs.FilesProvider({ cwd: opts.cwd, memoryDir: join(opts.cwd, ".cave", "memory") });
	}
	_cache.set(key, { provider, cwd: opts.cwd, allowCavemem });
	return provider;
}

/** Drop cached providers (test helper). */
export function resetMemoryProviderCache(): void {
	_cache.clear();
}
