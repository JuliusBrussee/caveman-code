// T-021: ACP (Agent Client Protocol) handshake, message streaming, tool-call forwarding.
//
// ACP is Zed's protocol for external agents. Handshake is a single
// "initialize" exchange declaring capabilities; then messages stream via
// "message/stream" notifications and tool calls flow via "tool/call".

export interface AcpCapabilities {
	streaming: boolean;
	toolCalls: boolean;
	version: string;
}

export interface AcpInitializeRequest {
	method: "initialize";
	params: { clientVersion: string };
}

export interface AcpInitializeResponse {
	capabilities: AcpCapabilities;
	serverVersion: string;
}

export interface AcpStreamChunk {
	method: "message/stream";
	params: { text: string; done: boolean };
}

export interface AcpToolCall {
	method: "tool/call";
	params: { name: string; arguments: unknown };
}

export interface AcpToolResult {
	result: unknown;
	error?: string;
}

export class AcpSession {
	private initialized = false;

	initialize(req: AcpInitializeRequest): AcpInitializeResponse {
		if (req.method !== "initialize") {
			throw new Error(`acp: expected initialize, got ${req.method}`);
		}
		this.initialized = true;
		return {
			serverVersion: "cave-acp/1.0",
			capabilities: { streaming: true, toolCalls: true, version: "1.0" },
		};
	}

	streamChunk(text: string, done: boolean): AcpStreamChunk {
		this.requireInit();
		return { method: "message/stream", params: { text, done } };
	}

	async forwardTool(
		call: AcpToolCall,
		handler: (name: string, args: unknown) => Promise<unknown>,
	): Promise<AcpToolResult> {
		this.requireInit();
		try {
			const result = await handler(call.params.name, call.params.arguments);
			return { result };
		} catch (err) {
			return { result: null, error: err instanceof Error ? err.message : String(err) };
		}
	}

	isInitialized(): boolean {
		return this.initialized;
	}

	private requireInit(): void {
		if (!this.initialized) throw new Error("acp: session not initialized");
	}
}
