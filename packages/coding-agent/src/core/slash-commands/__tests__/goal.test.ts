import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { goalPaths, listGoals, readState } from "../../goal-loop/goal-state.js";
import { runGoalSlashCommand } from "../goal.js";

describe("runGoalSlashCommand", () => {
	const dirs: string[] = [];

	afterEach(() => {
		for (const dir of dirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	const makeCwd = (): string => {
		const cwd = mkdtempSync(join(tmpdir(), "cave-goal-slash-"));
		dirs.push(cwd);
		return cwd;
	};

	it("shows help with no args", async () => {
		const result = await runGoalSlashCommand("", {
			cwd: makeCwd(),
			spawnDriver: () => {},
		});

		expect(result.exitCode).toBe(0);
		expect(result.output).toContain("/goal <text>");
	});

	it("starts goal from bare text and launches driver", async () => {
		const cwd = makeCwd();
		const spawned: string[] = [];
		const result = await runGoalSlashCommand("add regression coverage", {
			cwd,
			spawnDriver: (id) => {
				spawned.push(id);
			},
		});

		expect(result.exitCode).toBe(0);
		expect(spawned).toHaveLength(1);
		const goalId = spawned[0]!;
		const paths = goalPaths(cwd, goalId);
		const goalMd = readFileSync(paths.goalMd, "utf8");
		expect(goalMd).toContain("add regression coverage");
		expect(readState(paths)?.status).toBe("running");
		expect(result.output).toContain(`Goal ${goalId} created.`);
	});

	it("lists, reports status, and cancels goals", async () => {
		const cwd = makeCwd();
		let goalId = "";
		await runGoalSlashCommand("start fix goal wiring", {
			cwd,
			spawnDriver: (id) => {
				goalId = id;
			},
		});

		const listed = listGoals(cwd);
		expect(listed).toHaveLength(1);
		expect(listed[0]?.id).toBe(goalId);

		const listResult = await runGoalSlashCommand("list", {
			cwd,
			spawnDriver: () => {},
		});
		expect(listResult.output).toContain(goalId);

		const statusResult = await runGoalSlashCommand(`status ${goalId}`, {
			cwd,
			spawnDriver: () => {},
		});
		expect(statusResult.exitCode).toBe(0);
		expect(statusResult.output).toContain("Goal:");
		expect(statusResult.output).toContain("fix goal wiring");

		const cancelResult = await runGoalSlashCommand(`cancel ${goalId}`, {
			cwd,
			spawnDriver: () => {},
		});
		expect(cancelResult.exitCode).toBe(0);
		expect(readState(goalPaths(cwd, goalId))?.status).toBe("cancelled");
	});
});
