// WS6: Task tool tests with a mocked spawner.
//
// We verify:
//   - parallel cap (>7 → rejected with helpful message)
//   - mode mutex (exactly one of single/parallel/chain required)
//   - single-mode end-to-end with a mocked subagent process
//   - chain-mode {previous} substitution
//   - unknown agent returns a structured error

import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_PARALLEL_SUBAGENTS } from "@cave/agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadAgentDefs } from "../src/core/agent-defs/loader.js";
import { createTaskToolDefinition, type TaskToolDetails } from "../src/core/tools/task.js";

// ─── Mocked spawner that returns a JSON-mode message_end event ─────────────

interface FakeAgentResponse {
	finalText?: string;
	exitCode?: number;
	stderr?: string;
	delayMs?: number;
}

function makeMockSpawn(responses: Record<string, FakeAgentResponse>) {
	return ((command: string, args: readonly string[]) => {
		// Find the prompt — the last positional arg (after `Task: `).
		const taskArg = args.find((a) => typeof a === "string" && a.startsWith("Task: "));
		const taskText = (taskArg ?? "").replace(/^Task: /, "");
		// Match by task substring; fall back to generic.
		let resp: FakeAgentResponse = { finalText: `echo: ${taskText}`, exitCode: 0 };
		for (const [k, v] of Object.entries(responses)) {
			if (taskText.includes(k)) {
				resp = v;
				break;
			}
		}

		const child = new EventEmitter() as ChildProcess & EventEmitter;
		const stdout = new EventEmitter();
		const stderr = new EventEmitter();
		(child as any).stdout = stdout;
		(child as any).stderr = stderr;
		(child as any).kill = () => true;
		(child as any).killed = false;

		const delay = resp.delayMs ?? 5;
		setTimeout(() => {
			if (resp.finalText) {
				const event =
					JSON.stringify({
						type: "message_end",
						message: {
							role: "assistant",
							content: [{ type: "text", text: resp.finalText }],
						},
					}) + "\n";
				stdout.emit("data", Buffer.from(event));
			}
			if (resp.stderr) {
				stderr.emit("data", Buffer.from(resp.stderr));
			}
			child.emit("close", resp.exitCode ?? 0);
		}, delay);

		return child;
	}) as any;
}

// ─── Test scaffolding ──────────────────────────────────────────────────────

let tmpRoot: string;
let cwd: string;
let userDir: string;
let packageDir: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), "cave-task-test-"));
	cwd = join(tmpRoot, "project");
	userDir = join(tmpRoot, "user-cave");
	packageDir = join(tmpRoot, "bundled-pkg");
	mkdirSync(join(cwd, ".cave", "agents"), { recursive: true });
	mkdirSync(join(userDir, "agents"), { recursive: true });
	mkdirSync(join(packageDir, "agents"), { recursive: true });

	// Seed two simple agents.
	writeFileSync(
		join(cwd, ".cave", "agents", "explore.md"),
		["---", "name: explore", "description: scout", "tools: read, grep", "---", "", "You are explore."].join("\n"),
	);
	writeFileSync(
		join(cwd, ".cave", "agents", "reviewer.md"),
		["---", "name: reviewer", "description: critique", "tools: read, grep", "---", "", "You are reviewer."].join(
			"\n",
		),
	);
});

afterEach(() => {
	if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
});

function makeTool(mockSpawn: ReturnType<typeof makeMockSpawn>) {
	return createTaskToolDefinition(cwd, {
		mockSpawn,
		// Pin loader to the test dirs so the bundled defaults don't surprise us.
		loader: () =>
			loadAgentDefs({
				cwd,
				userDir,
				packageDir,
				skipBundled: true,
			}),
	});
}

describe("Task tool — mode mutex", () => {
	it("rejects when no mode is provided", async () => {
		const tool = makeTool(makeMockSpawn({}));
		const r = await tool.execute("id-1", {} as any, undefined, undefined, undefined as any);
		const text = (r.content[0] as any).text;
		expect(text).toContain("EXACTLY one of");
		expect(text).toContain("explore");
		expect(text).toContain("reviewer");
	});

	it("rejects when two modes are provided", async () => {
		const tool = makeTool(makeMockSpawn({}));
		const r = await tool.execute(
			"id-2",
			{ agent: "explore", task: "x", tasks: [{ agent: "explore", task: "y" }] } as any,
			undefined,
			undefined,
			undefined as any,
		);
		const text = (r.content[0] as any).text;
		expect(text).toContain("EXACTLY one of");
	});
});

