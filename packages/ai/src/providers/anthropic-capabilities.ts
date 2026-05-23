/**
 * Per-(provider, model) capability lookup for Anthropic-family Claude models.
 *
 * Two layers:
 *
 *  1. Runtime cache populated from each provider's model-discovery endpoint:
 *       - github-copilot: GET {baseUrl}/models  (OpenAI-style with capabilities)
 *       - anthropic:      GET {baseUrl}/v1/models  (Anthropic-native capabilities)
 *     The discovery layer (see anthropic-discovery.ts) feeds this cache via
 *     `setDiscoveredCapabilities`. Discovery is provider-aware because the
 *     same conceptual model can have different capabilities on different
 *     relays (e.g. claude-opus-4.6 caps at 200k on GitHub Copilot, but the
 *     1M tier on Copilot is exposed as a separate model id "claude-opus-4.6-1m";
 *     on the direct Anthropic API the 1M tier on opus-4.5 is gated by the
 *     `context-1m-2025-08-07` beta header on the same id).
 *
 *  2. Static fallback table consulted only when discovery has not (yet) run
 *     for the (provider, model) pair, or has failed (offline, 4xx, 5xx, or
 *     the provider exposes no discovery endpoint — e.g. Bedrock, Vertex).
 *     The static table is intentionally *conservative*: it only encodes
 *     opt-ins we know to be safe on every relay we have tested. Anything
 *     uncertain (xhighEffort, contextBeta) is left off and is only enabled
 *     after discovery confirms it.
 *
 * The capability shape:
 *   - thinkingSchema : which extended-thinking request shape the model
 *                      accepts. "legacy" -> {thinking:{type:"enabled",
 *                      budget_tokens:N}}.  "adaptive" -> {thinking:{type:
 *                      "adaptive"}, output_config:{effort:...}}.
 *   - contextBeta    : optional `anthropic-beta` value to opt into a larger
 *                      context window via header (Anthropic-direct only).
 *   - contextWindow  : ceiling once contextBeta (if any) is applied.
 *                      When set, overrides models.generated.ts at registry
 *                      load time so the modeline/picker/compaction logic
 *                      see the real value.
 *   - xhighEffort    : true when "xhigh" thinking should map to adaptive
 *                      effort "max" instead of clamping to "high".
 *                      Only valid when the underlying account/relay exposes
 *                      effort=max for the model.
 */

export type AnthropicThinkingSchema = "legacy" | "adaptive";

export interface AnthropicModelCapabilities {
	thinkingSchema: AnthropicThinkingSchema;
	contextBeta?: string;
	contextWindow?: number;
	xhighEffort?: boolean;
}

const CONTEXT_1M_BETA = "context-1m-2025-08-07";

// ----------------------------------------------------------------------------
// Runtime cache (populated by anthropic-discovery.ts)
// ----------------------------------------------------------------------------

const discoveredCache = new Map<string, AnthropicModelCapabilities>();

function cacheKey(provider: string, modelId: string): string {
	return `${provider}::${modelId}`;
}

export function setDiscoveredCapabilities(provider: string, modelId: string, caps: AnthropicModelCapabilities): void {
	discoveredCache.set(cacheKey(provider, modelId), caps);
}

export function getDiscoveredCapabilities(provider: string, modelId: string): AnthropicModelCapabilities | undefined {
	return discoveredCache.get(cacheKey(provider, modelId));
}

/** Clear the discovery cache. Test-only. */
export function _clearDiscoveredCapabilitiesForTests(): void {
	discoveredCache.clear();
}

// ----------------------------------------------------------------------------
// Static fallback table
// ----------------------------------------------------------------------------

