import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { registerConfigCommand } from "../commands/config.js";
import { CONFIG_KEYS, DEFAULT_CONFIG, loadConfig, resolveConfig } from "../index.js";

function makeTempProject(): { homeDir: string; projectDir: string; cleanup: () => void } {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "cavekit-config-"));
	const homeDir = path.join(root, "home");
	const projectDir = path.join(root, "project");
	fs.mkdirSync(homeDir, { recursive: true });
	fs.mkdirSync(projectDir, { recursive: true });

	return {
		homeDir,
		projectDir,
		cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
	};
}

function writeJson(filePath: string, value: unknown): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

describe("config resolution", () => {
	it("uses documented defaults when no config files exist", () => {
		const { homeDir, projectDir, cleanup } = makeTempProject();

		try {
			const resolved = resolveConfig({ cwd: projectDir, homeDir });
			expect(resolved.values).toEqual(DEFAULT_CONFIG);

			for (const key of CONFIG_KEYS) {
				expect(resolved.withSources[key].source).toBe("default");
				expect(resolved.withSources[key].value).toBe(DEFAULT_CONFIG[key]);
			}
		} finally {
			cleanup();
		}
	});

	it("lets project-local values override global values", () => {
		const { homeDir, projectDir, cleanup } = makeTempProject();
		const globalPath = path.join(homeDir, ".cave", "cavekit.json");
		const projectPath = path.join(projectDir, ".cavekit", "config.json");

		try {
			writeJson(globalPath, {
				preset: "fast",
				maxRetries: 9,
				scopedContext: false,
				tierGateModel: "claude-sonnet-4-6",
			});
			writeJson(projectPath, {
				maxRetries: 2,
				scopedContext: true,
			});

			const resolved = resolveConfig({ cwd: projectDir, homeDir });
			expect(resolved.values.preset).toBe("fast");
			expect(resolved.values.maxRetries).toBe(2);
			expect(resolved.values.scopedContext).toBe(true);
			expect(resolved.values.tierGateModel).toBe("claude-sonnet-4-6");
			expect(resolved.withSources.preset.source).toBe("global");
			expect(resolved.withSources.maxRetries.source).toBe("project");
			expect(resolved.withSources.scopedContext.source).toBe("project");
		} finally {
			cleanup();
		}
	});

	it("shows source-tagged resolved config and saves updates in project scope", async () => {
		const { homeDir, projectDir, cleanup } = makeTempProject();
		const originalHome = process.env.HOME;
		const globalPath = path.join(homeDir, ".cave", "cavekit.json");
		const projectPath = path.join(projectDir, ".cavekit", "config.json");
		const commands = new Map<string, { handler: (args: string, ctx: MockCommandContext) => Promise<void> }>();

		try {
			process.env.HOME = homeDir;
			writeJson(globalPath, { preset: "balanced" });
			writeJson(projectPath, { maxRetries: 4 });

			const api = {
				registerCommand: vi.fn(
					(name: string, command: { handler: (args: string, ctx: MockCommandContext) => Promise<void> }) => {
						commands.set(name, command);
					},
				),
			};

			const config = loadConfig({ cwd: projectDir, homeDir });
			registerConfigCommand(api as unknown as never, config);

			const command = commands.get("ck:config");
			expect(command).toBeDefined();

			const ctx: MockCommandContext = {
				cwd: projectDir,
				ui: {
					notify: vi.fn(),
				},
			};

			await command!.handler("", ctx);
			expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("[global]"), "info");
			expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("[project]"), "info");

			await command!.handler("maxRetries 7", ctx);
			const saved = JSON.parse(fs.readFileSync(projectPath, "utf8")) as { maxRetries: number };
			expect(saved.maxRetries).toBe(7);
		} finally {
			if (originalHome === undefined) {
				delete process.env.HOME;
			} else {
				process.env.HOME = originalHome;
			}
			cleanup();
		}
	});
});

interface MockCommandContext {
	cwd: string;
	ui: {
		notify: ReturnType<typeof vi.fn>;
	};
}