describe("Task tool — parallel cap (plan §6: max 7)", () => {
	it("MAX_PARALLEL_SUBAGENTS exposed by @cave/agent equals 7", () => {
		expect(MAX_PARALLEL_SUBAGENTS).toBe(7);
	});

	it("rejects more than 7 parallel tasks with a clear message", async () => {
		const tool = makeTool(makeMockSpawn({}));
		const tooMany = new Array(8).fill(0).map((_, i) => ({ agent: "explore", task: `task ${i}` }));
		const r = await tool.execute("id-3", { tasks: tooMany } as any, undefined, undefined, undefined as any);
		const text = (r.content[0] as any).text;
		expect(text).toContain("too many parallel tasks (8)");
		expect(text).toContain("Maximum is 7");
	});

	it("accepts exactly 7 parallel tasks", async () => {
		const tool = makeTool(makeMockSpawn({}));
		const seven = new Array(7).fill(0).map((_, i) => ({ agent: "explore", task: `task ${i}` }));
		const r = await tool.execute("id-4", { tasks: seven } as any, undefined, undefined, undefined as any);
		const details = r.details as TaskToolDetails;
		expect(details.results).toHaveLength(7);
		expect(details.results.every((x) => x.exitCode === 0)).toBe(true);
	});
});

describe("Task tool — single-mode happy path (mocked LLM)", () => {
	it("invokes the agent and returns the final text", async () => {
		const mock = makeMockSpawn({ "explore me": { finalText: "## Files\n- foo.ts:1-10", exitCode: 0 } });
		const tool = makeTool(mock);
		const r = await tool.execute(
			"id-single",
			{ agent: "explore", task: "explore me" } as any,
			undefined,
			undefined,
			undefined as any,
		);
		const text = (r.content[0] as any).text;
		expect(text).toContain("## Files");
		const details = r.details as TaskToolDetails;
		expect(details.mode).toBe("single");
		expect(details.results).toHaveLength(1);
		expect(details.results[0].agent).toBe("explore");
		expect(details.results[0].exitCode).toBe(0);
	});

	it("returns a structured error for unknown agent", async () => {
		const tool = makeTool(makeMockSpawn({}));
		const r = await tool.execute(
			"id-unknown",
			{ agent: "ghost", task: "hello" } as any,
			undefined,
			undefined,
			undefined as any,
		);
		const details = r.details as TaskToolDetails;
		expect(details.results[0].exitCode).toBe(1);
		expect(details.results[0].error).toContain('Unknown agent "ghost"');
	});
});

describe("Task tool — chain-mode with {previous} substitution", () => {
	it("threads each step's output into the next via {previous}", async () => {
		const calls: string[] = [];
		const mock = ((command: string, args: readonly string[]) => {
			const taskArg = args.find((a) => typeof a === "string" && a.startsWith("Task: ")) ?? "";
			const taskText = (taskArg as string).replace(/^Task: /, "");
			calls.push(taskText);

			const child = new EventEmitter() as any;
			const stdout = new EventEmitter();
			const stderr = new EventEmitter();
			child.stdout = stdout;
			child.stderr = stderr;
			child.kill = () => true;
			child.killed = false;

			setTimeout(() => {
				const text = `<from-${calls.length - 1}>${taskText}</from-${calls.length - 1}>`;
				stdout.emit(
					"data",
					Buffer.from(
						JSON.stringify({
							type: "message_end",
							message: { role: "assistant", content: [{ type: "text", text }] },
						}) + "\n",
					),
				);
				child.emit("close", 0);
			}, 5);
			return child;
		}) as any;

		const tool = makeTool(mock);
		const r = await tool.execute(
			"id-chain",
			{
				chain: [
					{ agent: "explore", task: "step one" },
					{ agent: "reviewer", task: "review {previous}" },
				],
			} as any,
			undefined,
			undefined,
			undefined as any,
		);
		const details = r.details as TaskToolDetails;
		expect(details.mode).toBe("chain");
		expect(details.results).toHaveLength(2);
		// The second call's task text must include the first call's response.
		expect(calls[1]).toContain("review <from-0>step one</from-0>");
	});
});
