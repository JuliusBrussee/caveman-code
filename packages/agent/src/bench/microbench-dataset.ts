// MicroBench dataset loader — discovers tasks from directory layout.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BenchInstance } from "./swe-bench.js";

export interface MicroBenchTaskMeta {
	difficulty: "easy" | "medium" | "hard";
	language: "python" | "typescript";
	tags: string[];
}

export interface MicroBenchInstance extends BenchInstance {
	taskDir: string;
	setupDir: string | null;
	verifyScript: string;
	meta: MicroBenchTaskMeta;
}

/**
 * Discover and load microbench tasks from a directory layout.
 *
 * Each task directory contains:
 *   meta.json   — { difficulty, language, tags }
 *   prompt.txt  — problem statement for the agent
 *   verify.sh   — exit 0 = PASS, exit 1 = FAIL
 *   setup/      — (optional) source files to copy into workdir
 */
export function loadMicroBenchTasks(
	tasksDir: string,
	opts?: {
		difficulty?: string;
		language?: string;
		limit?: number;
	},
): MicroBenchInstance[] {
	if (!existsSync(tasksDir)) {
		throw new Error(`MicroBench tasks directory not found: ${tasksDir}`);
	}

	const dirs = readdirSync(tasksDir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name)
		.sort();

	let instances: MicroBenchInstance[] = [];

	for (const dir of dirs) {
		const fullDir = join(tasksDir, dir);
		const metaPath = join(fullDir, "meta.json");
		const promptPath = join(fullDir, "prompt.txt");
		const verifyPath = join(fullDir, "verify.sh");

		if (!existsSync(metaPath) || !existsSync(promptPath) || !existsSync(verifyPath)) {
			continue;
		}

		const meta: MicroBenchTaskMeta = JSON.parse(readFileSync(metaPath, "utf-8"));
		const prompt = readFileSync(promptPath, "utf-8").trim();
		const setupDir = existsSync(join(fullDir, "setup")) ? join(fullDir, "setup") : null;

		instances.push({
			id: dir,
			repo: "microbench",
			base_commit: "local",
			problem_statement: prompt,
			taskDir: fullDir,
			setupDir,
			verifyScript: verifyPath,
			meta,
		});
	}

	if (opts?.difficulty) {
		instances = instances.filter((i) => i.meta.difficulty === opts.difficulty);
	}
	if (opts?.language) {
		instances = instances.filter((i) => i.meta.language === opts.language);
	}
	if (opts?.limit && opts.limit > 0) {
		instances = instances.slice(0, opts.limit);
	}

	return instances;
}
