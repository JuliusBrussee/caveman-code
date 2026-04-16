// Token verification for cross-agent benchmarks.
//
// Two strategies live here:
//
//   (a) tokenizerRecount — re-tokenize the captured transcript independently
//       (tiktoken for OpenAI models, Anthropic count_tokens endpoint for Claude
//       models). Used in subscription mode where provider Usage APIs cannot see
//       plan traffic. Tolerance: 5%.
//
//   (b) usageApiQuery — query the provider Usage API for the run window and
//       compare against CLI-reported totals. Used in API-key mode where the
//       provider sees every call. Tolerance: 2%.
//
// Both return a delta-percent vs CLI-event totals; emits a warning when over
// tolerance. The runner records the delta on each AgentRunRecord and the
// comparison table flags rows that exceed the per-mode tolerance.

export type TokenizerProvider = "openai" | "anthropic";

export type AuthMode = "subscription" | "api-key";

export interface TranscriptTurn {
	role: "system" | "user" | "assistant" | "tool";
	content: string;
}

export interface TokenizerRecountInput {
	provider: TokenizerProvider;
	model: string;
	transcript: TranscriptTurn[];
	/** Bearer token for the Anthropic count_tokens endpoint. */
	anthropicApiKey?: string;
}

export interface UsageApiQueryInput {
	provider: TokenizerProvider;
	apiKey: string;
	windowStart: Date;
	windowEnd: Date;
	model?: string;
}

export interface VerificationResult {
	/** Sum of input + output tokens reported by the verifier. */
	verifiedTotalTokens: number;
	/** |verified - cli| / cli, percent. */
	deltaPct: number;
	/** True if delta is within tolerance for this auth mode. */
	withinTolerance: boolean;
	/** Strategy used to obtain the verification number. */
	strategy: "tokenizer-recount" | "usage-api";
	/** Raw breakdown from the verifier when available. */
	breakdown?: { input?: number; output?: number };
	/** Human-readable warning when out of tolerance. */
	warning?: string;
}

export const TOLERANCES: Record<AuthMode, number> = {
	// Tokenizer recount can't see hidden system prompts, so subscription mode
	// runs with a looser band.
	subscription: 0.05,
	// API-key mode is billing-API-grade — anything over 2% means a parser bug.
	"api-key": 0.02,
};

// ---------------------------------------------------------------------------
// (a) tokenizer recount
// ---------------------------------------------------------------------------

/**
 * Independent re-tokenization of a captured transcript. Runtime imports
 * tiktoken / @anthropic-ai/sdk dynamically so the agent package keeps a
 * dependency-free build; callers (the runner) install the optional deps.
 *
 * @param cliReportedTotal total tokens (input + output) reported by the CLI
 */
export async function tokenizerRecount(
	input: TokenizerRecountInput,
	cliReportedTotal: number,
	mode: AuthMode = "subscription",
): Promise<VerificationResult> {
	let verifiedTotalTokens = 0;
	let breakdown: VerificationResult["breakdown"] | undefined;

	if (input.provider === "openai") {
		const tk = await loadTiktoken();
		const encoder = tk.encodingForModel(input.model);
		try {
			let inputCount = 0;
			let outputCount = 0;
			for (const turn of input.transcript) {
				const ids = encoder.encode(turn.content);
				if (turn.role === "assistant") {
					outputCount += ids.length;
				} else {
					inputCount += ids.length;
				}
			}
			verifiedTotalTokens = inputCount + outputCount;
			breakdown = { input: inputCount, output: outputCount };
		} finally {
			encoder.free();
		}
	} else {
		// Anthropic: use the count_tokens endpoint. Send the transcript as
		// chat messages and a single accumulated count.
		if (!input.anthropicApiKey) {
			throw new Error("Anthropic count_tokens requires anthropicApiKey");
		}
		const Anthropic = await loadAnthropic();
		const client = new Anthropic({ apiKey: input.anthropicApiKey });
		const messages = input.transcript
			.filter((t) => t.role !== "system")
			.map((t) => ({
				role: t.role === "assistant" ? "assistant" : "user",
				content: t.content,
			}));
		const system = input.transcript.find((t) => t.role === "system")?.content;
		const resp = await client.messages.countTokens({
			model: input.model,
			messages,
			...(system ? { system } : {}),
		});
		verifiedTotalTokens = resp.input_tokens ?? 0;
		breakdown = { input: resp.input_tokens };
	}

	return summarize(verifiedTotalTokens, cliReportedTotal, mode, "tokenizer-recount", breakdown);
}

// ---------------------------------------------------------------------------
// (b) provider Usage API query
// ---------------------------------------------------------------------------

/**
 * Provider-side verification for API-key-mode runs only. Returns the total
 * tokens billed in the [windowStart, windowEnd] window and the delta vs the
 * CLI-reported total.
 */
