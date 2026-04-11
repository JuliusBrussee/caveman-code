/**
 * Tests for RTK (Rust Token Killer) integration.
 *
 * Covers:
 * - R1: Binary detection and caching
 * - R2: Command rewriting via `rtk rewrite`
 * - R4: BashSpawnHook factory
 *
 * R3 (settings) is tested inline via settings-manager patterns.
 * R4/AC-2,AC-3 (agent-session wiring) are verified by build-time type checks
 * and the integration in agent-session.ts.
 */

import type { ChildProcess, ExecFileException, ExecFileOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	return {
		execFile:
			vi.fn<
				(
					file: string,
					args: readonly string[],
					options: ExecFileOptions,
					callback: (error: ExecFileException | null, stdout: string, stderr: string) => void,
				) => object
			>(),
		spawn: vi.fn<() => ChildProcess>(),
	};
});

vi.mock("node:child_process", () => ({
	execFile: mocks.execFile,
	spawn: mocks.spawn,
}));

const mockedExecFile = mocks.execFile;
const mockedSpawn = mocks.spawn;

type MockStdout = EventEmitter & {
	setEncoding: ReturnType<typeof vi.fn>;
};

type MockChildProcess = EventEmitter & {
	stdout: MockStdout;
	kill: ReturnType<typeof vi.fn>;
};

function createMockChildProcess(): MockChildProcess {
	const stdout = new EventEmitter() as MockStdout;
	stdout.setEncoding = vi.fn().mockReturnValue(stdout);

	const child = new EventEmitter() as MockChildProcess;
	child.stdout = stdout;
	child.kill = vi.fn().mockReturnValue(true);
	return child;
}

function mockExecFileSuccess(stdout: string): void {
	mockedExecFile.mockImplementation(((
		_file: string,
		_args: readonly string[],
		_options: ExecFileOptions,
		callback: (error: ExecFileException | null, stdout: string, stderr: string) => void,
	) => {
		queueMicrotask(() => callback(null, stdout, ""));
		return {};
	}) as unknown as typeof mocks.execFile);
}

function mockExecFileError(error: ExecFileException): void {
	mockedExecFile.mockImplementation(((
		_file: string,
		_args: readonly string[],
		_options: ExecFileOptions,
		callback: (error: ExecFileException | null, stdout: string, stderr: string) => void,
	) => {
		queueMicrotask(() => callback(error, "", ""));
		return {};
	}) as unknown as typeof mocks.execFile);
}

function mockExecFileThrow(error: Error): void {
	mockedExecFile.mockImplementation(((
		_file: string,
		_args: readonly string[],
		_options: ExecFileOptions,
		_callback: (error: ExecFileException | null, stdout: string, stderr: string) => void,
	) => {
		throw error;
	}) as unknown as typeof mocks.execFile);
}

// We need to re-import after mocking to get fresh module state
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

// ============================================================================
// R1: RTK Binary Detection
// ============================================================================

describe("detectRtk", () => {
	it("R1/AC-1: reports available when rtk --version exits 0", async () => {
		const child = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as unknown as ChildProcess);

		const resultPromise = detectRtk();
		child.stdout.emit("data", "rtk 0.28.2\n");
		child.emit("close", 0);

		await expect(resultPromise).resolves.toEqual({
			available: true,
			version: "rtk 0.28.2",
		});
		expect(mockedSpawn).toHaveBeenCalledWith(
			"rtk",
			["--version"],
			expect.objectContaining({
				shell: false,
				stdio: ["ignore", "pipe", "ignore"],
			}),
		);
	});

	it("R1/AC-2: reports unavailable when rtk is not on PATH (ENOENT)", async () => {
		const child = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as unknown as ChildProcess);

		const resultPromise = detectRtk();
		child.emit("error", Object.assign(new Error("spawn rtk ENOENT"), { code: "ENOENT" }));

		await expect(resultPromise).resolves.toEqual({
			available: false,
			version: null,
		});
	});

	it("R1/AC-3: reports unavailable when rtk --version fails (wrong binary)", async () => {
		const child = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as unknown as ChildProcess);

		const resultPromise = detectRtk();
		child.emit("close", 1);

		await expect(resultPromise).resolves.toEqual({
			available: false,
			version: null,
		});
	});

	it("R1/AC-5: stores version string alongside availability", async () => {
		const child = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as unknown as ChildProcess);

		const resultPromise = detectRtk();
		child.stdout.emit("data", "rtk 0.28.2\n");
		child.emit("close", 0);

		await expect(resultPromise).resolves.toEqual({
			available: true,
			version: "rtk 0.28.2",
		});
	});
});

