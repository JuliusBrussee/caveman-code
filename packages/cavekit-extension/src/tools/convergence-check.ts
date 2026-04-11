/**
 * convergence_check — Query whether the current task is converging or plateauing.
 *
 * Reads context/impl/loop-log.md and applies the shared convergence-analysis
 * logic to detect convergence, ceiling, or active progress.
 * Used by build subagents to decide whether to escalate.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Type } from "@cave/ai";
import { defineTool } from "cave";
import { analyzeConvergence, parseLoopLog } from "../wave/convergence-analysis.js";

export const convergenceCheckTool = defineTool({
	name: "convergence_check",
	label: "Convergence Check",
	description:
		"Check whether the build is converging toward completion or stuck in a plateau. Reads loop-log for pass-rate history across all iterations.",
	parameters: Type.Object({
		taskId: Type.Optional(Type.String({ description: "Optional task ID to focus on (e.g. T-031)" })),
		currentError: Type.Optional(Type.String({ description: "Current error message, if any" })),
	}),
	async execute(_id, params, _signal, _onUpdate, ctx) {
		const cwd = ctx?.cwd ?? process.cwd();
		const loopLogPath = path.join(cwd, "context", "impl", "loop-log.md");

		if (!fs.existsSync(loopLogPath)) {
			return {
				details: undefined,
				content: [
					{
						type: "text",
						text: "No loop-log.md found at context/impl/loop-log.md. Run /ck:build first.",
					},
				],
			};
		}

		const content = fs.readFileSync(loopLogPath, "utf8");

		// If a taskId is provided, scope the analysis to that task's section
		let analysisContent = content;
		if (params.taskId) {
			const taskSection = content.match(
				new RegExp(
					`(###\\s+Iteration\\s+\\d+[\\s\\S]*?Task:[^\\n]*${params.taskId}[\\s\\S]*?)(?=###\\s+Iteration|$)`,
					"gi",
				),
			);
			if (taskSection && taskSection.length > 0) {
				analysisContent = taskSection.join("\n\n");
			}
		}

		const iterations = parseLoopLog(analysisContent);

		// Append current error as context (does not affect pass-rate analysis)
		const errorNote = params.currentError ? `\nCurrent error: ${params.currentError.slice(0, 200)}` : "";

		if (iterations.length === 0) {
			appendLoopLog(loopLogPath, params.taskId ?? "unknown", 1, params.currentError);
			return {
				details: undefined,
				content: [
					{
						type: "text",
						text: `FRESH — first attempt, proceed normally.${errorNote}`,
					},
				],
			};
		}

		const report = analyzeConvergence(iterations);

		const statusLabel =
			report.status === "converged"
				? "CONVERGED"
				: report.status === "ceiling"
					? "PLATEAU/CEILING"
					: report.status === "progressing"
						? "CONVERGING"
						: "INSUFFICIENT DATA";

		const lines = [
			`Task: ${params.taskId ?? "(all)"}`,
			`Iterations: ${report.iterations.length}`,
			`Assessment: ${statusLabel}`,
		];

		if (report.latestPassRate !== null) {
			lines.push(`Pass rate: ${(report.latestPassRate * 100).toFixed(1)}%`);
		}
		if (report.trend !== null) {
			const sign = report.trend >= 0 ? "+" : "";
			lines.push(`Trend: ${sign}${(report.trend * 100).toFixed(1)}%`);
		}

		lines.push("", "Recommendations:");
		for (const rec of report.recommendations) {
			lines.push(`  • ${rec}`);
		}

		lines.push(errorNote);

		// Record this invocation in the loop log
		appendLoopLog(loopLogPath, params.taskId ?? "general", report.iterations.length + 1, params.currentError);

		return {
			details: undefined,
			content: [
				{
					type: "text",
					text: lines.filter((l) => l !== undefined).join("\n"),
				},
			],
		};
	},
});

function appendLoopLog(logPath: string, taskId: string, iteration: number, error?: string): void {
	const entry = [
		`### Iteration ${iteration} — ${new Date().toISOString()}`,
		error ? `Error: ${error.slice(0, 200)}` : "Status: in progress",
		"",
	].join("\n");

	const existing = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "# CaveKit Loop Log\n\n";
	const taskSection = `## ${taskId}\n`;

	if (existing.includes(taskSection)) {
		const updated = existing.replace(new RegExp(`(## ${taskId}\\n)([\\s\\S]*?)(?=## T-|$)`, "i"), `$1$2${entry}`);
		fs.writeFileSync(logPath, updated, "utf8");
	} else {
		fs.writeFileSync(logPath, `${existing}${taskSection}${entry}`, "utf8");
	}
}
