// NEVER convert to top-level imports - breaks browser/Vite builds (web-ui)
let _existsSync: typeof import("node:fs").existsSync | null = null;
let _homedir: typeof import("node:os").homedir | null = null;
let _join: typeof import("node:path").join | null = null;

type DynamicImport = (specifier: string) => Promise<unknown>;

const dynamicImport: DynamicImport = (specifier) => import(specifier);
const NODE_FS_SPECIFIER = "node:" + "fs";
const NODE_OS_SPECIFIER = "node:" + "os";
const NODE_PATH_SPECIFIER = "node:" + "path";

// Eagerly load in Node.js/Bun environment only
if (typeof process !== "undefined" && (process.versions?.node || process.versions?.bun)) {
	dynamicImport(NODE_FS_SPECIFIER).then((m) => {
		_existsSync = (m as typeof import("node:fs")).existsSync;
	});
	dynamicImport(NODE_OS_SPECIFIER).then((m) => {
		_homedir = (m as typeof import("node:os")).homedir;
	});
	dynamicImport(NODE_PATH_SPECIFIER).then((m) => {
		_join = (m as typeof import("node:path")).join;
	});
}

import type { KnownProvider } from "./types.js";

let cachedVertexAdcCredentialsExists: boolean | null = null;

function hasVertexAdcCredentials(): boolean {
	if (cachedVertexAdcCredentialsExists === null) {
		// If node modules haven't loaded yet (async import race at startup),
		// return false WITHOUT caching so the next call retries once they're ready.
		// Only cache false permanently in a browser environment where fs is never available.
		if (!_existsSync || !_homedir || !_join) {
			const isNode = typeof process !== "undefined" && (process.versions?.node || process.versions?.bun);
			if (!isNode) {
				// Definitively in a browser — safe to cache false permanently
				cachedVertexAdcCredentialsExists = false;
			}
			return false;
		}

		// Check GOOGLE_APPLICATION_CREDENTIALS env var first (standard way)
		const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
		if (gacPath) {
			cachedVertexAdcCredentialsExists = _existsSync(gacPath);
		} else {
			// Fall back to default ADC path (lazy evaluation)
			cachedVertexAdcCredentialsExists = _existsSync(
				_join(_homedir(), ".config", "gcloud", "application_default_credentials.json"),
			);
		}
	}
	return cachedVertexAdcCredentialsExists;
}

/**
 * Get API key for provider from known environment variables, e.g. OPENAI_API_KEY.
 *
 * Will not return API keys for providers that require OAuth tokens.
 */
