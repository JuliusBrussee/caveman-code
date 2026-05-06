// Tests for the native memory_search / memory_save tools (WS7).

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memory } from "@cave/agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemorySaveToolDefinition, createMemorySearchToolDefinition } from "../tools/memory.js";

const { FilesProvider } = memory;

function execCtx() {
	return {} as Parameters<ReturnType<typeof createMemorySearchToolDefinition>["execute"]>[4];
}

describe("memory tools (native)", () => {
	let cwd: string;
	let provider: InstanceType<typeof FilesProvider>;

	beforeEach(() => {
		cwd = mkdtempSync(join(tmpdir(), "cave-memtools-"));
		provider = new FilesProvider({ memoryDir: join(cwd, ".cave", "memory") });
	});

	afterEach(() => {
		try {
			rmSync(cwd, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
	});

	it("memory_save persists a fact and memory_search retrieves it", async () => {
		const saveDef = createMemorySaveToolDefinition(provider);
		const searchDef = createMemorySearchToolDefinition(provider);

		const saved = await saveDef.execute(
			"call-1",
			{ content: "the magic word is xyzzy" },
			undefined,
			undefined,
			execCtx(),
		);
		expect(saved.details?.available).toBe(true);
		const text = (saved.content[0] as { text: string }).text;
		expect(text).toMatch(/Saved/);

		const searched = await searchDef.execute("call-2", { query: "xyzzy" }, undefined, undefined, execCtx());
		expect(searched.details?.available).toBe(true);
		expect(searched.details?.hitCount).toBeGreaterThan(0);
		const out = (searched.content[0] as { text: string }).text;
		expect(out).toContain("xyzzy");
	});

	it("memory_search reports zero hits cleanly", async () => {
		const searchDef = createMemorySearchToolDefinition(provider);
		const r = await searchDef.execute(
			"call-3",
			{ query: "absolutely-nothing-here" },
			undefined,
			undefined,
			execCtx(),
		);
		expect(r.details?.available).toBe(true);
		expect(r.details?.hitCount).toBe(0);
	});

	it("memory_search clamps absurd limits to the hard cap", async () => {
		const searchDef = createMemorySearchToolDefinition(provider);
		const saveDef = createMemorySaveToolDefinition(provider);
		for (let i = 0; i < 5; i++) {
			await saveDef.execute(`s-${i}`, { content: `fact ${i} keyword` }, undefined, undefined, execCtx());
		}
		const r = await searchDef.execute("call-4", { query: "keyword", limit: 999 }, undefined, undefined, execCtx());
		expect(r.details?.hitCount).toBeLessThanOrEqual(20);
	});
});
