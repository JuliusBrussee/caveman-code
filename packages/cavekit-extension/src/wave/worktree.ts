/**
 * Git worktree isolation for parallel wave tasks.
 *
 * Each wave task gets a dedicated worktree so parallel agents don't conflict.
 * After a wave completes, changes are merged back to the main worktree.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { rtkExec } from "../rtk-exec.js";

export interface WorktreeHandle {
	taskId: string;
	path: string;
	branch: string;
	cleanup: () => void;
}

/** Create a git worktree for a task, returning a handle with a cleanup fn. */
export function createWorktree(cwd: string, taskId: string): WorktreeHandle {
	const branch = `ck-task-${taskId.toLowerCase()}-${Date.now()}`;
	const worktreePath = path.join(cwd, ".git", "worktrees-ck", taskId);

	fs.mkdirSync(path.dirname(worktreePath), { recursive: true });

	// Create branch and worktree
	rtkExec(`git worktree add -b "${branch}" "${worktreePath}"`, { cwd, stdio: "ignore" });

	return {
		taskId,
		path: worktreePath,
		branch,
		cleanup: () => removeWorktree(cwd, worktreePath, branch),
	};
}

/** Merge a completed worktree back to the main branch. */
export function mergeWorktree(cwd: string, handle: WorktreeHandle): { success: boolean; conflicts: string[] } {
	try {
		// Commit any uncommitted changes in the worktree
		spawnSync("git", ["add", "-A"], { cwd: handle.path, stdio: "pipe" });
		const status = spawnSync("git", ["status", "--porcelain"], { cwd: handle.path, encoding: "utf8" });
		if (status.stdout?.trim()) {
			spawnSync("git", ["commit", "-m", `ck: complete ${handle.taskId}`], {
				cwd: handle.path,
				stdio: "pipe",
			});
		}

		// Merge back to current branch
		const result = spawnSync("git", ["merge", "--no-ff", handle.branch, "-m", `ck: merge ${handle.taskId}`], {
			cwd,
			encoding: "utf8",
			stdio: "pipe",
		});

		if (result.status !== 0) {
			// Detect conflict files
			const conflicts = (result.stderr || "")
				.split("\n")
				.filter((l) => l.includes("CONFLICT"))
				.map((l) => l.trim());
			return { success: false, conflicts };
		}

		return { success: true, conflicts: [] };
	} catch (err) {
		return { success: false, conflicts: [String(err)] };
	}
}

function removeWorktree(cwd: string, worktreePath: string, branch: string): void {
	try {
		rtkExec(`git worktree remove --force "${worktreePath}"`, { cwd, stdio: "ignore" });
	} catch {
		// Ignore cleanup errors
	}
	try {
		rtkExec(`git branch -D "${branch}"`, { cwd, stdio: "ignore" });
	} catch {
		// Ignore if branch already removed
	}
}

/** Merge all completed worktrees for a wave. Returns tasks with conflicts. */
export async function mergeWave(
	cwd: string,
	handles: WorktreeHandle[],
): Promise<{ taskId: string; conflicts: string[] }[]> {
	const failures: { taskId: string; conflicts: string[] }[] = [];

	for (const handle of handles) {
		const result = mergeWorktree(cwd, handle);
		if (!result.success) {
			failures.push({ taskId: handle.taskId, conflicts: result.conflicts });
		}
		handle.cleanup();
	}

	return failures;
}
