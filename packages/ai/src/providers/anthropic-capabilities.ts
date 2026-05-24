/**
 * Per-(provider, model) capability table for Anthropic Claude models.
 *
 * Centralizes opt-ins for features that vary across model generations:
 *  - `thinkingSchema`: which extended-thinking request shape the model accepts
 *      - "legacy"   : { thinking: { type: "enabled", budget_tokens: N } }
 *      - "adaptive" : { thinking: { type: "adaptive" }, output_config: { effort } }
 *  - `contextBeta` : optional `anthropic-beta` value to opt into a larger
 *                    context window (e.g. "context-1m-2025-08-07").
 *                    Provider-conditional and account-conditional — see below.
 *  - `contextWindow`: authoritative ceiling once `contextBeta` is opted into.
 *                    When set, overrides the value from the generated registry.
 *  - `xhighEffort` : true when thinking level "xhigh" should map to adaptive
 *                    effort "max" instead of clamping to "high".
 *                    Provider-conditional — see below.
 *
 * Provider scoping
 * ----------------
 *
 * Several capabilities differ by relay for the same model id:
 *
 *  - On the direct Anthropic API and AWS Bedrock (which mirrors the Messages
 *    API surface), Opus 4.6 / 4.7 accept `output_config.effort=max` per
 *    Anthropic's own /v1/models capability advertisement.
 *  - On the GitHub Copilot Anthropic relay, the same model ids cap
 *    reasoning_effort at ["low","medium","high"]; sending effort=max is
 *    rejected. Copilot exposes the higher tier via distinct model ids
 *    whose reasoning_effort list includes "xhigh".
 *  - The 1M context window for opus-4-5 on the direct Anthropic API is
 *    gated by the `context-1m-2025-08-07` beta header. The Copilot relay
 *    rejects that beta entirely ("unsupported beta header(s)"); Copilot
 *    exposes 1M only as a separate model id (e.g. "claude-opus-4.6-1m").
 *
 * To stay correct everywhere this table only sets `xhighEffort` and
 * `contextBeta` on the providers where they are known to be accepted.
 * For GitHub Copilot the static fallback is intentionally conservative; the
 * correct per-account capabilities and the additional 1M model ids are
 * surfaced by a follow-up runtime-discovery layer (separate change).
 *
 * Substring matching means both bare ids ("claude-opus-4-7") and prefixed
 * variants ("anthropic.claude-opus-4-7", "eu.anthropic.claude-opus-4-7",
 * "claude-opus-4-7@20251201") hit the same row.
 *
 * TODO: replace this hardcoded table with discovery against each provider's
 * model-listing endpoint (Anthropic /v1/models, GitHub Copilot /models).
 */

export type AnthropicThinkingSchema = "legacy" | "adaptive";

export interface AnthropicModelCapabilities {
	thinkingSchema: AnthropicThinkingSchema;
	contextBeta?: string;
	contextWindow?: number;
	xhighEffort?: boolean;
}

const CONTEXT_1M_BETA = "context-1m-2025-08-07";

/**
 * Providers known to expose the same Anthropic Messages API surface (and
 * therefore the same opt-ins) as the direct api.anthropic.com endpoint.
 * Copilot's `github-copilot` relay is excluded — it diverges on betas and
 * effort levels (see file-level docs).
 */
const ANTHROPIC_NATIVE_PROVIDERS: ReadonlyArray<string> = ["anthropic", "amazon-bedrock", "openrouter"];

/**
 * Ordered list of static entries. First match wins.
 */
const CAPABILITY_ENTRIES: Array<{
	match: (id: string) => boolean;
	providers?: ReadonlyArray<string>;
	caps: AnthropicModelCapabilities;
}> = [
	// Opus 4.7 — adaptive thinking. xhigh maps to effort=max on the direct
	// Anthropic API / Bedrock / OpenRouter (which all surface the Messages
	// API faithfully); not on Copilot, which uses a separate model id.
	{
		match: (id) => id.includes("opus-4-7") || id.includes("opus-4.7"),
		providers: ANTHROPIC_NATIVE_PROVIDERS,
		caps: { thinkingSchema: "adaptive", xhighEffort: true },
	},
	{
		match: (id) => id.includes("opus-4-7") || id.includes("opus-4.7"),
		caps: { thinkingSchema: "adaptive" },
	},
	// Opus 4.6 — same provider-conditional xhighEffort as 4.7.
	{
		match: (id) => id.includes("opus-4-6") || id.includes("opus-4.6"),
		providers: ANTHROPIC_NATIVE_PROVIDERS,
		caps: { thinkingSchema: "adaptive", xhighEffort: true },
	},
	{
		match: (id) => id.includes("opus-4-6") || id.includes("opus-4.6"),
		caps: { thinkingSchema: "adaptive" },
	},
	// Opus 4.5 — legacy budget-based thinking. On the direct Anthropic API
	// the 1M context tier is gated by the context-1m beta header on the
	// same model id, so emit the header and override the registry-reported
	// 200k ceiling to 1M. Copilot rejects this header (Copilot offers 1M
	// only via separate model ids exposed by runtime discovery, out of
	// scope for this static table), so we leave the beta off there.
	{
		match: (id) => id.includes("opus-4-5") || id.includes("opus-4.5"),
		providers: ANTHROPIC_NATIVE_PROVIDERS,
		caps: {
			thinkingSchema: "legacy",
			contextBeta: CONTEXT_1M_BETA,
			contextWindow: 1_000_000,
		},
	},
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

/**
 * Resolve capabilities for a Claude model id, optionally scoped by provider.
 *
 * Callers that have a provider id (e.g. the request builder, which always
 * does) should pass it so that provider-conditional entries can match.
 * Callers that don't (e.g. registry-load time, before any auth has happened)
 * can omit it and get the universal-provider entry.
 */
export function getAnthropicCapabilities(modelId: string, provider?: string): AnthropicModelCapabilities {
	for (const entry of CAPABILITY_ENTRIES) {
		if (!entry.match(modelId)) continue;
		if (entry.providers && (!provider || !entry.providers.includes(provider))) continue;
		return entry.caps;
	}
	return DEFAULT_CAPABILITIES;
}

export function supportsAdaptiveThinking(modelId: string, provider?: string): boolean {
	return getAnthropicCapabilities(modelId, provider).thinkingSchema === "adaptive";
}