/**
 * Ordered list of static entries.
 *
 * Each entry can optionally restrict its match to specific providers. This
 * encodes the asymmetry we have empirically verified:
 *
 *  - On the direct Anthropic API and on AWS Bedrock (which mirrors the
 *    same Messages API), Opus 4.6 / 4.7 accept `output_config.effort=max`
 *    per Anthropic's own /v1/models capability advertisement.
 *  - On the GitHub Copilot Anthropic relay, the *same* model ids cap
 *    reasoning_effort at ["low","medium","high"]; sending effort=max is
 *    rejected. Copilot exposes the higher tier as a distinct model id
 *    whose reasoning_effort list includes "xhigh". So for Copilot we
 *    leave xhighEffort off here
 *    and let the discovery layer fill it in per actual model id.
 *
 * First match wins.
 */
const CAPABILITY_ENTRIES: Array<{
	match: (id: string) => boolean;
	providers?: ReadonlyArray<string>;
	caps: AnthropicModelCapabilities;
}> = [
	// Opus 4.7 — adaptive thinking. xhigh -> effort=max on the direct
	// Anthropic API and Bedrock; not on Copilot (uses separate model ids).
	{
		match: (id) => id.includes("opus-4-7") || id.includes("opus-4.7"),
		providers: ["anthropic", "amazon-bedrock", "openrouter"],
		caps: { thinkingSchema: "adaptive", xhighEffort: true },
	},
	{
		match: (id) => id.includes("opus-4-7") || id.includes("opus-4.7"),
		caps: { thinkingSchema: "adaptive" },
	},
	// Opus 4.6 — same provider-conditional xhighEffort.
	{
		match: (id) => id.includes("opus-4-6") || id.includes("opus-4.6"),
		providers: ["anthropic", "amazon-bedrock", "openrouter"],
		caps: { thinkingSchema: "adaptive", xhighEffort: true },
	},
	{
		match: (id) => id.includes("opus-4-6") || id.includes("opus-4.6"),
		caps: { thinkingSchema: "adaptive" },
	},
	// Opus 4.5 — legacy thinking. The 1M context window via the context-1m
	// beta header is direct-Anthropic-only (and even there the Anthropic
	// /v1/models endpoint is the authoritative source — discovery confirms
	// the beta and the resulting window). The Copilot relay rejects this
	// header (it offers 1M via separate model ids only).
	{
		match: (id) => id.includes("opus-4-5") || id.includes("opus-4.5"),
		caps: { thinkingSchema: "legacy" },
	},
	// Sonnet 4.6 — adaptive thinking on all relays.
	{
		match: (id) => id.includes("sonnet-4-6") || id.includes("sonnet-4.6"),
		caps: { thinkingSchema: "adaptive" },
	},
];

const DEFAULT_CAPABILITIES: AnthropicModelCapabilities = {
	thinkingSchema: "legacy",
};

function staticCapabilities(modelId: string, provider?: string): AnthropicModelCapabilities {
	for (const entry of CAPABILITY_ENTRIES) {
		if (!entry.match(modelId)) continue;
		if (entry.providers && (!provider || !entry.providers.includes(provider))) continue;
		return entry.caps;
	}
	return DEFAULT_CAPABILITIES;
}

// ----------------------------------------------------------------------------
// Public lookup
// ----------------------------------------------------------------------------

/**
 * Resolve capabilities for a Claude model.
 *
 * When `provider` is supplied, the runtime cache populated by discovery is
 * consulted first. Falls back to the static table otherwise.
 *
 * Backward-compatible signature: callers that do not have a provider id
 * (e.g. registry-load time, before any auth has happened) can omit it and
 * get the static fallback.
 */
export function getAnthropicCapabilities(modelId: string, provider?: string): AnthropicModelCapabilities {
	if (provider) {
		const cached = discoveredCache.get(cacheKey(provider, modelId));
		if (cached) return cached;
	}
	return staticCapabilities(modelId, provider);
}

export function supportsAdaptiveThinking(modelId: string, provider?: string): boolean {
	return getAnthropicCapabilities(modelId, provider).thinkingSchema === "adaptive";
}

export const CONTEXT_1M_BETA_HEADER = CONTEXT_1M_BETA;
