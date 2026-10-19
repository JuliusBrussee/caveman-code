import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPackageDir } from "../src/config.js";
import { DefaultPackageManager } from "../src/core/package-manager.js";
import { DefaultResourceLoader } from "../src/core/resource-loader.js";
import { createAgentSession } from "../src/core/sdk.js";
import { SessionManager } from "../src/core/session-manager.js";
import { SettingsManager } from "../src/core/settings-manager.js";
import { findBundledCommandsDir, loadMarkdownCommands } from "../src/core/slash-commands.js";

describe("Bundled skills and commands auto-discovery (issue #28)", () => {
	let tempDir: string;
	let agentDir: string;
	let cwd: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `bundled-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		agentDir = join(tempDir, "agent");
		cwd = join(tempDir, "project");
		mkdirSync(agentDir, { recursive: true });
		mkdirSync(cwd, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	describe("Bundled skills", () => {
		it("package manager discovers bundled skills with source 'builtin'", async () => {
			const pm = new DefaultPackageManager({
				cwd,
				agentDir,
				settingsManager: SettingsManager.inMemory(),
			});
			const resolved = await pm.resolve();

			expect(resolved.skills.length).toBeGreaterThan(0);
			const bundledSkills = resolved.skills.filter((s) => s.metadata.source === "builtin");
			expect(bundledSkills.length).toBeGreaterThan(0);

			// Should include cavekit-methodology or cavekit-design-system
			const hasBundled = bundledSkills.some((s) => s.path.includes("cavekit"));
			expect(hasBundled).toBe(true);
		});

		it("resource loader loads bundled skills into getSkills()", async () => {
			const loader = new DefaultResourceLoader({ cwd, agentDir });
			await loader.reload();

			const { skills } = loader.getSkills();
			expect(skills.length).toBeGreaterThan(0);

			const builtinSkills = skills.filter((s) => s.sourceInfo?.source === "builtin");
			expect(builtinSkills.length).toBeGreaterThan(0);
			expect(builtinSkills.some((s) => s.name === "cavekit-methodology")).toBe(true);
		});

		it("user/project skills take precedence over bundled skills on name collision", async () => {
			// Create a user skill with the same name as a bundled skill
			const userSkillsDir = join(agentDir, "skills", "cavekit-methodology");
			mkdirSync(userSkillsDir, { recursive: true });
			writeFileSync(
				join(userSkillsDir, "SKILL.md"),
				`---\nname: cavekit-methodology\ndescription: Overridden by user\n---\nUser override content`,
			);

			const loader = new DefaultResourceLoader({ cwd, agentDir });
			await loader.reload();

			const { skills } = loader.getSkills();
			const matched = skills.find((s) => s.name === "cavekit-methodology");
			expect(matched).toBeDefined();
			expect(matched?.description).toBe("Overridden by user");
			expect(matched?.sourceInfo?.scope).toBe("user");
			expect(matched?.sourceInfo?.source).not.toBe("builtin");
		});
	});

	describe("Bundled commands", () => {
		it("findBundledCommandsDir locates the package commands dir", () => {
			const pkgDir = getPackageDir();
			const bundledDir = findBundledCommandsDir(pkgDir);
			expect(bundledDir).toBeDefined();
			expect(existsSync(bundledDir!)).toBe(true);
		});

		it("loadMarkdownCommands discovers bundled commands with source 'builtin'", () => {
			const pkgDir = getPackageDir();
			const defaultsDir = findBundledCommandsDir(pkgDir);
			const result = loadMarkdownCommands({ cwd, agentDir, defaultsDir });

			expect(result.commands.length).toBeGreaterThan(0);
			const builtinCommands = result.commands.filter((c) => c.sourceInfo?.source === "builtin");
			expect(builtinCommands.length).toBeGreaterThan(0);

			// Check for expected bundled commands
			const commandNames = builtinCommands.map((c) => c.name);
			expect(commandNames).toContain("clean");
			expect(commandNames).toContain("commit");
			expect(commandNames).toContain("explain");
			expect(commandNames).toContain("review");
		});

		it("user/project commands take precedence over bundled commands on collision", () => {
			const pkgDir = getPackageDir();
			const defaultsDir = findBundledCommandsDir(pkgDir);

			// Create a project-level command 'clean'
			const projectCommandsDir = join(cwd, ".cave", "commands");
			mkdirSync(projectCommandsDir, { recursive: true });
			writeFileSync(
				join(projectCommandsDir, "clean.md"),
				`---\ndescription: Project clean override\n---\nProject custom clean body`,
			);

			const result = loadMarkdownCommands({ cwd, agentDir, defaultsDir });
			const cleanCommand = result.commands.find((c) => c.name === "clean");

			expect(cleanCommand).toBeDefined();
			expect(cleanCommand?.description).toBe("Project clean override");
			expect(cleanCommand?.sourceInfo?.scope).toBe("project");
			expect(cleanCommand?.sourceInfo?.source).toBe("local");
		});
	});

	describe("AgentSession integration", () => {
		it("exposes bundled skills and markdown commands on createAgentSession", async () => {
			const { session } = await createAgentSession({
				cwd,
				agentDir,
				sessionManager: SessionManager.inMemory(),
			});

			// Skills
			const skills = session.resourceLoader.getSkills().skills;
			expect(skills.length).toBeGreaterThan(0);
			expect(skills.some((s) => s.sourceInfo?.source === "builtin")).toBe(true);

			// Commands
			const commands = session.markdownCommands;
			expect(commands.length).toBeGreaterThan(0);
			const builtinCommands = commands.filter((c) => c.sourceInfo?.source === "builtin");
			expect(builtinCommands.length).toBeGreaterThan(0);
			expect(builtinCommands.map((c) => c.name)).toContain("commit");
		});
	});
});
