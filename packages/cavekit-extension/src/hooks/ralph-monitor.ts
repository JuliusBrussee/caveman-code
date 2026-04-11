/**
 * Ralph Loop monitor hooks.
 *
 * turn_end: Updates the forge widget with current iteration state.
 * agent_end: Evaluates completion conditions and shows forge rituals.
 *
 * The widget uses box-drawing characters for a terminal-native look
 * consistent with the caveman brand (R-002: terminal ritual moments,
 * R-003: functional polish over novelty).
 */

import type { ExtensionAPI } from "cave";
import type { CaveKitConfig } from "../config/index.js";
import { formatSummaryLine } from "../ralph/findings.js";
import type { RalphState } from "../ralph/state.js";
import { convergenceLabel, isCeiling, isClean, persistState, restoreState } from "../ralph/state.js";

// ---------------------------------------------------------------------------
// Widget rendering
// ---------------------------------------------------------------------------

function renderForgeWidget(state: RalphState): string[] {
	const latest = state.findingsHistory[state.findingsHistory.length - 1];
	const findingsLine = latest ? formatSummaryLine(latest) : "—";
	const phaseLabel = state.phase.toUpperCase();
	const convergence = convergenceLabel(state);

	// Fire bar: visual convergence indicator
	const barLen = 10;
	const filled = latest ? Math.max(0, barLen - Math.min(latest.total, barLen)) : 0;
	const fireBar = "|".repeat(filled) + ".".repeat(barLen - filled);

	return [
		"\u250C\u2500 RALPH \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
		`${`\u2502 Round: ${state.iteration}/${state.maxIterations} [${phaseLabel}]`.padEnd(27)}\u2502`,
		`${`\u2502 Findings: ${findingsLine}`.padEnd(27)}\u2502`,
		`${`\u2502 Fire: [${fireBar}]`.padEnd(27)}\u2502`,
		`${`\u2502 ${convergence}`.padEnd(27)}\u2502`,
		state.kitDomain
			? `${`\u2502 Kit: ${state.kitDomain}`.padEnd(27).slice(0, 27)}\u2502`
			: `${`\u2502 Kit: (all)`.padEnd(27)}\u2502`,
		"\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
	];
}

function renderForgeComplete(state: RalphState): string[] {
	const latest = state.findingsHistory[state.findingsHistory.length - 1];
	const findingsLine = latest ? formatSummaryLine(latest) : "0C 0H 0M 0L";

	return [
		"\u250C\u2500 FORGED \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
		`${`\u2502 Rounds: ${state.iteration}`.padEnd(27)}\u2502`,
		`${`\u2502 Findings: ${findingsLine}`.padEnd(27)}\u2502`,
		`${`\u2502 Status: hardened`.padEnd(27)}\u2502`,
		"\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
	];
}

// ---------------------------------------------------------------------------
// Hook registration
// ---------------------------------------------------------------------------

export function registerRalphMonitor(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.on("turn_end", async (_event, ctx) => {
		const state = restoreState(ctx);
		if (!state?.active) return;

		// Update the forge widget
		ctx.ui.setWidget("ralph-forge", renderForgeWidget(state));
		ctx.ui.setStatus("ralph", `Ralph ${state.iteration}/${state.maxIterations}`);
	});

	pi.on("agent_end", async (_event, ctx) => {
		const state = restoreState(ctx);
		if (!state?.active) return;

		// Check for ceiling — warn user
		if (isCeiling(state)) {
			ctx.ui.notify(
				`Ralph Loop ceiling detected — findings flat for 3+ rounds. Consider adjusting approach or cancelling with /ck:ralph cancel`,
				"warning",
			);
		}

		// Check for clean pass — forge complete
		if (isClean(state) && state.findingsHistory.length > 0) {
			state.active = false;
			persistState(pi, state);

			ctx.ui.setWidget("ralph-forge", renderForgeComplete(state));
			ctx.ui.setStatus("ralph", undefined);
			ctx.ui.notify("Ralph Loop complete — code hardened.", "info");
			return;
		}

		// Check for max iterations
		if (state.iteration >= state.maxIterations) {
			state.active = false;
			persistState(pi, state);

			ctx.ui.setWidget("ralph-forge", undefined);
			ctx.ui.setStatus("ralph", undefined);
			ctx.ui.notify(
				`Ralph Loop ended — max iterations (${state.maxIterations}) reached. Review ralph-findings.md for remaining items.`,
				"warning",
			);
		}
	});

	// Restore widget on session resume
	pi.on("session_start", async (_event, ctx) => {
		const state = restoreState(ctx);
		if (!state?.active) return;

		ctx.ui.setWidget("ralph-forge", renderForgeWidget(state));
		ctx.ui.setStatus("ralph", `Ralph ${state.iteration}/${state.maxIterations}`);
	});
}
