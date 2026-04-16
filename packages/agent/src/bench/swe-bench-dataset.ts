import type { BenchInstance } from "./swe-bench.js";

/** HuggingFace Datasets Server rows API — works with parquet-backed datasets. */
const ROWS_API_BASE =
	"https://datasets-server.huggingface.co/rows?dataset=princeton-nlp/SWE-bench_Verified&config=default&split=test";

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
	let instances: BenchInstance[] = [];
	const pageSize = 100;
	let offset = 0;
	let hasMore = true;

	while (hasMore) {
		const url = `${ROWS_API_BASE}&offset=${offset}&length=${pageSize}`;
		const response = await fetch(url, { signal: opts?.signal });
		if (!response.ok) {
			throw new Error(`SWE-bench dataset fetch failed: ${response.status} (${url})`);
		}
		const data = (await response.json()) as { rows: Array<{ row: RawInstance }>; num_rows_total: number };

		for (const { row: raw } of data.rows) {
			instances.push({
				id: raw.instance_id,
				repo: raw.repo,
				base_commit: raw.base_commit,
				problem_statement: raw.problem_statement,
			});
		}

		offset += data.rows.length;
		hasMore = data.rows.length === pageSize && offset < data.num_rows_total;
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
