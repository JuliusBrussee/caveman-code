// T-020, T-021
import { describe, expect, it } from "vitest";
import { AcpSession, McpServer, type McpTool } from "../mcp/index.js";

const echoTool: McpTool<{ text: string }, { text: string }> = {
	name: "echo",
	description: "echo back",
	schema: { type: "object", properties: { text: { type: "string" } } },
	call: (args) => ({ text: args.text }),
};

describe("McpServer", () => {
	it("lists registered tools in sorted order", () => {
		const s = new McpServer();
		s.register(echoTool);
		s.register({ ...echoTool, name: "alpha" });
		const tools = s.listTools();
		expect(tools.map((t) => t.name)).toEqual(["alpha", "echo"]);
	});

	it("calls a registered tool via tools/call", async () => {
		const s = new McpServer();
		s.register(echoTool);
		const resp = await s.handle({
			jsonrpc: "2.0",
			id: 1,
			method: "tools/call",
			params: { name: "echo", arguments: { text: "hi" } },
		});
		expect(resp.result).toEqual({ text: "hi" });
		expect(resp.error).toBeUndefined();
	});

	it("returns error for unknown tool", async () => {
		const s = new McpServer();
		const resp = await s.handle({
			jsonrpc: "2.0",
			id: 2,
			method: "tools/call",
			params: { name: "missing", arguments: {} },
		});
		expect(resp.error?.code).toBe(-32601);
	});

	it("lists tools via tools/list method", async () => {
		const s = new McpServer();
		s.register(echoTool);
		const resp = await s.handle({ jsonrpc: "2.0", id: 3, method: "tools/list" });
		expect((resp.result as { tools: unknown[] }).tools).toHaveLength(1);
	});
});

describe("AcpSession", () => {
	it("initializes and returns capabilities", () => {
		const s = new AcpSession();
		const r = s.initialize({ method: "initialize", params: { clientVersion: "1" } });
		expect(r.capabilities.streaming).toBe(true);
		expect(r.capabilities.toolCalls).toBe(true);
		expect(s.isInitialized()).toBe(true);
	});

	it("streams chunks after init", () => {
		const s = new AcpSession();
		s.initialize({ method: "initialize", params: { clientVersion: "1" } });
		const c = s.streamChunk("hello", false);
		expect(c.params.text).toBe("hello");
		expect(c.params.done).toBe(false);
	});

	it("rejects streaming before init", () => {
		const s = new AcpSession();
		expect(() => s.streamChunk("x", true)).toThrow(/not initialized/);
	});

	it("forwards tool calls via handler", async () => {
		const s = new AcpSession();
		s.initialize({ method: "initialize", params: { clientVersion: "1" } });
		const r = await s.forwardTool(
			{ method: "tool/call", params: { name: "t", arguments: { v: 1 } } },
			async (name, args) => `${name}:${JSON.stringify(args)}`,
		);
		expect(r.result).toBe('t:{"v":1}');
	});

	it("captures tool handler errors into error field", async () => {
		const s = new AcpSession();
		s.initialize({ method: "initialize", params: { clientVersion: "1" } });
		const r = await s.forwardTool(
			{ method: "tool/call", params: { name: "boom", arguments: {} } },
			async () => {
				throw new Error("nope");
			},
		);
		expect(r.error).toBe("nope");
	});
});
