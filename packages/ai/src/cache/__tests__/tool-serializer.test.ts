// T-005, T-006
import { describe, expect, it } from "vitest";
import { serializeToolSchemas, toolSchemaHash } from "../tool-serializer.js";

const baseTools = [
	{
		name: "bash",
		description: "Run a shell command",
		parameters: { type: "object", properties: { cmd: { type: "string" } } },
	},
	{
		name: "read",
		description: "Read a file",
		parameters: { type: "object", properties: { path: { type: "string" } } },
	},
	{
		name: "apply_sr_diff",
		description: "Exact-match search/replace edit",
		parameters: { type: "object", properties: { file: { type: "string" } } },
	},
];

describe("serializeToolSchemas", () => {
	it("produces byte-stable SHA256 across 1000 invocations", () => {
		const first = toolSchemaHash(baseTools);
		for (let i = 0; i < 1000; i++) {
			expect(toolSchemaHash(baseTools)).toBe(first);
		}
	});

	it("reordering tools at call site does not change bytes", () => {
		const a = serializeToolSchemas(baseTools);
		const shuffled = [baseTools[2], baseTools[0], baseTools[1]];
		const b = serializeToolSchemas(shuffled);
		expect(a).toBe(b);
	});

	it("editing one tool description isolates to tools-layer hash (it changes)", () => {
		const original = toolSchemaHash(baseTools);
		const edited = baseTools.map((t) =>
			t.name === "read" ? { ...t, description: "Read a file from disk" } : t,
		);
		const editedHash = toolSchemaHash(edited);
		expect(editedHash).not.toBe(original);
	});

	it("strips absolute paths and ISO timestamps from descriptions", () => {
		const tools = [
			{
				name: "log",
				description: "Written at 2025-03-15T12:34:56Z from /Users/alice/project",
				parameters: {},
			},
		];
		const json = serializeToolSchemas(tools);
		expect(json).not.toContain("2025-03-15");
		expect(json).not.toContain("/Users/alice");
		expect(json).toContain("<ts>");
		expect(json).toContain("<path>");
	});

	it("sorts object keys deeply for deterministic output", () => {
		const a = serializeToolSchemas([
			{ name: "t", description: "d", parameters: { b: 1, a: 2, nested: { z: 1, y: 2 } } },
		]);
		const b = serializeToolSchemas([
			{ name: "t", description: "d", parameters: { nested: { y: 2, z: 1 }, a: 2, b: 1 } },
		]);
		expect(a).toBe(b);
	});
});
