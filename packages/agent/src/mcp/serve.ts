// T-020: `cave mcp serve` — MCP server mode exposing built-in tool surface.
//
// Minimal JSON-RPC over stdio. Registered tools can be invoked by an MCP
// client and the result is returned. Real wire is JSON-RPC 2.0 per MCP spec.

export interface McpTool<TArgs = unknown, TResult = unknown> {
	name: string;
	description: string;
	schema: unknown;
	call(args: TArgs): Promise<TResult> | TResult;
}

export interface McpRequest {
	jsonrpc: "2.0";
	id: number | string;
	method: string;
	params?: unknown;
}

export interface McpResponse {
	jsonrpc: "2.0";
	id: number | string;
	result?: unknown;
	error?: { code: number; message: string };
}

export class McpServer {
	private readonly tools = new Map<string, McpTool>();

	register(tool: McpTool): void {
		if (this.tools.has(tool.name)) {
			throw new Error(`mcp: tool ${tool.name} already registered`);
		}
		this.tools.set(tool.name, tool);
	}

	listTools(): Array<{ name: string; description: string; schema: unknown }> {
		return [...this.tools.values()]
			.map((t) => ({ name: t.name, description: t.description, schema: t.schema }))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	async handle(req: McpRequest): Promise<McpResponse> {
		if (req.method === "tools/list") {
			return { jsonrpc: "2.0", id: req.id, result: { tools: this.listTools() } };
		}
		if (req.method === "tools/call") {
			const params = req.params as { name: string; arguments: unknown } | undefined;
			if (!params?.name) {
				return {
					jsonrpc: "2.0",
					id: req.id,
					error: { code: -32602, message: "missing tool name" },
				};
			}
			const tool = this.tools.get(params.name);
			if (!tool) {
				return {
					jsonrpc: "2.0",
					id: req.id,
					error: { code: -32601, message: `tool not found: ${params.name}` },
				};
			}
			try {
				const result = await tool.call(params.arguments);
				return { jsonrpc: "2.0", id: req.id, result };
			} catch (err) {
				return {
					jsonrpc: "2.0",
					id: req.id,
					error: {
						code: -32000,
						message: err instanceof Error ? err.message : String(err),
					},
				};
			}
		}
		return {
			jsonrpc: "2.0",
			id: req.id,
			error: { code: -32601, message: `method not found: ${req.method}` },
		};
	}
}
