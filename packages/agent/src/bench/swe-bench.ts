// T-132, T-133: SWE-bench Verified harness adapter + per-instance cost caps.

export interface BenchInstance {
	id: string;
	repo: string;
	base_commit: string;
	problem_statement: string;
}

export interface BenchInstanceResult {
	instance_id: string;
	resolved: boolean;
	attempts: number;
	dollars_spent: number;
	cost_cap_failure?: boolean;
	duration_ms: number;
	traces: string[];
}

export interface BenchRunOptions {
	/** Hard dollar cap per instance. Exceed fires cost_cap_failure. */
	perInstanceCapDollars: number;
	/** Runs `instance` and returns the resolved state + cost. */
	runInstance(instance: BenchInstance): Promise<{
		resolved: boolean;
		attempts: number;
		dollarsSpent: number;
		durationMs: number;
		traces: string[];
	}>;
}

export async function runBench(
	instances: BenchInstance[],
	opts: BenchRunOptions,
): Promise<BenchInstanceResult[]> {
	const results: BenchInstanceResult[] = [];
	for (const instance of instances) {
		const run = await opts.runInstance(instance);
		const capExceeded = run.dollarsSpent > opts.perInstanceCapDollars;
		results.push({
			instance_id: instance.id,
			resolved: run.resolved,
			attempts: run.attempts,
			dollars_spent: run.dollarsSpent,
			cost_cap_failure: capExceeded ? true : undefined,
			duration_ms: run.durationMs,
			traces: run.traces,
		});
	}
	return results;
}

export function aggregateBench(results: BenchInstanceResult[]): {
	total: number;
	resolved: number;
	resolvedRate: number;
	dollarsTotal: number;
	capFailures: number;
} {
	return {
		total: results.length,
		resolved: results.filter((r) => r.resolved).length,
		resolvedRate: results.length === 0 ? 0 : results.filter((r) => r.resolved).length / results.length,
		dollarsTotal: results.reduce((acc, r) => acc + r.dollars_spent, 0),
		capFailures: results.filter((r) => r.cost_cap_failure).length,
	};
}

export { loadSweBenchVerified, loadSweBenchFromFile } from "./swe-bench-dataset.js";
