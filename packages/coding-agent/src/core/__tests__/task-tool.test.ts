/**
 * WS6 Task tool — end-to-end smoke. Verifies the subagent spawn → JSON-mode
 * parse → fold-back loop without spawning a real `cave` subprocess.
 */

import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import type { LoadAgentDefsResult } from "../agent-defs/loader.js";
import { createTaskToolDefinition } from "../tools/task.js";

function fakeChild(jsonLines: string[], exitCode = 0): any {
	const child = new EventEmitter() as any;
	child.stdout = Readable.from(jsonLines.map((l) => `${l}\n`));
	child.stderr = Readable.from([]);
	child.killed = false;
	child.kill = () => {
		child.killed = true;
	};
	// Emit close after stdout drains. EventEmitter doesn't await, so schedule
	// via setImmediate so the consumer sees stdout first.
	setImmediate(() => child.emit("close", exitCode));
	return child;
}

const stubLoaded: LoadAgentDefsResult = {
	agents: [
		{
			def: {
				name: "tester",
				description: "Test agent",
				prompt: "You are a tester.",
				tools: ["read"],
				model: undefined,
				isolation: "none",
				source: "user",
				filePath: "<test:tester>",
			},
			sourceInfo: {
				path: "<test:tester>",
				metadata: { source: "synthetic", scope: "user", origin: "synthetic" },
			} as any,
		},
	],
	diagnostics: [],
};

describe("WS6 Task tool", () => {
	it("single mode: spawns subagent, captures final assistant text, returns it", async () => {
		const mockSpawn = (() =>
			fakeChild([
				JSON.stringify({
					type: "message_end",
					message: {
						role: "assistant",
						content: [{ type: "text", text: "hello from subagent" }],
					},
				}),
			])) as any;

		const tool = createTaskToolDefinition(process.cwd(), {
			caveBin: "cave",
			mockSpawn,
			loader: () => stubLoaded,
		});

		const result = await tool.execute("call-1", { agent: "tester", task: "say hi" }, undefined, undefined, {} as any);

		expect(result.content[0]).toMatchObject({ type: "text", text: "hello from subagent" });
		expect(result.details?.mode).toBe("single");
		expect(result.details?.results).toHaveLength(1);
		expect(result.details?.results[0]?.exitCode).toBe(0);
	});

	it("rejects unknown agent with available list", async () => {
		const tool = createTaskToolDefinition(process.cwd(), {
			caveBin: "cave",
			mockSpawn: (() => fakeChild([], 1)) as any,
			loader: () => stubLoaded,
		});

		const result = await tool.execute("call-2", { agent: "nonexistent", task: "x" }, undefined, undefined, {} as any);

		const text = result.content[0]?.type === "text" ? result.content[0].text : "";
		expect(text).toContain("Subagent failed");
		expect(text).toContain("Unknown agent");
		expect(text).toContain("tester");
	});
});