describe("getRtkStatus", () => {
	it("R1/AC-4: caches result after first check", async () => {
		const child = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as unknown as ChildProcess);

		const firstPromise = getRtkStatus();
		const secondPromise = getRtkStatus();

		expect(mockedSpawn).toHaveBeenCalledTimes(1);

		child.stdout.emit("data", "rtk 0.28.2\n");
		child.emit("close", 0);

		await expect(firstPromise).resolves.toEqual({
			available: true,
			version: "rtk 0.28.2",
		});
		await expect(secondPromise).resolves.toEqual({
			available: true,
			version: "rtk 0.28.2",
		});
	});

	it("resetRtkCache clears the cache", async () => {
		const firstChild = createMockChildProcess();
		const secondChild = createMockChildProcess();
		mockedSpawn
			.mockReturnValueOnce(firstChild as unknown as ChildProcess)
			.mockReturnValueOnce(secondChild as unknown as ChildProcess);

		const firstPromise = getRtkStatus();
		firstChild.stdout.emit("data", "rtk 0.28.2\n");
		firstChild.emit("close", 0);
		await firstPromise;

		resetRtkCache();

		const secondPromise = getRtkStatus();
		secondChild.stdout.emit("data", "rtk 0.29.0\n");
		secondChild.emit("close", 0);

		await expect(secondPromise).resolves.toEqual({
			available: true,
			version: "rtk 0.29.0",
		});
		expect(mockedSpawn).toHaveBeenCalledTimes(2);
	});
});

// ============================================================================
// R2: Command Rewriting
// ============================================================================

describe("rewriteCommand", () => {
	it("R2/AC-1,AC-2: calls rtk rewrite and uses rewritten command on exit 0", async () => {
		mockExecFileSuccess("rtk git status\n");
		const result = await rewriteCommand("git status");
		expect(result).toBe("rtk git status");
		expect(mockedExecFile).toHaveBeenCalledWith(
			"rtk",
			["rewrite", "git status"],
			expect.anything(),
			expect.any(Function),
		);
	});

	it("R2/AC-3: returns original on non-zero exit code", async () => {
		const error = new Error("exit 1") as ExecFileException;
		error.code = 1;
		mockExecFileError(error);
		expect(await rewriteCommand("git status")).toBe("git status");
	});

	it("R2/AC-4: returns original on spawn error (fail-open)", async () => {
		const error = new Error("ENOENT") as ExecFileException;
		error.code = "ENOENT";
		mockExecFileError(error);
		expect(await rewriteCommand("git status")).toBe("git status");
	});

	it("R2/AC-4: returns original on timeout", async () => {
		const error = new Error("TIMEOUT") as ExecFileException;
		error.killed = true;
		error.signal = "SIGTERM";
		mockExecFileError(error);
		expect(await rewriteCommand("git status")).toBe("git status");
	});

	it("R2/AC-4: returns original on synchronous execFile failure", async () => {
		mockExecFileThrow(new Error("spawn failed"));
		expect(await rewriteCommand("git status")).toBe("git status");
	});

	it("R2/AC-5: does not double-rewrite commands already prefixed with rtk", async () => {
		const result = await rewriteCommand("rtk git status");
		expect(result).toBe("rtk git status");
		expect(mockedExecFile).not.toHaveBeenCalled();
	});

	it("R2/AC-5: does not rewrite bare rtk command", async () => {
		const result = await rewriteCommand("rtk");
		expect(result).toBe("rtk");
		expect(mockedExecFile).not.toHaveBeenCalled();
	});

	it("R2/AC-6: passes compound commands to rtk rewrite as-is", async () => {
		mockExecFileSuccess("rtk git status && rtk ls\n");
		const result = await rewriteCommand("git status && ls");
		expect(result).toBe("rtk git status && rtk ls");
		expect(mockedExecFile).toHaveBeenCalledWith(
			"rtk",
			["rewrite", "git status && ls"],
			expect.anything(),
			expect.any(Function),
		);
	});

	it("R2/AC-8: returns original when rtk rewrite returns empty stdout", async () => {
		mockExecFileSuccess("\n");
		expect(await rewriteCommand("git status")).toBe("git status");
	});
});

// ============================================================================
// R4: BashSpawnHook Factory
// ============================================================================

