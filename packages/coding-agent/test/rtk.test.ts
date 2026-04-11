import { EventEmitter } from "node:events";
import { execFile, spawn } from "node:child_process";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	execFile: vi.fn(),
	spawn: vi.fn(),
}));

const mockedExecFile = vi.mocked(execFile);
const mockedSpawn = vi.mocked(spawn);

type ExecFileCallback = (
	error: (Error & { code?: number | string }) | null,
	stdout: string,
	stderr: string,
) => void;

type MockSpawnProcess = EventEmitter & {
	stdout: PassThrough;
	kill: (signal?: NodeJS.Signals | number) => boolean;
};

function mockExecFileResult(options: { stdout?: string; code?: number | string } = {}): void {
	mockedExecFile.mockImplementation(
		((...args: unknown[]) => {
			const callback = args[3];
			if (typeof callback !== "function") {
				throw new Error("Expected execFile callback");
			}
			const done = callback as ExecFileCallback;
			if (options.code === undefined || options.code === 0) {
				done(null, options.stdout ?? "", "");
			} else {
				const error = Object.assign(new Error("Command failed"), { code: options.code });
				done(error, options.stdout ?? "", "");
			}
			return {} as ReturnType<typeof execFile>;
		}) as typeof execFile,
	);
}

function createMockSpawnProcess(): ReturnType<typeof spawn> {
	const proc = new EventEmitter() as MockSpawnProcess;
	proc.stdout = new PassThrough();
	proc.kill = vi.fn(() => true);
	return proc as unknown as ReturnType<typeof spawn>;
}

let detectRtk: typeof import("../src/core/rtk.js").detectRtk;
let getRtkStatus: typeof import("../src/core/rtk.js").getRtkStatus;
let resetRtkCache: typeof import("../src/core/rtk.js").resetRtkCache;
let rewriteCommand: typeof import("../src/core/rtk.js").rewriteCommand;
let createRtkSpawnHook: typeof import("../src/core/rtk.js").createRtkSpawnHook;

beforeEach(async () => {
	vi.resetModules();
	mockedExecFile.mockReset();
	mockedSpawn.mockReset();
	const rtk = await import("../src/core/rtk.js");
	detectRtk = rtk.detectRtk;
	getRtkStatus = rtk.getRtkStatus;
	resetRtkCache = rtk.resetRtkCache;
	rewriteCommand = rtk.rewriteCommand;
	createRtkSpawnHook = rtk.createRtkSpawnHook;
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("detectRtk", () => {
	it("reports available when rtk --version exits 0", async () => {
		const proc = createMockSpawnProcess();
		mockedSpawn.mockImplementation((() => proc) as typeof spawn);

		const resultPromise = detectRtk();
		(proc.stdout as PassThrough).write("rtk 0.28.2\n");
		proc.emit("close", 0);

		await expect(resultPromise).resolves.toEqual({ available: true, version: "rtk 0.28.2" });
		expect(mockedSpawn).toHaveBeenCalledWith(
			"rtk",
			["--version"],
			expect.objectContaining({
				shell: false,
				stdio: ["ignore", "pipe", "ignore"],
			}),
		);
	});

	it("caches status after first lookup", async () => {
		const proc = createMockSpawnProcess();
		mockedSpawn.mockImplementation((() => proc) as typeof spawn);

		const first = getRtkStatus();
		const second = getRtkStatus();
		expect(mockedSpawn).toHaveBeenCalledTimes(1);

		(proc.stdout as PassThrough).write("rtk 0.28.2\n");
		proc.emit("close", 0);

		await expect(first).resolves.toEqual({ available: true, version: "rtk 0.28.2" });
		await expect(second).resolves.toEqual({ available: true, version: "rtk 0.28.2" });
	});

	it("resetRtkCache clears cached detection result", async () => {
		const firstProc = createMockSpawnProcess();
		const secondProc = createMockSpawnProcess();
		mockedSpawn
			.mockImplementationOnce((() => firstProc) as typeof spawn)
			.mockImplementationOnce((() => secondProc) as typeof spawn);

		const first = getRtkStatus();
		(firstProc.stdout as PassThrough).write("rtk 0.28.2\n");
		firstProc.emit("close", 0);
		await first;

		resetRtkCache();
		const second = getRtkStatus();
		(secondProc.stdout as PassThrough).write("rtk 0.28.3\n");
		secondProc.emit("close", 0);
		await expect(second).resolves.toEqual({ available: true, version: "rtk 0.28.3" });
		expect(mockedSpawn).toHaveBeenCalledTimes(2);
	});
});

describe("rewriteCommand", () => {
	it("R2/AC-1: calls rtk rewrite and uses rewritten command on exit 0", async () => {
		mockExecFileResult({ stdout: "rtk git status\n" });

		await expect(rewriteCommand("git status")).resolves.toBe("rtk git status");
		expect(mockedExecFile).toHaveBeenCalledWith(
			"rtk",
			["rewrite", "git status"],
			expect.objectContaining({
				timeout: 200,
				encoding: "utf-8",
			}),
			expect.any(Function),
		);
	});

	it("returns original on non-zero exit code", async () => {
		mockExecFileResult({ code: 1 });
		await expect(rewriteCommand("unknown-cmd")).resolves.toBe("unknown-cmd");
	});

	it("uses rewritten stdout for ask-rule exit code 3", async () => {
		mockExecFileResult({ code: 3, stdout: "rtk git status\n" });
		await expect(rewriteCommand("git status")).resolves.toBe("rtk git status");
	});

	it("R2/AC-8: returns original and skips later rewrites when rtk is unavailable", async () => {
		mockExecFileResult({ code: "ENOENT" });
		await expect(rewriteCommand("git status")).resolves.toBe("git status");

		mockedExecFile.mockClear();
		await expect(rewriteCommand("git diff")).resolves.toBe("git diff");
		expect(mockedExecFile).not.toHaveBeenCalled();
	});

	it("does not double-rewrite commands already prefixed with rtk", async () => {
		await expect(rewriteCommand("rtk git status")).resolves.toBe("rtk git status");
		expect(mockedExecFile).not.toHaveBeenCalled();
	});
});

describe("createRtkSpawnHook", () => {
	it("R4/AC-1: rewrites context.command via rtk rewrite", async () => {
		mockExecFileResult({ stdout: "rtk git status\n" });
		const hook = createRtkSpawnHook();
		const context = { command: "git status", cwd: "/tmp", env: {} as NodeJS.ProcessEnv };

		await expect(hook(context)).resolves.toEqual({
			command: "rtk git status",
			cwd: "/tmp",
			env: context.env,
		});
	});

	it("R4/AC-4: preserves commandPrefix in context before rewriting", async () => {
		mockExecFileResult({ stdout: "shopt -s expand_aliases\nrtk git status\n" });
		const hook = createRtkSpawnHook();
		const prefixedCommand = "shopt -s expand_aliases\ngit status";
		const context = { command: prefixedCommand, cwd: "/tmp", env: {} as NodeJS.ProcessEnv };

		await expect(hook(context)).resolves.toEqual({
			command: "shopt -s expand_aliases\nrtk git status",
			cwd: "/tmp",
			env: context.env,
		});
	});

	it("returns original context when command is unchanged", async () => {
		mockExecFileResult({ code: 1 });
		const hook = createRtkSpawnHook();
		const context = { command: "unknown-cmd", cwd: "/tmp", env: {} as NodeJS.ProcessEnv };

		await expect(hook(context)).resolves.toBe(context);
	});
});
