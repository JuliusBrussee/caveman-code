/**
 * acceptance_check — Validate a specific acceptance criterion against current code.
 *
 * Used by build subagents to self-monitor their own progress.
 */

import { Type } from "@cavepi/pi-ai";
import { defineTool } from "@cavepi/pi-coding-agent";

export const acceptanceCheckTool = defineTool({
	name: "acceptance_check",
	label: "Acceptance Check",
	description:
		"Check whether a specific acceptance criterion from a kit requirement is met by the current code. Returns a pass/fail assessment with evidence.",
	parameters: Type.Object({
		requirement: Type.String({ description: "Requirement ID (e.g. R-001)" }),
		criterion: Type.String({ description: "Acceptance criterion (e.g. AC-1)" }),
		evidence: Type.Optional(
			Type.String({ description: "Code snippet, test output, or other evidence to validate against" }),
		),
	}),
	async execute(_id, params, _signal, _onUpdate, _ctx) {
		// This tool signals to the LLM that it should perform a structured
		// self-assessment. The actual check is done by the LLM reasoning
		// about the criterion and any provided evidence.
		return {
			details: undefined,
			content: [
				{
					type: "text" as const,
					text: [
						`Acceptance check requested:`,
						`- Requirement: ${params.requirement}`,
						`- Criterion: ${params.criterion}`,
						params.evidence
							? `- Evidence provided: ${params.evidence.slice(0, 200)}...`
							: "- No evidence provided",
						"",
						"Please assess whether this criterion is met based on the current codebase state.",
						"Respond with: PASS, PARTIAL, or FAIL, followed by a brief explanation.",
					].join("\n"),
				},
			],
		};
	},
});
