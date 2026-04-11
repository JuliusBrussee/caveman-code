/**
 * Codex CLI delegation for Ralph adversarial review.
 *
 * Spawns the Codex CLI in full-auto approval mode with a structured
 * adversarial review prompt. Parses the output into RalphFinding[].
 *
 * Primary path: direct CLI invocation (fast, no server overhead).
 * Falls back with helpful error when Codex is unavailable.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseKitDirectory } from "../parsers/kit-parser.js";
import type { AcceptanceCriterion, Kit, Requirement } from "../types.js";
import { parseFindings, type RalphFinding } from "./findings.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodexReviewOptions {
	baseBranch: string;
	cwd: string;
	kitDomain?: string | null;
	focus?: string;
	signal?: AbortSignal;
}

export interface CodexReviewResult {
	findings: RalphFinding[];
	raw: string;
	exitCode: number;
	error: string | null;
}

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

export async function isCodexAvailable(): Promise<boolean> {
	return new Promise((resolve) => {
		const proc = spawn("which", ["codex"], { stdio: "ignore" });
		proc.on("close", (code) => resolve(code === 0));
		proc.on("error", () => resolve(false));
	});
}

// ---------------------------------------------------------------------------
// Review prompt
// ---------------------------------------------------------------------------

function buildReviewPrompt(options: { baseBranch: string; kits: Kit[]; focus?: string }): string {
	const acList = options.kits
		.flatMap((kit) =>
			kit.requirements.flatMap((req: Requirement) =>
				req.acceptanceCriteria.map(
					(ac: AcceptanceCriterion) => `- ${kit.domain}/${req.id} ${ac.id}: ${ac.description}`,
				),
			),
		)
		.join("\n");

	const focusClause = options.focus ? `\nFocus your review on: ${options.focus}\n` : "";

	return `You are Ralph — an adversarial code reviewer. Your job is to find what the builder missed.

Review the git diff from ${options.baseBranch} to HEAD. Evaluate the changes against these acceptance criteria:

${acList}
${focusClause}
Rules:
1. Be thorough but fair — flag real issues, not style preferences
2. Assign severity accurately: P0 (critical/breaking), P1 (high/correctness), P2 (medium/quality), P3 (low/nit)
3. Every finding must reference a specific file and ideally a line number
4. Provide actionable suggestions, not vague complaints

Output your findings as a markdown table with exactly these columns:

| Severity | File | Line | Finding | Suggestion |
|----------|------|------|---------|------------|

If the code is clean and meets all acceptance criteria, output:
"No findings — clean pass."

End with a one-line summary: "Summary: N findings (XC YH ZM WL)"`;
}

// ---------------------------------------------------------------------------
// Invocation
// ---------------------------------------------------------------------------

export async function invokeCodexReview(options: CodexReviewOptions): Promise<CodexReviewResult> {
	const available = await isCodexAvailable();
	if (!available) {
		return {
			findings: [],
			raw: "",
			exitCode: -1,
			error:
				"Codex CLI not found. Install it: npm i -g @openai/codex\n" +
				"Ensure OPENAI_API_KEY is set in your environment.",
		};
	}

	// Load kits
	const kitsDir = path.join(options.cwd, "context", "kits");
	let kits: Kit[] = [];
	if (fs.existsSync(kitsDir)) {
		const result = parseKitDirectory(kitsDir);
		kits = options.kitDomain
			? result.kits.filter((k) => k.domain.toLowerCase().includes(options.kitDomain!.toLowerCase()))
			: result.kits;
	}

	const prompt = buildReviewPrompt({
		baseBranch: options.baseBranch,
		kits,
		focus: options.focus,
	});

	return runCodex(prompt, options);
}

async function runCodex(prompt: string, options: CodexReviewOptions): Promise<CodexReviewResult> {
	return new Promise((resolve) => {
		const args = ["--approval-mode", "full-auto", "--quiet", prompt];

		const proc = spawn("codex", args, {
			cwd: options.cwd,
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env },
		});

		let stdout = "";
		let stderr = "";

		proc.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});

		proc.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		if (options.signal) {
			options.signal.addEventListener("abort", () => {
				proc.kill("SIGTERM");
			});
		}

		proc.on("close", (code) => {
			const exitCode = code ?? 1;
			const raw = stdout || stderr;
			const findings = parseFindings(raw);

			resolve({
				findings,
				raw,
				exitCode,
				error:
					exitCode !== 0 && findings.length === 0
						? `Codex exited with code ${exitCode}: ${stderr.slice(0, 500)}`
						: null,
			});
		});

		proc.on("error", (err) => {
			resolve({
				findings: [],
				raw: "",
				exitCode: -1,
				error: `Failed to spawn Codex: ${err.message}`,
			});
		});
	});
}
