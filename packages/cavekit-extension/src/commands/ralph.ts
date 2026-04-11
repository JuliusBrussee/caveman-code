/**
 * /ck:ralph — Start, control, or query a Ralph Loop with adversarial peer review.
 *
 * Ralph is the resident adversary in the cave. He challenges your code
 * through iterative build/review cycles until it's hardened.
 *
 * Usage:
 *   /ck:ralph [domain]           — Start a ralph loop (optionally scoped to a kit domain)
 *   /ck:ralph status             — Show current forge state
 *   /ck:ralph cancel             — Cancel active loop and show summary
 *   /ck:ralph history            — Show findings trend across iterations
 *
 * Options (passed inline):
 *   --rounds N                   — Max iterations (default: 10)
 *   --base BRANCH                — Base branch for diff (default: auto-detect)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "cave";
import type { CaveKitConfig } from "../config/index.js";
import { isCodexAvailable } from "../ralph/codex.js";
import { formatSummaryLine } from "../ralph/findings.js";
import { convergenceLabel, createInitialState, persistState, type RalphState, restoreState } from "../ralph/state.js";
import { rtkExec } from "../rtk-exec.js";

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

interface RalphArgs {
	subcommand: "start" | "status" | "cancel" | "history";
	domain: string | null;
	rounds: number;
	base: string | null;
}

function parseArgs(raw: string): RalphArgs {
	const tokens = raw.trim().split(/\s+/);
	const result: RalphArgs = { subcommand: "start", domain: null, rounds: 10, base: null };

	const subcommands = new Set(["status", "cancel", "history"]);

	let i = 0;
	while (i < tokens.length) {
		const token = tokens[i];
		if (subcommands.has(token)) {
			result.subcommand = token as RalphArgs["subcommand"];
		} else if (token === "--rounds" && tokens[i + 1]) {
			result.rounds = Math.max(1, Math.min(50, Number.parseInt(tokens[++i], 10) || 10));
		} else if (token === "--base" && tokens[i + 1]) {
			result.base = tokens[++i];
		} else if (token && !token.startsWith("--")) {
			result.domain = token;
		}
		i++;
	}

	return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectBaseBranch(cwd: string): string {
	try {
		const result = rtkExec("git rev-parse --verify main 2>/dev/null && echo main || echo master", {
			cwd,
			encoding: "utf8",
		});
		return result.trim();
	} catch {
		return "main";
	}
}

function generateSessionId(): string {
	return `ralph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ---------------------------------------------------------------------------
// Subcommand handlers
// ---------------------------------------------------------------------------

async function handleStatus(ctx: ExtensionCommandContext, state: RalphState | null): Promise<void> {
	if (!state?.active) {
		ctx.ui.notify("No active Ralph Loop. Start one with /ck:ralph", "info");
		return;
	}

	const latest = state.findingsHistory[state.findingsHistory.length - 1];
	const lines = [
		`Ralph Loop active — round ${state.iteration}/${state.maxIterations}`,
		`Phase: ${state.phase.toUpperCase()}`,
		`Base: ${state.baseBranch}`,
		`Kit: ${state.kitDomain ?? "(all)"}`,
		`Findings: ${latest ? formatSummaryLine(latest) : "—"}`,
		`Convergence: ${convergenceLabel(state)}`,
		`Started: ${state.startedAt}`,
	];

	ctx.ui.notify(lines.join("\n"), "info");
}

async function handleCancel(pi: ExtensionAPI, ctx: ExtensionCommandContext, state: RalphState | null): Promise<void> {
	if (!state?.active) {
		ctx.ui.notify("No active Ralph Loop to cancel.", "info");
		return;
	}

	state.active = false;
	persistState(pi, state);

	ctx.ui.setWidget("ralph-forge", undefined);
	ctx.ui.setStatus("ralph", undefined);

	const latest = state.findingsHistory[state.findingsHistory.length - 1];
	const lines = [
		"Ralph Loop cancelled.",
		`Completed ${state.iteration} round(s).`,
		`Final findings: ${latest ? formatSummaryLine(latest) : "none"}`,
		"Review context/impl/ralph-findings.md for details.",
	];

	ctx.ui.notify(lines.join("\n"), "info");
}

async function handleHistory(ctx: ExtensionCommandContext, state: RalphState | null): Promise<void> {
	if (!state || state.findingsHistory.length === 0) {
		ctx.ui.notify("No findings history. Run a Ralph Loop first.", "info");
		return;
	}

	const lines = ["Ralph findings trend:", ""];
	for (const summary of state.findingsHistory) {
		const bar = "|".repeat(Math.min(summary.total, 20));
		lines.push(`  Round ${summary.iteration}: ${formatSummaryLine(summary)} ${bar}`);
	}

	lines.push("", `Convergence: ${convergenceLabel(state)}`);
	ctx.ui.notify(lines.join("\n"), "info");
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerRalphCommand(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.registerCommand("ck:ralph", {
		description: "Start or control a Ralph Loop — adversarial peer review via Codex",
		getArgumentCompletions: async () => [
			{ value: "status", label: "Show current ralph loop state" },
			{ value: "cancel", label: "Cancel active ralph loop" },
			{ value: "history", label: "Show findings trend" },
		],
		handler: async (rawArgs, ctx) => {
			const args = parseArgs(rawArgs);

			// Route subcommands
			const state = restoreState(ctx);

			if (args.subcommand === "status") {
				await handleStatus(ctx, state);
				return;
			}
			if (args.subcommand === "cancel") {
				await handleCancel(pi, ctx, state);
				return;
			}
			if (args.subcommand === "history") {
				await handleHistory(ctx, state);
				return;
			}

			// --- Start a new Ralph Loop ---

			// Guard: already active
			if (state?.active) {
				ctx.ui.notify(
					`Ralph Loop already active (round ${state.iteration}/${state.maxIterations}). Use /ck:ralph cancel first.`,
					"warning",
				);
				return;
			}

			// Preflight: Codex availability
			const codexReady = await isCodexAvailable();
			if (!codexReady) {
				ctx.ui.notify(
					"Codex CLI not found.\n\nInstall: npm i -g @openai/codex\nSet: export OPENAI_API_KEY=<key>\n\nRalph needs Codex for adversarial review.",
					"error",
				);
				return;
			}

			// Preflight: OPENAI_API_KEY
			if (!process.env.OPENAI_API_KEY) {
				ctx.ui.notify(
					"OPENAI_API_KEY not set. Codex needs it for adversarial review.\n\nSet: export OPENAI_API_KEY=<key>",
					"warning",
				);
				// Continue — Codex may have its own auth
			}

			// Preflight: kits exist
			const cwd = ctx.cwd;
			const kitsDir = path.join(cwd, "context", "kits");
			if (!fs.existsSync(kitsDir) || fs.readdirSync(kitsDir).filter((f) => f.endsWith(".md")).length === 0) {
				ctx.ui.notify("No kits found in context/kits/. Run /ck:draft first.", "warning");
				return;
			}

			// Resolve config
			const baseBranch = args.base ?? detectBaseBranch(cwd);
			const sessionId = generateSessionId();

			// Initialize state
			const newState = createInitialState({
				sessionId,
				baseBranch,
				maxIterations: args.rounds,
				kitDomain: args.domain ?? undefined,
			});

			persistState(pi, newState);

			// Show forge widget
			const widgetLines = [
				"\u250C\u2500 RALPH \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
				`${`\u2502 Rival:  codex`.padEnd(27)}\u2502`,
				`${`\u2502 Kit:    ${args.domain ?? "(all)"}`.padEnd(27).slice(0, 27)}\u2502`,
				`${`\u2502 Rounds: 0/${args.rounds}`.padEnd(27)}\u2502`,
				`${`\u2502 Base:   ${baseBranch}`.padEnd(27).slice(0, 27)}\u2502`,
				"\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518",
			];

			ctx.ui.setWidget("ralph-forge", widgetLines);
			ctx.ui.setStatus("ralph", `Ralph 0/${args.rounds}`);
			ctx.ui.notify("Ralph Loop started. Forging begins.", "info");

			// Inject the build prompt
			const domainClause = args.domain ? ` Scope: kit domain "${args.domain}".` : "";
			pi.sendUserMessage(
				`You are in a Ralph Loop with adversarial peer review.${domainClause}

Phase: BUILD

Instructions:
1. Read the build site at context/plans/ to find unblocked tasks
2. Pick the next unblocked task and implement it
3. After implementation, call the ralph_review tool to get adversarial feedback from Codex
4. Fix any P0 (critical) or P1 (high) findings before moving to the next task
5. Repeat until all tasks are complete and a clean review pass is achieved

Base branch for review: ${baseBranch}
Max rounds: ${args.rounds}

Start by reading the build site and picking the first unblocked task.`,
			);
		},
	});
}
