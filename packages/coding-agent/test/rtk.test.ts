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

import { type ExecFileException, type ExecFileOptions, execFile, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	execFile: vi.fn(),
	spawn: vi.fn(),
}));

const mockedExecFile = vi.mocked(execFile);
const mockedSpawn = vi.mocked(spawn);

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
	}) as unknown as typeof execFile);
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
	}) as unknown as typeof execFile);
}

function mockExecFileThrow(error: Error): void {
	mockedExecFile.mockImplementation(((
		_file: string,
		_args: readonly string[],
		_options: ExecFileOptions,
		_callback: (error: ExecFileException | null, stdout: string, stderr: string) => void,
	) => {
		throw error;
	}) as unknown as typeof execFile);
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
		mockedSpawn.mockReturnValue(child as unknown as ReturnType<typeof spawn>);

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
		mockedSpawn.mockReturnValue(child as unknown as ReturnType<typeof spawn>);

		const resultPromise = detectRtk();
		child.emit("error", Object.assign(new Error("spawn rtk ENOENT"), { code: "ENOENT" }));

		await expect(resultPromise).resolves.toEqual({
			available: false,
			version: null,
		});
	});

	it("R1/AC-3: reports unavailable when rtk --version fails (wrong binary)", async () => {
		const child = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as unknown as ReturnType<typeof spawn>);

		const resultPromise = detectRtk();
		child.emit("close", 1);

		await expect(resultPromise).resolves.toEqual({
			available: false,
			version: null,
		});
	});

	it("R1/AC-5: stores version string alongside availability", async () => {
		const child = createMockChildProcess();
		mockedSpawn.mockReturnValue(child as unknown as ReturnType<typeof spawn>);

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
		mockedSpawn.mockReturnValue(child as unknown as ReturnType<typeof spawn>);

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
			.mockReturnValueOnce(firstChild as unknown as ReturnType<typeof spawn>)
			.mockReturnValueOnce(secondChild as unknown as ReturnType<typeof spawn>);

		const firstPromise = getRtkStatus();
		firstChild.stdout.emit("data", "rtk 0.28.2\n");
		firstChild.emit("close", 0);
		await firstPromise;

		resetRtkCache();

		const secondPromise = getRtkStatus();
		secondChild.stdout.emit("data", "rtk 0.28.3\n");
		secondChild.emit("close", 0);
		await secondPromise;

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
			expect.objectContaining({
				timeout: 200,
				encoding: "utf-8",
			}),
			expect.any(Function),
		);
	});

	it("R2/AC-3: returns original on non-zero exit code", async () => {
		const error = new Error("Command failed") as ExecFileException;
		error.code = 1;
		mockExecFileError(error);
		expect(await rewriteCommand("unknown-cmd")).toBe("unknown-cmd");
	});

	it("R2/AC-4: returns original on spawn error (fail-open)", async () => {
		const error = new Error("spawn rtk ENOENT") as NodeJS.ErrnoException;
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
	function mockAvailableRtk(): void {
		const child = createMockChildProcess();
		mockedSpawn.mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);
		queueMicrotask(() => {
			child.stdout.emit("data", "rtk 0.28.2\n");
			child.emit("close", 0);
		});
	}

	it("R4/AC-1: rewrites context.command via rtk rewrite", async () => {
		mockAvailableRtk();
		mockExecFileSuccess("rtk git status\n");
		const hook = createRtkSpawnHook();
		const context = { command: "git status", cwd: "/tmp", env: {} as NodeJS.ProcessEnv };
		const result = await hook(context);
		expect(result.command).toBe("rtk git status");
		expect(result.cwd).toBe("/tmp");
	});

	it("R4/AC-4: preserves commandPrefix in context (prefix already applied before hook)", async () => {
		mockAvailableRtk();
		mockExecFileSuccess("shopt -s expand_aliases\nrtk git status\n");
		const hook = createRtkSpawnHook();
		const prefixedCommand = "shopt -s expand_aliases\ngit status";
		const context = { command: prefixedCommand, cwd: "/tmp", env: {} as NodeJS.ProcessEnv };
		const result = await hook(context);
		expect(result.command).toBe("shopt -s expand_aliases\nrtk git status");
	});

	it("R2/AC-8: skips rewrite entirely when RTK is unavailable", async () => {
		const child = createMockChildProcess();
		mockedSpawn.mockReturnValueOnce(child as unknown as ReturnType<typeof spawn>);
		queueMicrotask(() => child.emit("close", 1));
		const hook = createRtkSpawnHook();
		const context = { command: "git status", cwd: "/tmp", env: {} as NodeJS.ProcessEnv };
		const result = await hook(context);
		expect(result).toBe(context);
		expect(mockedExecFile).not.toHaveBeenCalled();
	});

	it("returns original context when command is unchanged", async () => {
		mockAvailableRtk();
		const error = new Error("exit 1") as ExecFileException;
		error.code = 1;
		mockExecFileError(error);
		const hook = createRtkSpawnHook();
		const context = { command: "unknown-cmd", cwd: "/tmp", env: {} as NodeJS.ProcessEnv };
		const result = await hook(context);
		expect(result).toBe(context);
	});
});
