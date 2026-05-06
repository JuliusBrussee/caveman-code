// types.ts — Cave MCP integration types.
//
// Schema notes:
//   The McpServerConfig shape is byte-compatible with Claude Code's
//   `~/.claude/mcp.json` and Codex's `~/.codex/mcp.json` so a user can paste
//   an existing config in unchanged. We accept (and ignore) extra fields the
//   user may pass through.
//

export type McpTransportKind = "stdio" | "http" | "inproc";

/** OAuth 2.1 + PKCE config (matches pi-mcp-adapter shape). */
export interface McpOAuthConfig {
	grantType?: "authorization_code" | "client_credentials";
	clientId?: string;
	clientSecret?: string;
	scope?: string;
}

/**
 * Single MCP server entry. Byte-compat with Claude Code / Codex format.
 * Either (command, args?, env?) for stdio, or (url, headers?) for HTTP, or
 * (transport: "inproc") for in-process servers.
 */
export interface McpServerConfig {
	name: string;
	transport?: McpTransportKind;

	// stdio
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	cwd?: string;

	// HTTP / Streamable HTTP
	url?: string;
	headers?: Record<string, string>;

	// auth
	auth?: "oauth" | "bearer" | false;
	bearerToken?: string;
	bearerTokenEnv?: string;
	oauth?: McpOAuthConfig | false;

	// lifecycle
	lifecycle?: "keep-alive" | "lazy" | "eager";
	idleTimeout?: number;

	// toolset filtering
	excludeTools?: string[];

	debug?: boolean;
}

/**
 * Top-level MCP config file shape. Format matches Claude Code's
 * `~/.claude/mcp.json` and Codex's `~/.codex/mcp.json`.
 *
 * Project-level `.mcp.json` and user-level `~/.cave/mcp.json` both use this.
 */
export interface McpConfigFile {
	mcpServers?: Record<string, Omit<McpServerConfig, "name">>;
	settings?: McpSettings;
}

export interface McpSettings {
	toolPrefix?: "server" | "none" | "short";
	idleTimeout?: number;
	deferSchemas?: boolean;
}

/** A single tool exposed by a connected MCP server. */
export interface McpRemoteTool {
	name: string;
	namespacedName: string;
	server: string;
	title?: string;
	description?: string;
	inputSchema?: unknown;
}

/**
 * Transport abstraction. Implementations: stdio (subprocess+JSON-RPC),
 * inproc (zero-spawn for cave's own tools), http (Streamable HTTP — stub).
 */
export interface McpTransport {
	readonly kind: McpTransportKind;
	connect(): Promise<void>;
	listTools(): Promise<McpRemoteTool[]>;
	callTool(name: string, args: unknown): Promise<unknown>;
	close(): Promise<void>;
	isConnected(): boolean;
}

/** Server health snapshot used by `cave mcp doctor`. */
export interface McpServerHealth {
	name: string;
	transport: McpTransportKind;
	reachable: boolean;
	tools: number;
	error?: string;
	authStatus?: "ok" | "missing" | "expired" | "n/a";
	source?: "project" | "user";
}
