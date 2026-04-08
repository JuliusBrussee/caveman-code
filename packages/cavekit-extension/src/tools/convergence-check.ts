/**
 * convergence_check — Query whether the current task is converging or plateauing.
 *
 * Reads loop-log.md to detect repeated errors or stalled progress.
 * Used by build subagents to decide whether to escalate.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Type } from "@cavepi/pi-ai";
import { defineTool } from "@cavepi/pi-coding-agent";

export const convergenceCheckTool = defineTool({
	name: "convergence_check",
	label: "Convergence Check",
	description:
		"Check whether a task is converging toward completion or stuck in a plateau. Reads loop-log for iteration history.",
	parameters: Type.Object({
		taskId: Type.String({ description: "Task ID to check (e.g. T-001)" }),
		currentError: Type.Optional(Type.String({ description: "Current error message, if any" })),
	}),
	async execute(_id, params, _signal, _onUpdate, ctx) {
		const cwd = ctx?.cwd ?? process.cwd();
		const loopLogPath = path.join(cwd, "context", "loop-log.md");

		let history = "";
		if (fs.existsSync(loopLogPath)) {
			const content = fs.readFileSync(loopLogPath, "utf8");
			// Extract entries for this task
			const taskSection = content.match(new RegExp(`## ${params.taskId}[\\s\\S]*?(?=## T-|$)`, "i"));
			if (taskSection) history = taskSection[0];
		}

		// Count iterations and detect repeated errors
		const iterations = (history.match(/### Iteration/g) || []).length;
		const isPlateauing = params.currentError && history.includes(params.currentError.slice(0, 50));

		const assessment = isPlateauing
			? "PLATEAU — same error repeating. Consider a different approach or escalate."
			: iterations === 0
				? "FRESH — first attempt, proceed normally."
				: iterations < 3
					? "CONVERGING — making progress, continue."
					: "WARNING — high iteration count, consider simplifying approach.";

		// Append to loop log
		appendLoopLog(loopLogPath, params.taskId, iterations + 1, params.currentError);

		return {
			details: undefined,
			content: [
				{
					type: "text",
					text: [
						`Task: ${params.taskId}`,
						`Iterations: ${iterations + 1}`,
						`Assessment: ${assessment}`,
						history ? `\nRecent history:\n${history.slice(0, 300)}` : "",
					]
						.filter(Boolean)
						.join("\n"),
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
