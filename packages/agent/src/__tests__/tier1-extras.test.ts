// T-078..T-082, T-112..T-117, T-118..T-130 (data-layer subset)
import { describe, expect, it } from "vitest";
import {
	applyEscape,
	type EscapeRequest,
} from "../sandbox/types.js";
import {
	McpClient,
	McpServerMissingError,
	type McpServerConfig,
	type ServerSurface,
} from "../mcp/index.js";
import { LLMLinguaMiddleware } from "../compression/index.js";
import {
	compressionFallbackEvent,
	safeCompress,
} from "../compression/fallback.js";
import { DEFAULT_PRICING } from "../cost/index.js";

// ─── Sandbox allow + escape (T-115, T-116) ────────────────────────────────

describe("sandbox.allow escape", () => {
	it("escape rejected leaves base allow unchanged", () => {
		const base = { writes: ["/a"] };
		const req: EscapeRequest = { kind: "write", path: "/b", reason: "test" };
		const merged = applyEscape(base, req, () => false);
		expect(merged.writes).toEqual(["/a"]);
	});

	it("escape confirmed adds path to writes allow", () => {
		const base = { writes: ["/a"] };
		const merged = applyEscape(
			base,
			{ kind: "write", path: "/b", reason: "test" },
			() => true,
		);
		expect(merged.writes).toEqual(["/a", "/b"]);
	});

	it("escape confirmed enables network when requested", () => {
		const merged = applyEscape(
			{},
			{ kind: "network", reason: "fetch api" },
			() => true,
		);
		expect(merged.network).toBe(true);
	});
});

// ─── MCP client (T-112, T-113, T-114) ──────────────────────────────────────

describe("McpClient", () => {
	const serverConfigs: McpServerConfig[] = [
		{ name: "fs-server", command: "mcp-fs" },
		{ name: "git-server", command: "mcp-git" },
	];

	it("loads config and exposes tools in sorted order", () => {
		const client = new McpClient((server): ServerSurface => ({
			name: server.name,
			tools: [
				{
					name: `${server.name}-tool`,
					description: `tool from ${server.name}`,
					schema: {},
					call: async () => ({ ok: true }),
				},
			],
		}));
		client.loadConfig(serverConfigs);
		const tools = client.registeredTools();
		expect(tools.map((t) => t.name)).toEqual(["fs-server-tool", "git-server-tool"]);
	});

	it("forwards tool call to registered handler", async () => {
		const client = new McpClient((server): ServerSurface => ({
			name: server.name,
			tools: [
				{
					name: "ping",
					description: "",
					schema: {},
					call: async () => "pong",
				},
			],
		}));
		client.loadConfig([{ name: "s", command: "c" }]);
		const r = await client.forward("ping", {});
		expect(r).toBe("pong");
	});

	it("throws McpServerMissingError for unknown tool", async () => {
		const client = new McpClient();
		client.loadConfig([]);
		await expect(client.forward("missing", {})).rejects.toBeInstanceOf(
			McpServerMissingError,
		);
	});
});

// ─── Compression fallback (T-117) ──────────────────────────────────────────

describe("compression fallback", () => {
	it("passthrough when attempt throws, emits fallback reason", () => {
		const r = safeCompress(
			() => {
				throw new Error("onnx missing");
			},
			"original",
			"llmlingua-2",
		);
		expect(r.result).toBe("original");
		expect(r.fallback?.middleware).toBe("llmlingua-2");
		expect(r.fallback?.cause).toBe("inference_error");
	});

	it("successful attempt returns result without fallback", () => {
		const r = safeCompress(() => "compressed", "original", "llmlingua-2");
		expect(r.result).toBe("compressed");
		expect(r.fallback).toBeUndefined();
	});

	it("compressionFallbackEvent shape is a TraceEvent", () => {
		const ev = compressionFallbackEvent(
			{ middleware: "llmlingua-2", cause: "model_missing" },
			0,
			1,
			1_000,
		);
		expect(ev.type).toBe("compression_fallback");
		expect(ev.seq).toBe(1);
		expect(ev.payload).toMatchObject({ cause: "model_missing" });
	});
});

// ─── Compression opt-in & tool/system bytes unchanged (T-078..T-080) ──────

describe("compression opt-in (T-078, T-079, T-080)", () => {
	it("activation threshold bypass is deterministic (T-079 determinism)", () => {
		const m = new LLMLinguaMiddleware();
		const input = "small";
		const a = m.compress(input, { targetRatio: 0.5, activationThreshold: 100 }).bytes;
		const b = m.compress(input, { targetRatio: 0.5, activationThreshold: 100 }).bytes;
		expect(a).toBe(b);
		expect(a).toBe(input); // passthrough
	});

	it("tool bytes never compressed (caller-level T-080 contract)", () => {
		// Contract: callers pass tools/system/user-typed blocks with
		// activationThreshold = Infinity to guarantee passthrough. Here we
		// exercise the guarantee: infinite threshold is always passthrough.
		const m = new LLMLinguaMiddleware();
		const r = m.compress("tool block " + "x".repeat(5000), {
			targetRatio: 0.5,
			activationThreshold: Number.POSITIVE_INFINITY,
		});
		expect(r.compressed).toBe(false);
		expect(r.via).toBe("passthrough");
	});
});

// ─── Pricing / bench readiness quick checks ───────────────────────────────

describe("bench readiness (T-132 seed)", () => {
	it("DEFAULT_PRICING covers claude + gpt families for bench cost caps", () => {
		expect(DEFAULT_PRICING["claude-opus-4-6"]).toBeDefined();
		expect(DEFAULT_PRICING["claude-sonnet-4-6"]).toBeDefined();
		expect(DEFAULT_PRICING["claude-haiku-4-5"]).toBeDefined();
		expect(DEFAULT_PRICING["gpt-5"]).toBeDefined();
	});
});
