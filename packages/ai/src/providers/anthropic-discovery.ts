/**
 * Model-capability discovery for Anthropic-family models.
 *
 * Two backends, dispatched by provider:
 *
 *  - github-copilot: GET {baseUrl}/models — OpenAI-style listing with rich
 *    `capabilities.supports` (adaptive_thinking, reasoning_effort, limits.
 *    max_context_window_tokens). The 1M context tier on Copilot is exposed
 *    as separate model ids (for example claude-opus-4.6-1m) rather than
 *    via a beta header; the bare id (claude-opus-4.6) is hard-capped at
 *    200k regardless of any beta header (which the relay rejects).
 *    Discovery surfaces every id the response returns so the user can
 *    select the right one in the picker.
 *
 *  - anthropic: GET {baseUrl}/v1/models — Anthropic-native with
 *    `capabilities.thinking.types.adaptive.supported`,
 *    `capabilities.effort.{max,xhigh}.supported`, `max_input_tokens`.
 *    The 1M context tier is gated by `anthropic-beta: context-1m-2025-08-07`
 *    on the same id; we detect it by making a second probe with that
 *    header and observing whether `max_input_tokens` rises.
 *
 *  - others (amazon-bedrock, google-vertex, etc.): no equivalent
 *    discovery endpoint; the static fallback table in
 *    anthropic-capabilities.ts is used.
 *
 * Discovery runs at most once per (provider, baseUrl, apiKey-hash) per
 * process. Concurrent calls join the same in-flight promise. Failures are
 * silent — we leave the static fallback in place and try again next
 * process. The discovery layer never throws back to the caller.
 *
 * The discovered registry entries (new model ids, corrected contextWindow)
 * are also pushed into the in-memory model registry via
 * `mergeDiscoveredModels` so the model picker reflects reality.
 */

import type { Api, Model } from "../types.js";
import {
	type AnthropicModelCapabilities,
	CONTEXT_1M_BETA_HEADER,
	setDiscoveredCapabilities,
} from "./anthropic-capabilities.js";

// ----------------------------------------------------------------------------
// Discovery state (per process)
// ----------------------------------------------------------------------------

const discoveryPromises = new Map<string, Promise<void>>();

function discoveryKey(provider: string, baseUrl: string): string {
	return `${provider}::${baseUrl}`;
}

/**
 * Trigger discovery for a provider+baseUrl. Returns a Promise that resolves
 * once the capability cache has been populated (or the attempt has failed).
 * Subsequent calls with the same (provider, baseUrl) join the in-flight
 * promise.
 *
 * Never throws. On any error the static fallback remains in place.
 */
export function discoverAnthropicCapabilities(
	provider: string,
	baseUrl: string,
	apiKey: string,
	extraHeaders?: Record<string, string>,
): Promise<void> {
	const key = discoveryKey(provider, baseUrl);
	const existing = discoveryPromises.get(key);
	if (existing) return existing;

	const p = runDiscovery(provider, baseUrl, apiKey, extraHeaders).catch(() => {
		// Swallow — discovery is best-effort; static table remains in place.
	});
	discoveryPromises.set(key, p);
	return p;
}

/** Test-only: clear discovery memo so tests can re-run. */
export function _clearDiscoveryStateForTests(): void {
	discoveryPromises.clear();
}

// ----------------------------------------------------------------------------
// Dispatcher
// ----------------------------------------------------------------------------

async function runDiscovery(
	provider: string,
	baseUrl: string,
	apiKey: string,
	extraHeaders?: Record<string, string>,
): Promise<void> {
	if (provider === "github-copilot") {
		await discoverCopilot(baseUrl, apiKey, extraHeaders);
		return;
	}
	if (provider === "anthropic") {
		await discoverAnthropicNative(baseUrl, apiKey, extraHeaders);
		return;
	}
	// No discovery endpoint for other providers (Bedrock, Vertex, etc.).
}

// ----------------------------------------------------------------------------
// GitHub Copilot: GET {baseUrl}/models
// ----------------------------------------------------------------------------

interface CopilotModelEntry {
	id: string;
	name?: string;
	vendor?: string;
	supported_endpoints?: string[];
	model_picker_enabled?: boolean;
	capabilities?: {
		family?: string;
		type?: string;
		supports?: {
			adaptive_thinking?: boolean;
			reasoning_effort?: string[];
			streaming?: boolean;
			tool_calls?: boolean;
			vision?: boolean;
		};
		limits?: {
			max_context_window_tokens?: number;
			max_output_tokens?: number;
			max_prompt_tokens?: number;
		};
	};
}

