// T-001: CachePolicy shape + layered breakpoint ordering contract.
// T-003: Single breakpoint per layer, layer isolation invariant.
import type { Usage } from "../types.js";

export type CacheLayer = "tools" | "system" | "project" | "messages";

export const CACHE_LAYER_ORDER: readonly CacheLayer[] = [
	"tools",
	"system",
	"project",
	"messages",
] as const;

export type CacheRetention = "long" | "short" | "none";

export interface LayerBlock {
	layer: CacheLayer;
	/** Canonical UTF-8 bytes that form the layer's stable prefix. */
	bytes: string;
	/** At most one breakpoint per layer on breakpoint-capable providers. */
	breakpoint?: boolean;
}

export interface CachePolicy {
	retention: CacheRetention;
	/** If true, the provider supports explicit breakpoints (Anthropic-style). */
	supportsBreakpoints: boolean;
}

export interface LayeredPayload {
	layers: LayerBlock[];
	policy: CachePolicy;
}

export function defaultPolicy(): CachePolicy {
	return { retention: "short", supportsBreakpoints: false };
}

// T-044, T-046: unified token-usage shape exposed by every adapter.
export interface CacheUsageReport {
	cachedInputTokens: number;
	cacheWriteTokens: number;
	uncachedInputTokens: number;
}

export function totalInputTokens(u: CacheUsageReport): number {
	return u.cachedInputTokens + u.uncachedInputTokens;
}

// T-047, T-048, T-049: per-call retention resolution.
export interface RetentionResolveContext {
	roleDefault: CacheRetention;
	/** CLI flag --cache=long|short|none overrides role default. */
	cliFlag?: CacheRetention;
	/** CaveKit phase override takes precedence over role default but
	 *  is still overridden by an explicit CLI flag. */
	cavekitPhaseOverride?: CacheRetention;
}

export function resolveRetention(ctx: RetentionResolveContext): CacheRetention {
	if (ctx.cliFlag) return ctx.cliFlag;
	if (ctx.cavekitPhaseOverride) return ctx.cavekitPhaseOverride;
	return ctx.roleDefault;
}

/** Enforce R1: at most one breakpoint per layer, layers in canonical order. */
export function validateLayers(layers: LayerBlock[]): void {
	const seen = new Set<CacheLayer>();
	for (const block of layers) {
		if (seen.has(block.layer)) {
			throw new Error(`cache: duplicate layer ${block.layer}`);
		}
		seen.add(block.layer);
	}
	const order = layers.map((l) => CACHE_LAYER_ORDER.indexOf(l.layer));
	for (let i = 1; i < order.length; i++) {
		if (order[i] < order[i - 1]) {
			throw new Error(
				`cache: layers out of canonical order: ${layers.map((l) => l.layer).join(",")}`,
			);
		}
	}
	const breakpointsPerLayer = new Map<CacheLayer, number>();
	for (const block of layers) {
		if (block.breakpoint) {
			breakpointsPerLayer.set(block.layer, (breakpointsPerLayer.get(block.layer) ?? 0) + 1);
		}
	}
	for (const [layer, count] of breakpointsPerLayer) {
		if (count > 1) {
			throw new Error(`cache: layer ${layer} has ${count} breakpoints, max 1`);
		}
	}
}

// T-041/T-042: convert provider Usage to CacheUsageReport.
export function usageToCacheReport(usage: Usage): CacheUsageReport {
	return {
		cachedInputTokens: usage.cacheRead,
		cacheWriteTokens: usage.cacheWrite,
		uncachedInputTokens: Math.max(0, usage.input),
	};
}
