/**
 * ralph_review — LLM-callable tool for adversarial code review via Codex.
 *
 * Diffs current changes against a base branch and reviews them against
 * kit acceptance criteria. Returns structured findings with severity,
 * file references, and actionable suggestions.
 *
 * When called within an active Ralph Loop, automatically updates loop
 * state and convergence tracking.
 */

import * as path from "node:path";
import { Type } from "@cave/ai";
import { defineTool } from "cave";
import { invokeCodexReview, isCodexAvailable } from "../ralph/codex.js";
import { formatFindings, formatSummaryLine, summarizeFindings, writeFindingsToFile } from "../ralph/findings.js";
import { convergenceLabel, restoreState } from "../ralph/state.js";

export const ralphReviewTool = defineTool({
	name: "ralph_review",
	label: "Ralph Review",
	description:
		"Invoke adversarial code review via Codex (OpenAI). Diffs current changes against a base branch " +
		"and reviews them against kit acceptance criteria. Returns structured findings with severity levels " +
		"(P0 critical, P1 high, P2 medium, P3 low). Fix all P0/P1 findings before proceeding.",
	promptGuidelines: [
		"Call ralph_review after completing a build task to get adversarial feedback.",
		"Fix all P0 (critical) and P1 (high) findings before moving to the next task.",
		"P2 and P3 findings are advisory — fix if straightforward, otherwise note and continue.",
	],
	parameters: Type.Object({
		base: Type.Optional(
			Type.String({ description: "Base branch for diff (default: auto-detected from ralph state or 'main')" }),
		),
		domain: Type.Optional(Type.String({ description: "Kit domain to scope the review to" })),
		focus: Type.Optional(Type.String({ description: "Specific area or concern to focus the review on" })),
	}),
	async execute(_id, params, signal, _onUpdate, ctx) {
		const cwd = ctx?.cwd ?? process.cwd();

		// Check Codex availability early
		const available = await isCodexAvailable();
		if (!available) {
			return {
				details: undefined,
				content: [
					{
						type: "text" as const,
						text: [
							"Ralph review unavailable — Codex CLI not found.",
							"",
							"Install: npm i -g @openai/codex",
							"Set: export OPENAI_API_KEY=<your-key>",
							"",
							"Once installed, call ralph_review again.",
						].join("\n"),
					},
				],
			};
		}

		// Resolve base branch from params → ralph state → default
		let baseBranch = params.base ?? "main";
		const ralphState = ctx ? restoreState(ctx) : null;
		if (!params.base && ralphState?.active) {
			baseBranch = ralphState.baseBranch;
		}

		// Invoke Codex
		const result = await invokeCodexReview({
			baseBranch,
			cwd,
			kitDomain: params.domain ?? ralphState?.kitDomain,
			focus: params.focus,
			signal: signal ?? undefined,
		});

		if (result.error) {
			return {
				details: undefined,
				content: [
					{
						type: "text" as const,
						text: `Ralph review error: ${result.error}`,
					},
				],
			};
		}

		// Compute summary
		const iteration = ralphState?.active ? ralphState.iteration : 0;
		const summary = summarizeFindings(result.findings, iteration);

		// Write findings to file
		const findingsPath = writeFindingsToFile(cwd, iteration, result.findings, summary);
		const relFindingsPath = path.relative(cwd, findingsPath);

		// Update ralph state if active
		if (ralphState?.active && ctx) {
			ralphState.findingsHistory.push(summary);
			ralphState.phase = "build"; // Reviewed — switch back to build
			// We need to access pi through a different mechanism; state is persisted by the hook
		}

		// Build response
		const lines: string[] = [
			`Ralph review complete — ${summary.total} finding(s): ${formatSummaryLine(summary)}`,
			"",
			formatFindings(result.findings),
		];

		if (ralphState?.active) {
			lines.push("", `Convergence: ${convergenceLabel(ralphState)}`);
			lines.push(`Findings log: ${relFindingsPath}`);
		}

		if (summary.critical > 0 || summary.high > 0) {
			lines.push("", `Action required: fix ${summary.critical + summary.high} P0/P1 finding(s) before proceeding.`);
		} else if (summary.total === 0) {
			lines.push("", "Clean pass — no findings. Code is hardened.");
		} else {
			lines.push("", "No blocking findings. P2/P3 items are advisory — fix if straightforward.");
		}

		return {
			details: undefined,
			content: [
				{
					type: "text" as const,
					text: lines.join("\n"),
				},
			],
		};
	},
});
