// T-001: CachePolicy shape + layered breakpoint ordering contract.
// T-003: Single breakpoint per layer, layer isolation invariant.

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
