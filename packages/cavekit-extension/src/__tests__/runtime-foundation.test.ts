import { describe, expect, it, vi } from "vitest";
import cavekit, {
	CAVEKIT_BASE_HOOK_EVENT_NAMES,
	CAVEKIT_COMMAND_IDS,
	CAVEKIT_SHORTCUTS,
	CAVEKIT_TOOL_NAMES,
	detectHost,
} from "../index.js";

function createExtensionApiMock() {
	const commands = new Map<string, unknown>();
	const tools: Array<{ name: string }> = [];
	const shortcuts = new Map<string, unknown>();
	const eventHandlers = new Map<string, Array<(...args: unknown[]) => unknown>>();

	return {
		on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
			const handlers = eventHandlers.get(event) ?? [];
			handlers.push(handler);
			eventHandlers.set(event, handlers);
		}),
		registerCommand: vi.fn((name: string, command: unknown) => {
			commands.set(name, command);
		}),
		registerTool: vi.fn((tool: { name: string }) => {
			tools.push(tool);
		}),
		registerShortcut: vi.fn((name: string, shortcut: unknown) => {
			shortcuts.set(name, shortcut);
		}),
		registerFlag: vi.fn(),
		registerMessageRenderer: vi.fn(),
		sendUserMessage: vi.fn(),
		commands,
		tools,
		shortcuts,
		eventHandlers,
	};
}

describe("extension runtime foundation", () => {
	it("bootstraps commands, hooks, tools, and shortcuts without vanilla warnings", () => {
		const api = createExtensionApiMock();
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		try {
			const result = cavekit(api as unknown as never);
			expect(result).toBeDefined();
			expect(result?.registration.commands).toEqual([...CAVEKIT_COMMAND_IDS]);
			expect(result?.registration.tools).toEqual([...CAVEKIT_TOOL_NAMES]);
			expect(result?.registration.widgets).toEqual([...CAVEKIT_SHORTCUTS]);
			expect(result?.registration.hooks).toEqual([...CAVEKIT_BASE_HOOK_EVENT_NAMES]);
			expect([...api.commands.keys()]).toEqual([...CAVEKIT_COMMAND_IDS]);
			expect(api.tools.map((tool) => tool.name)).toEqual([...CAVEKIT_TOOL_NAMES]);
			expect([...api.shortcuts.keys()]).toEqual([...CAVEKIT_SHORTCUTS]);

			for (const eventName of CAVEKIT_BASE_HOOK_EVENT_NAMES) {
				expect(api.eventHandlers.get(eventName)?.length ?? 0).toBeGreaterThan(0);
			}

			expect(errorSpy).not.toHaveBeenCalled();
			expect(warnSpy).not.toHaveBeenCalled();
		} finally {
			errorSpy.mockRestore();
			warnSpy.mockRestore();
		}
	});

	it("registers skill discovery hook that returns bundled skill paths", async () => {
		const api = createExtensionApiMock();
		const result = cavekit(api as unknown as never);
		expect(result).toBeDefined();

		const handlers = api.eventHandlers.get("resources_discover") ?? [];
		expect(handlers.length).toBeGreaterThan(0);

		const discoveryResult = await handlers[0]!({}, {});
		expect(discoveryResult).toHaveProperty("skillPaths");
		expect(Array.isArray((discoveryResult as { skillPaths: string[] }).skillPaths)).toBe(true);
		expect((discoveryResult as { skillPaths: string[] }).skillPaths.length).toBeGreaterThan(0);
	});

	it("detects Cave and vanilla Pi executables", () => {
		expect(detectHost("/usr/local/bin/cave").flavor).toBe("cave");
		expect(detectHost("/usr/local/bin/pi").flavor).toBe("pi");
		expect(detectHost("/usr/local/bin/node").flavor).toBe("unknown");
	});
});