export async function usageApiQuery(
	input: UsageApiQueryInput,
	cliReportedTotal: number,
	mode: AuthMode = "api-key",
): Promise<VerificationResult> {
	let verifiedTotalTokens = 0;
	let breakdown: VerificationResult["breakdown"] | undefined;

	if (input.provider === "openai") {
		// Org-level Usage API. Endpoint: GET /v1/organization/usage/completions
		// with start_time/end_time epoch seconds. Aggregates across keys; pin
		// the eval to a dedicated key + dedicated org for clean attribution.
		const start = Math.floor(input.windowStart.getTime() / 1000);
		const end = Math.floor(input.windowEnd.getTime() / 1000);
		const url = new URL("https://api.openai.com/v1/organization/usage/completions");
		url.searchParams.set("start_time", String(start));
		url.searchParams.set("end_time", String(end));
		if (input.model) url.searchParams.set("model", input.model);

		const resp = await fetch(url, {
			headers: { Authorization: `Bearer ${input.apiKey}` },
		});
		if (!resp.ok) {
			throw new Error(`OpenAI usage API ${resp.status}: ${await resp.text()}`);
		}
		const json = (await resp.json()) as {
			data?: Array<{
				results?: Array<{ input_tokens?: number; output_tokens?: number }>;
			}>;
		};
		let inputCount = 0;
		let outputCount = 0;
		for (const bucket of json.data ?? []) {
			for (const row of bucket.results ?? []) {
				inputCount += row.input_tokens ?? 0;
				outputCount += row.output_tokens ?? 0;
			}
		}
		verifiedTotalTokens = inputCount + outputCount;
		breakdown = { input: inputCount, output: outputCount };
	} else {
		// Anthropic Admin Usage API. Endpoint: GET /v1/organizations/usage_report/messages
		// gated by an admin key.
		const url = new URL("https://api.anthropic.com/v1/organizations/usage_report/messages");
		url.searchParams.set("starting_at", input.windowStart.toISOString());
		url.searchParams.set("ending_at", input.windowEnd.toISOString());
		if (input.model) url.searchParams.set("models[]", input.model);

		const resp = await fetch(url, {
			headers: {
				"x-api-key": input.apiKey,
				"anthropic-version": "2023-06-01",
			},
		});
		if (!resp.ok) {
			throw new Error(`Anthropic usage API ${resp.status}: ${await resp.text()}`);
		}
		const json = (await resp.json()) as {
			data?: Array<{
				input_tokens?: number;
				output_tokens?: number;
				cache_read_input_tokens?: number;
				cache_creation_input_tokens?: number;
			}>;
		};
		let inputCount = 0;
		let outputCount = 0;
		for (const row of json.data ?? []) {
			inputCount +=
				(row.input_tokens ?? 0) + (row.cache_read_input_tokens ?? 0) + (row.cache_creation_input_tokens ?? 0);
			outputCount += row.output_tokens ?? 0;
		}
		verifiedTotalTokens = inputCount + outputCount;
		breakdown = { input: inputCount, output: outputCount };
	}

	return summarize(verifiedTotalTokens, cliReportedTotal, mode, "usage-api", breakdown);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function summarize(
	verifiedTotalTokens: number,
	cliReportedTotal: number,
	mode: AuthMode,
	strategy: VerificationResult["strategy"],
	breakdown?: VerificationResult["breakdown"],
): VerificationResult {
	const cli = Math.max(cliReportedTotal, 1);
	const deltaPct = Math.abs(verifiedTotalTokens - cliReportedTotal) / cli;
	const tolerance = TOLERANCES[mode];
	const withinTolerance = deltaPct <= tolerance;
	return {
		verifiedTotalTokens,
		deltaPct,
		withinTolerance,
		strategy,
		breakdown,
		warning: withinTolerance
			? undefined
			: `token verification delta ${(deltaPct * 100).toFixed(1)}% exceeds ${(tolerance * 100).toFixed(0)}% (${strategy}, mode=${mode})`,
	};
}

interface TiktokenLike {
	encodingForModel(model: string): { encode(s: string): number[]; free(): void };
}

async function loadTiktoken(): Promise<TiktokenLike> {
	try {
		// @ts-expect-error optional peer dep — install with `npm i tiktoken`.
		const mod = (await import("tiktoken")) as unknown as TiktokenLike & {
			default?: TiktokenLike;
		};
		return mod.default ?? mod;
	} catch {
		throw new Error("tokenizerRecount(openai) requires the 'tiktoken' package. Install with: npm i tiktoken");
	}
}

interface AnthropicCtor {
	new (opts: {
		apiKey: string;
	}): {
		messages: {
			countTokens(req: {
				model: string;
				messages: Array<{ role: string; content: string }>;
				system?: string;
			}): Promise<{ input_tokens?: number }>;
		};
	};
}

async function loadAnthropic(): Promise<AnthropicCtor> {
	try {
		// @ts-expect-error optional peer dep — install with `npm i @anthropic-ai/sdk`.
		const mod = (await import("@anthropic-ai/sdk")) as unknown as {
			default: AnthropicCtor;
			Anthropic?: AnthropicCtor;
		};
		return mod.Anthropic ?? mod.default;
	} catch {
		throw new Error(
			"tokenizerRecount(anthropic) requires the '@anthropic-ai/sdk' package. Install with: npm i @anthropic-ai/sdk",
		);
	}
}
