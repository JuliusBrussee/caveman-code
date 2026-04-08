/**
 * /ck:convergence — Monitor test pass-rate trends across build iterations.
 *
 * Reads context/impl/loop-log.md, extracts per-iteration pass rates,
 * and classifies the current trajectory as converging, ceiling, or progressing.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";
import { analyzeConvergence, type ConvergenceReport, parseLoopLog } from "../wave/convergence-analysis.js";

export function registerConvergenceCommand(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.registerCommand("ck:convergence", {
		description: "Monitor test pass-rate convergence across build iterations",
		getArgumentCompletions: () => null,
		handler: async (_args, ctx) => {
			const cwd = ctx.cwd;
			const loopLogPath = path.join(cwd, "context", "impl", "loop-log.md");

			if (!fs.existsSync(loopLogPath)) {
				ctx.ui.notify(
					"No loop-log.md found at context/impl/loop-log.md.\nRun /ck:build first to generate iteration history.",
					"warning",
				);
				return;
			}

			const content = fs.readFileSync(loopLogPath, "utf8");
			const iterations = parseLoopLog(content);

			if (iterations.length === 0) {
				ctx.ui.notify(
					"Loop log exists but contains no parseable iterations.\nEnsure iterations include Validation lines (e.g. Acceptance 17/17).",
					"warning",
				);
				return;
			}

			const report = analyzeConvergence(iterations);
			const output = formatConvergenceReport(report);
			ctx.ui.notify(output, "info");
		},
	});
}

function formatConvergenceReport(report: ConvergenceReport): string {
	const statusEmoji =
		report.status === "converged"
			? "✓ CONVERGED"
			: report.status === "ceiling"
				? "⚠ CEILING DETECTED"
				: report.status === "progressing"
					? "● PROGRESSING"
					: "○ INSUFFICIENT DATA";

	const lines: string[] = [
		"=== CaveKit Convergence Monitor ===",
		"",
		`Status: ${statusEmoji}`,
		`Iterations analysed: ${report.iterations.length}`,
	];

	if (report.latestPassRate !== null) {
		lines.push(`Current pass rate: ${formatPct(report.latestPassRate)}`);
	}

	if (report.trend !== null) {
		const trendSign = report.trend > 0 ? "+" : "";
		lines.push(`Trend (last 3): ${trendSign}${formatPct(report.trend)}`);
	}

	if (report.iterations.length > 0) {
		lines.push("", "Iteration history:");
		for (const iter of report.iterations) {
			const pctStr = iter.passRate !== null ? ` — ${formatPct(iter.passRate)}` : " — (no pass rate)";
			const passStr = iter.passed !== null && iter.total !== null ? ` (${iter.passed}/${iter.total})` : "";
			lines.push(`  ${iter.label}${pctStr}${passStr}`);
		}
	}

	lines.push("", "Recommendation:");
	for (const line of report.recommendations) {
		lines.push(`  • ${line}`);
	}

	return lines.join("\n");
}

function formatPct(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}