export function getEnvApiKey(provider: KnownProvider): string | undefined;
export function getEnvApiKey(provider: string): string | undefined;
export function getEnvApiKey(provider: any): string | undefined {
	// Fall back to environment variables
	if (provider === "github-copilot") {
		return process.env.COPILOT_GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
	}

	// ANTHROPIC_OAUTH_TOKEN takes precedence over ANTHROPIC_API_KEY
	if (provider === "anthropic") {
		return process.env.ANTHROPIC_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
	}

	// Vertex AI supports either an explicit API key or Application Default Credentials
	// Auth is configured via `gcloud auth application-default login`
	if (provider === "google-vertex") {
		if (process.env.GOOGLE_CLOUD_API_KEY) {
			return process.env.GOOGLE_CLOUD_API_KEY;
		}

		const hasCredentials = hasVertexAdcCredentials();
		const hasProject = !!(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT);
		const hasLocation = !!process.env.GOOGLE_CLOUD_LOCATION;

		if (hasCredentials && hasProject && hasLocation) {
			return "<authenticated>";
		}
	}

	if (provider === "amazon-bedrock") {
		// Amazon Bedrock supports multiple credential sources:
		// 1. AWS_PROFILE - named profile from ~/.aws/credentials
		// 2. AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY - standard IAM keys
		// 3. AWS_BEARER_TOKEN_BEDROCK - Bedrock API keys (bearer token)
		// 4. AWS_CONTAINER_CREDENTIALS_RELATIVE_URI - ECS task roles
		// 5. AWS_CONTAINER_CREDENTIALS_FULL_URI - ECS task roles (full URI)
		// 6. AWS_WEB_IDENTITY_TOKEN_FILE - IRSA (IAM Roles for Service Accounts)
		if (
			process.env.AWS_PROFILE ||
			(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
			process.env.AWS_BEARER_TOKEN_BEDROCK ||
			process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
			process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI ||
			process.env.AWS_WEB_IDENTITY_TOKEN_FILE
		) {
			return "<authenticated>";
		}
	}

	const envMap: Record<string, string> = {
		openai: "OPENAI_API_KEY",
		"azure-openai-responses": "AZURE_OPENAI_API_KEY",
		google: "GEMINI_API_KEY",
		groq: "GROQ_API_KEY",
		cerebras: "CEREBRAS_API_KEY",
		deepseek: "DEEPSEEK_API_KEY",
		xai: "XAI_API_KEY",
		openrouter: "OPENROUTER_API_KEY",
		"vercel-ai-gateway": "AI_GATEWAY_API_KEY",
		zai: "ZAI_API_KEY",
		mistral: "MISTRAL_API_KEY",
		minimax: "MINIMAX_API_KEY",
		"minimax-cn": "MINIMAX_CN_API_KEY",
		huggingface: "HF_TOKEN",
		opencode: "OPENCODE_API_KEY",
		"opencode-go": "OPENCODE_API_KEY",
		"kimi-coding": "KIMI_API_KEY",
	};

	const envVar = envMap[provider];
	return envVar ? process.env[envVar] : undefined;
}

export const ENV_VAR_BY_PROVIDER: Record<string, string> = {
	openai: "OPENAI_API_KEY",
	"azure-openai-responses": "AZURE_OPENAI_API_KEY",
	anthropic: "ANTHROPIC_API_KEY",
	google: "GEMINI_API_KEY",
	groq: "GROQ_API_KEY",
	cerebras: "CEREBRAS_API_KEY",
	deepseek: "DEEPSEEK_API_KEY",
	xai: "XAI_API_KEY",
	openrouter: "OPENROUTER_API_KEY",
	"vercel-ai-gateway": "AI_GATEWAY_API_KEY",
	zai: "ZAI_API_KEY",
	mistral: "MISTRAL_API_KEY",
	minimax: "MINIMAX_API_KEY",
	"minimax-cn": "MINIMAX_CN_API_KEY",
	huggingface: "HF_TOKEN",
	opencode: "OPENCODE_API_KEY",
	"opencode-go": "OPENCODE_API_KEY",
	"kimi-coding": "KIMI_API_KEY",
};

const OAUTH_PROVIDERS = new Set([
	"anthropic",
	"github-copilot",
	"google-gemini-cli",
	"google-antigravity",
	"openai-codex",
]);

export type ProviderAuthKind = "env" | "oauth" | "file" | "needs-region" | "missing";

export interface ProviderAuthStatus {
	kind: ProviderAuthKind;
	/** Short user-facing hint, e.g. "set XAI_API_KEY" or "/login anthropic". */
	hint?: string;
	/** The env var name this provider would use, if any. */
	envVar?: string;
	/** True when the agent can dispatch a request right now without further setup. */
	configured: boolean;
}

/**
 * Describe how a provider authenticates and whether the user is set up for it.
 *
 * The UI uses this to badge providers (`✓` / `🔑` / `✗` / `⚙`) and surface
 * actionable hints without having to know about every provider's idiosyncrasies.
 */
export function getProviderAuthStatus(provider: string): ProviderAuthStatus {
	if (provider === "github-copilot") {
		const token = process.env.COPILOT_GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
		if (token) return { kind: "env", configured: true, envVar: "GITHUB_TOKEN" };
		return {
			kind: "oauth",
			configured: false,
			hint: "/login github-copilot",
			envVar: "GITHUB_TOKEN",
		};
	}

	if (provider === "anthropic") {
		if (process.env.ANTHROPIC_OAUTH_TOKEN) {
			return { kind: "oauth", configured: true, envVar: "ANTHROPIC_OAUTH_TOKEN" };
		}
		if (process.env.ANTHROPIC_API_KEY) {
			return { kind: "env", configured: true, envVar: "ANTHROPIC_API_KEY" };
		}
		return {
			kind: "missing",
			configured: false,
			hint: "set ANTHROPIC_API_KEY or /login anthropic",
			envVar: "ANTHROPIC_API_KEY",
		};
	}

	if (provider === "google-vertex") {
		if (process.env.GOOGLE_CLOUD_API_KEY) {
			return { kind: "env", configured: true, envVar: "GOOGLE_CLOUD_API_KEY" };
		}
		const hasCredentials = hasVertexAdcCredentials();
		const hasProject = !!(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT);
		const hasLocation = !!process.env.GOOGLE_CLOUD_LOCATION;
		if (hasCredentials && hasProject && hasLocation) {
			return { kind: "file", configured: true };
		}
		return {
			kind: "file",
			configured: false,
			hint: "run `gcloud auth application-default login` and set GOOGLE_CLOUD_PROJECT/LOCATION",
		};
	}

	if (provider === "amazon-bedrock") {
		const hasCreds =
			process.env.AWS_PROFILE ||
			(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
			process.env.AWS_BEARER_TOKEN_BEDROCK ||
			process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
			process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI ||
			process.env.AWS_WEB_IDENTITY_TOKEN_FILE;
		if (!hasCreds) {
			return {
				kind: "missing",
				configured: false,
				hint: "set AWS_PROFILE or AWS_ACCESS_KEY_ID/SECRET",
			};
		}
		// Region is required for Bedrock. AWS SDK looks at AWS_REGION/AWS_DEFAULT_REGION
		// or the profile's `region`. We don't read the profile here; the env signal is
		// the cheap reliable check.
		if (!(process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION)) {
			return {
				kind: "needs-region",
				configured: false,
				hint: "set AWS_REGION (or configure profile region)",
			};
		}
		return { kind: "file", configured: true };
	}

	if (OAUTH_PROVIDERS.has(provider)) {
		return {
			kind: "oauth",
			configured: false,
			hint: `/login ${provider}`,
		};
	}

	const envVar = ENV_VAR_BY_PROVIDER[provider];
	if (envVar) {
		const value = process.env[envVar];
		if (value) return { kind: "env", configured: true, envVar };
		return { kind: "missing", configured: false, hint: `set ${envVar}`, envVar };
	}

	return { kind: "missing", configured: false, hint: "no known auth source" };
}
