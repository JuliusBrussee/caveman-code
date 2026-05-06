/**
 * Regression tests for the subagent wiring (WS6).
 *
 * Pre-fix bugs these guard against:
 *   1. `task`/`agent` tools were loaded into the registry but absent from the
 *      default active-tools list, so the model never saw them.
 *   2. The Task tool falls back to the parent's model when the agent's
 *      pinned model is unauthed in the current environment.
 */

import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import type { LoadAgentDefsResult } from "../agent-defs/loader.js";
import { allToolDefinitions, allTools } from "../tools/index.js";
import { createTaskToolDefinition } from "../tools/task.js";

describe("WS6 subagent wiring", () => {
	it("task and agent tools are present in the registry maps", () => {
		expect(allTools.task).toBeDefined();
		expect(allTools.agent).toBeDefined();
		expect(allToolDefinitions.task.name).toBe("task");
		expect(allToolDefinitions.agent.name).toBe("agent");
	});

	it("Task tool falls back to parent's model when agent's model is unauthed", async () => {
		const stub: LoadAgentDefsResult = {
			agents: [
				{
					def: {
						name: "fancy",
						description: "Pinned to a Claude tier",
						prompt: "You are fancy.",
						model: "claude-sonnet-4-5",
						source: "user",
						filePath: "<test:fancy>",
					},
					sourceInfo: { path: "<test:fancy>", metadata: { source: "synthetic", scope: "user" } } as any,
				},
			],
			diagnostics: [],
		};
		let capturedArgs: string[] = [];
		const mockSpawn = ((_cmd: string, args: string[]) => {
			capturedArgs = args;
			const child = new EventEmitter() as any;
			child.stdout = Readable.from([
				`${JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "ok" }] } })}\n`,
			]);
			child.stderr = Readable.from([]);
			child.killed = false;
			child.kill = () => {
				child.killed = true;
			};
			setImmediate(() => child.emit("close", 0));
			return child;
		}) as any;

		const tool = createTaskToolDefinition(process.cwd(), {
			caveBin: "cave",
			mockSpawn,
			loader: () => stub,
			// Simulate: parent has no auth for claude-sonnet-4-5, but is running on
			// a different provider (e.g. zai/glm-4.6).
			resolveModel: (agentModel) => (agentModel === "claude-sonnet-4-5" ? "zai/glm-4.6" : agentModel),
		});

		const result = await tool.execute("call-1", { agent: "fancy", task: "x" }, undefined, undefined, {} as any);
		expect(result.details?.results[0]?.exitCode).toBe(0);
		// The spawned cave got the parent's model, not the agent's pinned model.
		const modelIdx = capturedArgs.indexOf("--model");
		expect(modelIdx).toBeGreaterThan(-1);
		expect(capturedArgs[modelIdx + 1]).toBe("zai/glm-4.6");
	});

	it("Task tool refuses recursion past CAVE_SUBAGENT_DEPTH cap", async () => {
		const stub: LoadAgentDefsResult = {
			agents: [
				{
					def: {
						name: "any",
						description: "x",
						prompt: "x",
						source: "user",
						filePath: "<test:any>",
					},
					sourceInfo: { path: "<test:any>", metadata: { source: "synthetic", scope: "user" } } as any,
				},
			],
			diagnostics: [],
		};
		const tool = createTaskToolDefinition(process.cwd(), {
			caveBin: "cave",
			mockSpawn: (() => {
				throw new Error("should never spawn");
			}) as any,
			loader: () => stub,
		});
		const prev = process.env.CAVE_SUBAGENT_DEPTH;
		process.env.CAVE_SUBAGENT_DEPTH = "9";
		try {
			const result = await tool.execute("call-1", { agent: "any", task: "x" }, undefined, undefined, {} as any);
			const text = result.content[0]?.type === "text" ? result.content[0].text : "";
			expect(text).toContain("recursion depth");
			expect(text).toContain("cap");
		} finally {
			if (prev === undefined) delete process.env.CAVE_SUBAGENT_DEPTH;
			else process.env.CAVE_SUBAGENT_DEPTH = prev;
		}
	});

	it("Task tool passes --thinking when agent.effort is a valid level", async () => {
		const stub: LoadAgentDefsResult = {
			agents: [
				{
					def: {
						name: "thinker",
						description: "x",
						prompt: "x",
						effort: "high",
						source: "user",
						filePath: "<test:thinker>",
					},
					sourceInfo: { path: "<test:thinker>", metadata: { source: "synthetic", scope: "user" } } as any,
				},
			],
			diagnostics: [],
		};
		let capturedArgs: string[] = [];
		const mockSpawn = ((_cmd: string, args: string[]) => {
			capturedArgs = args;
			const child = new EventEmitter() as any;
			child.stdout = Readable.from([
				`${JSON.stringify({ type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "ok" }] } })}\n`,
			]);
			child.stderr = Readable.from([]);
			child.killed = false;
			child.kill = () => {
				child.killed = true;
			};
			setImmediate(() => child.emit("close", 0));
			return child;
		}) as any;
		const tool = createTaskToolDefinition(process.cwd(), {
			caveBin: "cave",
			mockSpawn,
			loader: () => stub,
		});
		await tool.execute("call-1", { agent: "thinker", task: "x" }, undefined, undefined, {} as any);
		const idx = capturedArgs.indexOf("--thinking");
		expect(idx).toBeGreaterThan(-1);
		expect(capturedArgs[idx + 1]).toBe("high");
	});
});
