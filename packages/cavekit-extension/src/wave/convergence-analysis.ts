/**
 * Convergence analysis — shared logic for the /ck:convergence command and
 * the convergence_check tool.
 *
 * Parses loop-log.md iteration blocks and classifies the pass-rate trajectory:
 *   - converged:    stable (±5%) for 3+ consecutive iterations
 *   - ceiling:      no improvement (delta ≤ 0) for 3+ consecutive iterations
 *                   but not fully stable (i.e. oscillating downward or flat low)
 *   - progressing:  pass rate is increasing meaningfully
 *   - insufficient: fewer than 2 iterations with measurable pass rates
 */

/** One parsed iteration from loop-log.md */
export interface IterationRecord {
	/** Human-readable label, e.g. "Iteration 7" or "### Iteration 7" */
	label: string;
	/** 0.0–1.0, or null if no Validation/Acceptance line was found */
	passRate: number | null;
	/** Raw numerator from "Acceptance N/M" */
	passed: number | null;
	/** Raw denominator from "Acceptance N/M" */
	total: number | null;
	/** Raw status string, e.g. "DONE" */
	status: string | null;
}

export type ConvergenceStatus = "converged" | "ceiling" | "progressing" | "insufficient";

export interface ConvergenceReport {
	status: ConvergenceStatus;
	/** All parsed iteration records */
	iterations: IterationRecord[];
	/** Pass rate of the most recent iteration (0.0–1.0) or null */
	latestPassRate: number | null;
	/**
	 * Difference between oldest and newest pass rate in the last 3 measurable
	 * iterations (positive = improving). Null if < 2 measurable iterations.
	 */
	trend: number | null;
	recommendations: string[];
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const ITERATION_HEADING = /^###\s+Iteration\s+(\d+)/m;
const ACCEPTANCE_LINE = /Acceptance\s+(\d+)\/(\d+)/i;
const STATUS_LINE = /\*\*Status:\*\*\s*(\w+)/i;

/**
 * Split loop-log.md into per-iteration blocks and extract pass rates.
 *
 * Each block is delimited by a `### Iteration N` heading.
 */
export function parseLoopLog(content: string): IterationRecord[] {
	// Split on every "### Iteration N" boundary
	const blocks = content.split(/(?=^###\s+Iteration\s+\d+)/m).filter((b) => b.trim().length > 0);

	const records: IterationRecord[] = [];

	for (const block of blocks) {
		const headingMatch = block.match(ITERATION_HEADING);
		if (!headingMatch) continue;

		const label = `Iteration ${headingMatch[1]}`;

		// Pass rate from Validation line: "Acceptance N/M"
		const accMatch = block.match(ACCEPTANCE_LINE);
		let passed: number | null = null;
		let total: number | null = null;
		let passRate: number | null = null;

		if (accMatch) {
			passed = parseInt(accMatch[1], 10);
			total = parseInt(accMatch[2], 10);
			passRate = total > 0 ? passed / total : null;
		}

		const statusMatch = block.match(STATUS_LINE);
		const status = statusMatch ? statusMatch[1].toUpperCase() : null;

		records.push({ label, passRate, passed, total, status });
	}

	return records;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

const STABILITY_WINDOW = 3;
const STABILITY_TOLERANCE = 0.05; // ±5%

/**
 * Analyse a sequence of iteration records and classify the trajectory.
 */
export function analyzeConvergence(iterations: IterationRecord[]): ConvergenceReport {
	// Only consider iterations that have measurable pass rates
	const measured = iterations.filter((r) => r.passRate !== null);

	if (measured.length < 2) {
		return {
			status: "insufficient",
			iterations,
			latestPassRate: measured.length === 1 ? measured[0].passRate : null,
			trend: null,
			recommendations: [
				"Not enough data yet — at least 2 iterations with Acceptance lines are needed.",
				"Continue building and re-run /ck:convergence after the next iteration.",
			],
		};
	}

	const latestPassRate = measured[measured.length - 1].passRate as number;
	const window = measured.slice(-STABILITY_WINDOW);

	// Trend: delta between first and last in window
	const windowFirst = window[0].passRate as number;
	const windowLast = window[window.length - 1].passRate as number;
	const trend = windowLast - windowFirst;

	let status: ConvergenceStatus;
	let recommendations: string[];

	if (window.length >= STABILITY_WINDOW) {
		const rates = window.map((r) => r.passRate as number);
		const max = Math.max(...rates);
		const min = Math.min(...rates);
		const spread = max - min;

		if (spread <= STABILITY_TOLERANCE) {
			if (latestPassRate >= 0.95) {
				// High stable pass rate → truly converged
				status = "converged";
				recommendations = [
					"Pass rate has been stable at a high level for 3+ iterations.",
					"Consider moving to the next tier or running /ck:inspect for a gap analysis.",
				];
			} else {
				// Stable but below 95% → ceiling
				status = "ceiling";
				recommendations = buildCeilingRecommendations(latestPassRate, trend);
			}
		} else if (trend > STABILITY_TOLERANCE) {
			status = "progressing";
			recommendations = [
				`Pass rate improved by ${formatPct(trend)} over the last ${window.length} iterations.`,
				"Keep iterating — you are making meaningful progress.",
			];
		} else {
			// Spread > tolerance but no upward trend → ceiling
			status = "ceiling";
			recommendations = buildCeilingRecommendations(latestPassRate, trend);
		}
	} else {
		// Fewer than STABILITY_WINDOW measured iterations
		if (trend > STABILITY_TOLERANCE) {
			status = "progressing";
			recommendations = [
				`Pass rate improved by ${formatPct(trend)} across the measured iterations.`,
				"Continue — convergence window not yet reached (need 3 measured iterations).",
			];
		} else if (trend < -STABILITY_TOLERANCE) {
			status = "ceiling";
			recommendations = buildCeilingRecommendations(latestPassRate, trend);
		} else {
			status = "insufficient";
			recommendations = [
				"Pass rate is flat but window is still short. Continue iterating.",
				`Need ${STABILITY_WINDOW - window.length} more measured iteration(s) to confirm convergence or ceiling.`,
			];
		}
	}

	return { status, iterations, latestPassRate, trend, recommendations };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCeilingRecommendations(passRate: number, trend: number): string[] {
	const recs: string[] = [];

	if (trend < 0) {
		recs.push("Pass rate is declining — a regression may have been introduced.");
		recs.push("Review recent changes and consider reverting the last problematic edit.");
	} else {
		recs.push(`Pass rate has stalled at ${formatPct(passRate)} for 3+ iterations despite continued work.`);
	}

	if (passRate < 0.5) {
		recs.push("Less than half of tests pass — consider simplifying the implementation or fixing test setup.");
	} else if (passRate < 0.8) {
		recs.push("Moderate pass rate. Isolate failing tests and address them one category at a time.");
	} else {
		recs.push(
			"High pass rate but not converging. The remaining failures may need a targeted fix or a different approach.",
		);
	}

	recs.push("Run /ck:inspect to identify specific gap areas, or escalate to a human reviewer.");

	return recs;
}

function formatPct(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}
