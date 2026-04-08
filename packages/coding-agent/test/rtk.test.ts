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

import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	execFileSync: vi.fn(),
}));

const mockedExecFileSync = vi.mocked(execFileSync);

// We need to re-import after mocking to get fresh module state
let detectRtk: typeof import("../src/core/rtk.js").detectRtk;
let getRtkStatus: typeof import("../src/core/rtk.js").getRtkStatus;
let resetRtkCache: typeof import("../src/core/rtk.js").resetRtkCache;
let rewriteCommand: typeof import("../src/core/rtk.js").rewriteCommand;
let createRtkSpawnHook: typeof import("../src/core/rtk.js").createRtkSpawnHook;

beforeEach(async () => {
	vi.resetModules();
	mockedExecFileSync.mockReset();
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
	it("R1/AC-1: reports available when rtk --version exits 0", () => {
		mockedExecFileSync.mockReturnValue("rtk 0.28.2\n");
		const result = detectRtk();
		expect(result.available).toBe(true);
		expect(result.version).toBe("rtk 0.28.2");
		expect(mockedExecFileSync).toHaveBeenCalledWith(
			"rtk",
			["--version"],
			expect.objectContaining({
				timeout: 5000,
				encoding: "utf-8",
			}),
		);
	});

	it("R1/AC-2: reports unavailable when rtk is not on PATH (ENOENT)", () => {
		mockedExecFileSync.mockImplementation(() => {
			const error = new Error("spawn rtk ENOENT") as NodeJS.ErrnoException;
			error.code = "ENOENT";
			throw error;
		});
		const result = detectRtk();
		expect(result.available).toBe(false);
		expect(result.version).toBeNull();
	});

	it("R1/AC-3: reports unavailable when rtk --version fails (wrong binary)", () => {
		mockedExecFileSync.mockImplementation(() => {
			const error = new Error("Command failed") as Error & { status: number };
			error.status = 1;
			throw error;
		});
		const result = detectRtk();
		expect(result.available).toBe(false);
		expect(result.version).toBeNull();
	});

	it("R1/AC-5: stores version string alongside availability", () => {
		mockedExecFileSync.mockReturnValue("rtk 0.28.2\n");
		const result = detectRtk();
		expect(result.available).toBe(true);
		expect(result.version).toBe("rtk 0.28.2");
	});
});

describe("getRtkStatus", () => {
	it("R1/AC-4: caches result after first check", () => {
		mockedExecFileSync.mockReturnValue("rtk 0.28.2\n");
		const first = getRtkStatus();
		const second = getRtkStatus();
		expect(first).toEqual(second);
		expect(mockedExecFileSync).toHaveBeenCalledTimes(1);
	});

	it("resetRtkCache clears the cache", () => {
		mockedExecFileSync.mockReturnValue("rtk 0.28.2\n");
		getRtkStatus();
		resetRtkCache();
		getRtkStatus();
		expect(mockedExecFileSync).toHaveBeenCalledTimes(2);
	});
});

// ============================================================================
// R2: Command Rewriting
// ============================================================================

describe("rewriteCommand", () => {
	it("R2/AC-1,AC-2: calls rtk rewrite and uses rewritten command on exit 0", () => {
		mockedExecFileSync.mockReturnValue("rtk git status\n");
		const result = rewriteCommand("git status");
		expect(result).toBe("rtk git status");
		expect(mockedExecFileSync).toHaveBeenCalledWith(
			"rtk",
			["rewrite", "git status"],
			expect.objectContaining({
				timeout: 200,
				encoding: "utf-8",
			}),
		);
	});

	it("R2/AC-3: returns original on non-zero exit code", () => {
		mockedExecFileSync.mockImplementation(() => {
			const error = new Error("Command failed") as Error & { status: number };
			error.status = 1;
			throw error;
		});
		expect(rewriteCommand("unknown-cmd")).toBe("unknown-cmd");
	});

	it("R2/AC-4: returns original on spawn error (fail-open)", () => {
		mockedExecFileSync.mockImplementation(() => {
			const error = new Error("spawn rtk ENOENT") as NodeJS.ErrnoException;
			error.code = "ENOENT";
			throw error;
		});
		expect(rewriteCommand("git status")).toBe("git status");
	});

	it("R2/AC-4: returns original on timeout", () => {
		mockedExecFileSync.mockImplementation(() => {
			const error = new Error("TIMEOUT") as Error & { killed: boolean; signal: string };
			error.killed = true;
			error.signal = "SIGTERM";
			throw error;
		});
		expect(rewriteCommand("git status")).toBe("git status");
	});

	it("R2/AC-5: does not double-rewrite commands already prefixed with rtk", () => {
		const result = rewriteCommand("rtk git status");
		expect(result).toBe("rtk git status");
		expect(mockedExecFileSync).not.toHaveBeenCalled();
	});

	it("R2/AC-5: does not rewrite bare rtk command", () => {
		const result = rewriteCommand("rtk");
		expect(result).toBe("rtk");
		expect(mockedExecFileSync).not.toHaveBeenCalled();
	});

	it("R2/AC-6: passes compound commands to rtk rewrite as-is", () => {
		mockedExecFileSync.mockReturnValue("rtk git status && rtk ls\n");
		const result = rewriteCommand("git status && ls");
		expect(result).toBe("rtk git status && rtk ls");
		expect(mockedExecFileSync).toHaveBeenCalledWith("rtk", ["rewrite", "git status && ls"], expect.anything());
	});

	it("R2/AC-8: returns original when rtk rewrite returns empty stdout", () => {
		mockedExecFileSync.mockReturnValue("\n");
		expect(rewriteCommand("git status")).toBe("git status");
	});
});

// ============================================================================
// R4: BashSpawnHook Factory
// ============================================================================

describe("createRtkSpawnHook", () => {
	it("R4/AC-1: rewrites context.command via rtk rewrite", () => {
		mockedExecFileSync.mockReturnValue("rtk git status\n");
		const hook = createRtkSpawnHook();
		const context = { command: "git status", cwd: "/tmp", env: {} as NodeJS.ProcessEnv };
		const result = hook(context);
		expect(result.command).toBe("rtk git status");
		expect(result.cwd).toBe("/tmp");
	});

	it("R4/AC-4: preserves commandPrefix in context (prefix already applied before hook)", () => {
		mockedExecFileSync.mockReturnValue("shopt -s expand_aliases\nrtk git status\n");
		const hook = createRtkSpawnHook();
		// commandPrefix is applied BEFORE the hook runs (see bash.ts)
		const prefixedCommand = "shopt -s expand_aliases\ngit status";
		const context = { command: prefixedCommand, cwd: "/tmp", env: {} as NodeJS.ProcessEnv };
		const result = hook(context);
		expect(result.command).toBe("shopt -s expand_aliases\nrtk git status");
	});

	it("returns original context when command is unchanged", () => {
		mockedExecFileSync.mockImplementation(() => {
			throw new Error("exit 1");
		});
		const hook = createRtkSpawnHook();
		const context = { command: "unknown-cmd", cwd: "/tmp", env: {} as NodeJS.ProcessEnv };
		const result = hook(context);
		expect(result).toBe(context); // same reference
	});
});
