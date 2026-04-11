import * as fs from "node:fs";
import { loadSkills } from "cave";
import { describe, expect, it, vi } from "vitest";
import { registerSkillsDiscoveryHook } from "../hooks/skills-discovery.js";
import {
	BUNDLED_SKILLS,
	getBundledSkillDiscoveryPaths,
	getBundledSkillFile,
	getBundledSkillSourceFile,
	getBundledSkillsRoot,
} from "../resources.js";

describe("bundled CaveKit skills", () => {
	it("ships all expected CaveKit skill files in host-compatible layout", () => {
		expect(BUNDLED_SKILLS).toHaveLength(15);
		expect(fs.existsSync(getBundledSkillsRoot())).toBe(true);

		for (const skill of BUNDLED_SKILLS) {
			expect(fs.existsSync(getBundledSkillSourceFile(skill.id)), `${skill.id} legacy markdown missing`).toBe(true);
			expect(fs.existsSync(getBundledSkillFile(skill.id)), `${skill.id} bundled SKILL.md missing`).toBe(true);
		}
	});

	it("loads bundled skills through host resource discovery paths without diagnostics", () => {
		const discoveryPaths = getBundledSkillDiscoveryPaths();
		expect(discoveryPaths).toEqual([getBundledSkillsRoot()]);

		const result = loadSkills({
			skillPaths: discoveryPaths,
			includeDefaults: false,
		});

		expect(result.diagnostics).toEqual([]);
		expect(result.skills.map((skill) => skill.name).sort()).toEqual(BUNDLED_SKILLS.map((skill) => skill.id).sort());
	});

	it("preserves legacy skill content inside bundled SKILL.md wrappers", () => {
		for (const skill of BUNDLED_SKILLS) {
			const source = fs.readFileSync(getBundledSkillSourceFile(skill.id), "utf8").trim();
			const bundled = fs.readFileSync(getBundledSkillFile(skill.id), "utf8");
			const [, body = ""] = bundled.split(/---\n\n/);
			expect(body.trim(), `${skill.id} bundled body diverged from legacy markdown`).toBe(source);
		}
	});
});

describe("skills discovery hook", () => {
	it("registers bundled CaveKit skills with resources_discover", async () => {
		const handlers = new Map<string, Array<(...args: unknown[]) => unknown>>();
		const pi = {
			on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
				if (!handlers.has(event)) {
					handlers.set(event, []);
				}
				handlers.get(event)!.push(handler);
			}),
		};

		registerSkillsDiscoveryHook(pi as unknown as Parameters<typeof registerSkillsDiscoveryHook>[0], {} as never);

		const resourceHandlers = handlers.get("resources_discover") ?? [];
		expect(resourceHandlers).toHaveLength(1);

		const result = await Promise.resolve(
			resourceHandlers[0]({ type: "resources_discover", cwd: process.cwd(), reason: "startup" }, {}),
		);

		expect(result).toEqual({
			skillPaths: [getBundledSkillsRoot()],
		});
	});
});