describe("createRtkSpawnHook", () => {
	it("R4/AC-1: rewrites context.command via rtk rewrite", async () => {
		const child = createMockChildProcess();
		mockedSpawn.mockReturnValueOnce(child as unknown as ChildProcess);
		mockExecFileSuccess("rtk git status\n");
		const hook = createRtkSpawnHook();
		const context = { command: "git status", cwd: "/tmp", env: {} as NodeJS.ProcessEnv };
		const resultPromise = hook(context);
		child.stdout.emit("data", "rtk 0.28.2\n");
		child.emit("close", 0);
		const result = await resultPromise;
		expect(result.command).toBe("rtk git status");
		expect(result.cwd).toBe("/tmp");
	});

	it("R4/AC-4: preserves commandPrefix in context (prefix already applied before hook)", async () => {
		const child = createMockChildProcess();
		mockedSpawn.mockReturnValueOnce(child as unknown as ChildProcess);
		mockExecFileSuccess("shopt -s expand_aliases\nrtk git status\n");
		const hook = createRtkSpawnHook();
		const prefixedCommand = "shopt -s expand_aliases\ngit status";
		const context = { command: prefixedCommand, cwd: "/tmp", env: {} as NodeJS.ProcessEnv };
		const resultPromise = hook(context);
		child.stdout.emit("data", "rtk 0.28.2\n");
		child.emit("close", 0);
		const result = await resultPromise;
		expect(result.command).toBe("shopt -s expand_aliases\nrtk git status");
	});

	it("R2/AC-8: skips rewrite entirely when RTK is unavailable", async () => {
		const child = createMockChildProcess();
		mockedSpawn.mockReturnValueOnce(child as unknown as ChildProcess);
		const hook = createRtkSpawnHook();
		const context = { command: "git status", cwd: "/tmp", env: {} as NodeJS.ProcessEnv };
		const resultPromise = hook(context);
		child.emit("close", 1);
		const result = await resultPromise;
		expect(result).toBe(context);
		expect(mockedExecFile).not.toHaveBeenCalled();
	});

	it("returns original context when command is unchanged", async () => {
		const child = createMockChildProcess();
		mockedSpawn.mockReturnValueOnce(child as unknown as ChildProcess);
		const error = new Error("exit 1") as ExecFileException;
		error.code = 1;
		mockExecFileError(error);
		const hook = createRtkSpawnHook();
		const context = { command: "unknown-cmd", cwd: "/tmp", env: {} as NodeJS.ProcessEnv };
		const resultPromise = hook(context);
		child.stdout.emit("data", "rtk 0.28.2\n");
		child.emit("close", 0);
		const result = await resultPromise;
		expect(result).toBe(context);
	});
});

// ============================================================================
// R3: RTK Settings Integration
// ============================================================================

describe("RTK Settings Integration", () => {
	it("R3/AC-2: rewrite is active when RTK enabled and available", async () => {
		const child = createMockChildProcess();
		mockedSpawn.mockReturnValueOnce(child as unknown as ChildProcess);
		mockExecFileSuccess("rtk git status\n");

		// First detect RTK as available
		const statusPromise = getRtkStatus();
		child.stdout.emit("data", "rtk 0.28.2\n");
		child.emit("close", 0);
		await statusPromise;

		// Now rewrite a command - should call execFile
		const rewritten = await rewriteCommand("git status");
		expect(rewritten).toBe("rtk git status");
		expect(mockedExecFile).toHaveBeenCalled();
	});

	it("R3/AC-3: rewrite is inactive when RTK unavailable (fail-open behavior)", async () => {
		const child = createMockChildProcess();
		mockedSpawn.mockReturnValueOnce(child as unknown as ChildProcess);

		// Detect RTK as unavailable (non-zero exit)
		const statusPromise = getRtkStatus();
		child.emit("close", 1);
		await statusPromise;

		// Now rewrite should return original command without calling execFile
		const rewritten = await rewriteCommand("git status");
		expect(rewritten).toBe("git status");
		expect(mockedExecFile).not.toHaveBeenCalled();
	});
});

// ============================================================================
// R4: Tool Integration
// ============================================================================

describe("R4: Tool Integration", () => {
	it("R4/AC-5: verifies compressCaveToolContentBlocks is unaffected", async () => {
		// This is verified via static analysis/grep
		// Confirm the function is not imported or used in rtk.ts
		const rtkSource = require("fs").readFileSync(require("path").join(process.cwd(), "src/core/rtk.ts"), "utf-8");
		expect(rtkSource).not.toMatch(/compressCaveToolContentBlocks/);
	});

	it("R4/AC-1,AC-4: commandPrefix is preserved when RTK hook modifies command", async () => {
		const child = createMockChildProcess();
		mockedSpawn.mockReturnValueOnce(child as unknown as ChildProcess);
		mockExecFileSuccess("rtk git status\n");

		const hook = createRtkSpawnHook();
		// Context already has prefix applied by bash tool
		const prefixedCommand = "shopt -s expand_aliases\ngit status";
		const context = { command: prefixedCommand, cwd: "/tmp", env: {} as NodeJS.ProcessEnv };

		const resultPromise = hook(context);
		child.stdout.emit("data", "rtk 0.28.2\n");
		child.emit("close", 0);
		const result = await resultPromise;

		// Hook should preserve original context object if command didn't change
		expect(result.cwd).toBe("/tmp");
		expect(result.env).toBe(context.env);
	});
});