async function discoverCopilot(baseUrl: string, apiKey: string, extraHeaders?: Record<string, string>): Promise<void> {
	const res = await fetch(`${baseUrl}/models`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"User-Agent": "GitHubCopilotChat/0.35.0",
			"Editor-Version": "vscode/1.107.0",
			"Editor-Plugin-Version": "copilot-chat/0.35.0",
			"Copilot-Integration-Id": "vscode-chat",
			...extraHeaders,
		},
	});
	if (!res.ok) return;
	const body = (await res.json()) as { data?: CopilotModelEntry[] };
	const entries = body?.data ?? [];

	const discoveredModels: Model<"anthropic-messages">[] = [];

	for (const entry of entries) {
		if (entry.vendor !== "Anthropic") continue;
		if (!entry.supported_endpoints?.includes("/v1/messages")) continue;

		const caps = entry.capabilities ?? {};
		const sup = caps.supports ?? {};
		const lim = caps.limits ?? {};

		const adaptive = sup.adaptive_thinking === true;
		const efforts = sup.reasoning_effort ?? [];
		const xhighEffort = efforts.includes("max") || efforts.includes("xhigh");

		setDiscoveredCapabilities("github-copilot", entry.id, {
			thinkingSchema: adaptive ? "adaptive" : "legacy",
			xhighEffort: xhighEffort || undefined,
			contextWindow: lim.max_context_window_tokens,
		});

		// Build a registry entry so previously-unknown ids (e.g.
		// claude-opus-4.6-1m) show up in the model picker.
		discoveredModels.push({
			id: entry.id,
			name: entry.name || entry.id,
			api: "anthropic-messages",
			provider: "github-copilot",
			baseUrl,
			headers: {
				"User-Agent": "GitHubCopilotChat/0.35.0",
				"Editor-Version": "vscode/1.107.0",
				"Editor-Plugin-Version": "copilot-chat/0.35.0",
				"Copilot-Integration-Id": "vscode-chat",
			},
			reasoning: adaptive,
			input: sup.vision ? ["text", "image"] : ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: lim.max_context_window_tokens ?? 128000,
			maxTokens: lim.max_output_tokens ?? 8192,
		});
	}

	mergeDiscoveredModels("github-copilot", discoveredModels);
}

// ----------------------------------------------------------------------------
// Direct Anthropic: GET {baseUrl}/v1/models
// ----------------------------------------------------------------------------

interface AnthropicCapabilitySupport {
	supported?: boolean;
}
interface AnthropicModelEntry {
	id: string;
	display_name?: string;
	max_input_tokens?: number;
	max_tokens?: number;
	capabilities?: {
		thinking?: {
			supported?: boolean;
			types?: {
				adaptive?: AnthropicCapabilitySupport;
				enabled?: AnthropicCapabilitySupport;
			};
		};
		effort?: {
			supported?: boolean;
			low?: AnthropicCapabilitySupport;
			medium?: AnthropicCapabilitySupport;
			high?: AnthropicCapabilitySupport;
			max?: AnthropicCapabilitySupport;
			xhigh?: AnthropicCapabilitySupport;
		};
		image_input?: AnthropicCapabilitySupport;
	};
}

async function discoverAnthropicNative(
	baseUrl: string,
	apiKey: string,
	extraHeaders?: Record<string, string>,
): Promise<void> {
	const baseHeaders: Record<string, string> = {
		"x-api-key": apiKey,
		"anthropic-version": "2023-06-01",
		...extraHeaders,
	};

	// First, capability map from the bare /v1/models endpoint.
	const baseEntries = await fetchAnthropicModels(baseUrl, baseHeaders);
	if (!baseEntries) return;

	// Then, retry with the context-1m beta and compare max_input_tokens.
	// Models whose max_input_tokens grows with the beta need it to unlock
	// the larger window; others reject the beta or ignore it.
	const betaEntries = await fetchAnthropicModels(baseUrl, {
		...baseHeaders,
		"anthropic-beta": CONTEXT_1M_BETA_HEADER,
	});
	const betaWindowById = new Map<string, number>();
	if (betaEntries) {
		for (const entry of betaEntries) {
			if (typeof entry.max_input_tokens === "number") {
				betaWindowById.set(entry.id, entry.max_input_tokens);
			}
		}
	}

	for (const entry of baseEntries) {
		const c = entry.capabilities ?? {};
		const thinking = c.thinking ?? {};
		const types = thinking.types ?? {};
		const effort = c.effort ?? {};

		const adaptive = types.adaptive?.supported === true;
		const xhighEffort = effort.max?.supported === true || effort.xhigh?.supported === true;

		const baseWindow = entry.max_input_tokens ?? 0;
		const betaWindow = betaWindowById.get(entry.id) ?? 0;
		const wantsBeta = betaWindow > baseWindow;

		const caps: AnthropicModelCapabilities = {
			thinkingSchema: adaptive ? "adaptive" : "legacy",
		};
		if (xhighEffort) caps.xhighEffort = true;
		if (wantsBeta) {
			caps.contextBeta = CONTEXT_1M_BETA_HEADER;
			caps.contextWindow = betaWindow;
		} else if (baseWindow > 0) {
			caps.contextWindow = baseWindow;
		}

		setDiscoveredCapabilities("anthropic", entry.id, caps);
	}
}

async function fetchAnthropicModels(
	baseUrl: string,
	headers: Record<string, string>,
): Promise<AnthropicModelEntry[] | null> {
	const url = `${baseUrl.replace(/\/$/, "")}/v1/models?limit=1000`;
	const res = await fetch(url, { method: "GET", headers });
	if (!res.ok) return null;
	const body = (await res.json()) as { data?: AnthropicModelEntry[] };
	return body?.data ?? null;
}

// ----------------------------------------------------------------------------
// Registry merge
// ----------------------------------------------------------------------------

/**
 * Push freshly-discovered models into the in-memory registry via the hook
 * wired by models.ts. New ids are inserted; existing ids have their
 * capability-related fields refreshed.
 */
function mergeDiscoveredModels(provider: string, fresh: Model<Api>[]): void {
	for (const m of fresh) {
		registerModel(provider, m);
	}
}

// Registry mutation is provided by models.ts at module load time to avoid a
// circular import. Until it is wired, discovery still populates the
// capability cache but cannot publish new model ids into the registry.
const registryHookHolder: { fn: (provider: string, model: Model<Api>) => void } = { fn: () => {} };

function registerModel(provider: string, model: Model<Api>): void {
	registryHookHolder.fn(provider, model);
}

/** Not for external use: called by models.ts at module load to wire the registry hook. */
export function _setRegistryHook(hook: (provider: string, model: Model<Api>) => void): void {
	registryHookHolder.fn = hook;
}
