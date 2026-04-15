// T-112, T-113: MCP client registration + tool forwarding.

import type { McpTool } from "./serve.js";

export interface McpServerConfig {
	name: string;
	command: string;
	args?: string[];
	env?: Record<string, string>;
}

export interface McpClientRegistry {
	loadConfig(servers: McpServerConfig[]): void;
	registeredTools(): McpTool[];
	forward(toolName: string, args: unknown): Promise<unknown>;
}

export interface McpHandlerMap {
	[toolName: string]: (args: unknown) => Promise<unknown> | unknown;
}

export interface ServerSurface {
	name: string;
	tools: McpTool[];
}

export class McpClient implements McpClientRegistry {
	private servers = new Map<string, ServerSurface>();
	private handlers = new Map<string, (args: unknown) => Promise<unknown> | unknown>();

	constructor(private readonly handlerFactory?: (server: McpServerConfig) => ServerSurface) {}

	loadConfig(servers: McpServerConfig[]): void {
		for (const server of servers) {
			const surface = this.handlerFactory?.(server) ?? { name: server.name, tools: [] };
			this.servers.set(surface.name, surface);
			for (const tool of surface.tools) {
				this.handlers.set(tool.name, tool.call);
			}
		}
	}

	registeredTools(): McpTool[] {
		const out: McpTool[] = [];
		for (const s of this.servers.values()) out.push(...s.tools);
		return out.sort((a, b) => a.name.localeCompare(b.name));
	}

	async forward(toolName: string, args: unknown): Promise<unknown> {
		const h = this.handlers.get(toolName);
		if (!h) throw new McpServerMissingError(`mcp: no server for tool ${toolName}`);
		return h(args);
	}
}

export class McpServerMissingError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "McpServerMissingError";
	}
}
