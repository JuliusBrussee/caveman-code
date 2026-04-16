import type { BenchInstance } from "./swe-bench.js";

const DATASET_URL =
	"https://huggingface.co/datasets/princeton-nlp/SWE-bench_Verified/resolve/main/data/test.jsonl";

interface RawInstance {
	instance_id: string;
	repo: string;
	base_commit: string;
	problem_statement: string;
	patch: string;
	test_patch: string;
	hints_text: string;
	created_at: string;
	version: string;
	FAIL_TO_PASS: string;
	PASS_TO_PASS: string;
	environment_setup_commit: string;
}

export async function loadSweBenchVerified(opts?: {
	limit?: number;
	repos?: string[];
	signal?: AbortSignal;
}): Promise<BenchInstance[]> {
	const response = await fetch(DATASET_URL, {
		signal: opts?.signal,
		redirect: "follow",
	});
	if (!response.ok) {
		throw new Error(`SWE-bench dataset fetch failed: ${response.status}`);
	}
	const text = await response.text();
	const lines = text.trim().split("\n");
	let instances: BenchInstance[] = [];

	for (const line of lines) {
		if (!line.trim()) continue;
		const raw: RawInstance = JSON.parse(line);
		instances.push({
			id: raw.instance_id,
			repo: raw.repo,
			base_commit: raw.base_commit,
			problem_statement: raw.problem_statement,
		});
	}

	// Filter by repos if specified
	if (opts?.repos?.length) {
		instances = instances.filter((i) => opts.repos!.includes(i.repo));
	}

	// Limit
	if (opts?.limit && opts.limit > 0) {
		instances = instances.slice(0, opts.limit);
	}

	return instances;
}

/** Load from a local JSONL file instead of fetching from HuggingFace. */
export async function loadSweBenchFromFile(
	filePath: string,
	opts?: {
		limit?: number;
		repos?: string[];
	},
): Promise<BenchInstance[]> {
	const { readFile } = await import("node:fs/promises");
	const text = await readFile(filePath, "utf-8");
	const lines = text.trim().split("\n");
	let instances: BenchInstance[] = [];

	for (const line of lines) {
		if (!line.trim()) continue;
		const raw: RawInstance = JSON.parse(line);
		instances.push({
			id: raw.instance_id,
			repo: raw.repo,
			base_commit: raw.base_commit,
			problem_statement: raw.problem_statement,
		});
	}

	if (opts?.repos?.length) {
		instances = instances.filter((i) => opts.repos!.includes(i.repo));
	}
	if (opts?.limit && opts.limit > 0) {
		instances = instances.slice(0, opts.limit);
	}

	return instances;
}
