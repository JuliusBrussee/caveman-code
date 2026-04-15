// T-002: Assemble tools/system/project/messages layers in strict order.
import { createHash } from "node:crypto";
import {
	CACHE_LAYER_ORDER,
	type CacheLayer,
	type CachePolicy,
	type LayerBlock,
	type LayeredPayload,
	validateLayers,
} from "./policy.js";
import { serializeToolSchemas, type ToolSchema } from "./tool-serializer.js";

export interface AssembleInput {
	tools: ToolSchema[];
	system: string;
	project?: string;
	messages: string[];
	policy: CachePolicy;
}

/** Produce the canonical 4-layer payload. Non-breakpoint providers
 *  still receive the same 4 blocks (just without breakpoint flags). */
export function assembleLayered(input: AssembleInput): LayeredPayload {
	const layers: LayerBlock[] = [];
	layers.push({
		layer: "tools",
		bytes: serializeToolSchemas(input.tools),
		breakpoint: input.policy.supportsBreakpoints,
	});
	layers.push({
		layer: "system",
		bytes: input.system,
		breakpoint: input.policy.supportsBreakpoints,
	});
	if (input.project !== undefined) {
		layers.push({
			layer: "project",
			bytes: input.project,
			breakpoint: input.policy.supportsBreakpoints,
		});
	}
	layers.push({
		layer: "messages",
		bytes: JSON.stringify(input.messages),
		// messages layer: one breakpoint at the tail on breakpoint providers
		breakpoint: input.policy.supportsBreakpoints,
	});
	validateLayers(layers);
	return { layers, policy: input.policy };
}

export function layerBytes(payload: LayeredPayload, layer: CacheLayer): string {
	const block = payload.layers.find((l) => l.layer === layer);
	return block ? block.bytes : "";
}

export function layerHash(payload: LayeredPayload, layer: CacheLayer): string {
	return createHash("sha256").update(layerBytes(payload, layer)).digest("hex");
}

export function layersInOrder(payload: LayeredPayload): CacheLayer[] {
	return payload.layers.map((l) => l.layer);
}

export function canonicalOrder(): readonly CacheLayer[] {
	return CACHE_LAYER_ORDER;
}
