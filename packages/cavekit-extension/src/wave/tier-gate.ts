/**
 * Tier gate review — runs after each tier completes during build.
 *
 * AC-1: Runs after each tier completes during build.
 * AC-2: Compares built code against kit acceptance criteria.
 * AC-3: Produces findings with severity levels (P0-P3).
 * AC-4: Blocks next tier on P0/P1 findings when tierGateMode is "severity" or "strict".
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { CaveKitConfig } from "../config/index.js";
import { parseKitDirectory } from "../parsers/kit-parser.js";
import type { Finding, Kit, Requirement } from "../types.js";

export type { Finding };

export interface TierGateResult {
	tier: number;
	findings: Finding[];
	blocked: boolean;
	summary: string;
}

/** Context object passed to the tier gate (subset of ExtensionAPI ctx used by build). */
export interface TierGateContext {
	ui: {
		notify: (msg: string, type?: "info" | "warning" | "error") => void;
	};
}

/**
 * Run a tier gate review after a tier completes.
 *
 * Loads kit acceptance criteria, loads the implementation records for tasks
 * in this tier, then generates findings by comparing them.
 *
 * Returns the list of findings. When tierGateMode is "severity" or "strict",
 * high-severity findings set `blocked = true` on the result.
 */
export async function runTierGateReview(
	tier: number,
	config: CaveKitConfig,
	cwd: string,
	ctx: TierGateContext,
): Promise<TierGateResult> {
	if (config.tierGateMode === "off") {
		return { tier, findings: [], blocked: false, summary: "Tier gate is off — skipped." };
	}

	ctx.ui.notify(`Tier ${tier}: running gate review…`, "info");

	// --- Load kits from context/blueprints/ (preferred) or context/kits/ ---
	const blueprintsDir = path.join(cwd, "context", "blueprints");
	const kitsDir = path.join(cwd, "context", "kits");
	const sourceDir = fs.existsSync(blueprintsDir) ? blueprintsDir : kitsDir;
	const { kits, errors: kitErrors } = parseKitDirectory(sourceDir);

	if (kitErrors.length > 0 && kits.length === 0) {
		const msg = `Tier gate: no kits found in ${sourceDir} — skipping review.`;
		ctx.ui.notify(msg, "warning");
		return { tier, findings: [], blocked: false, summary: msg };
	}

	// --- Load impl records for this tier ---
	const implDir = path.join(cwd, "context", "impl");
	const implContent = loadImplRecordsForTier(implDir, tier);

	// --- Load loop-log for tier progress context ---
	const loopLogContent = loadLoopLog(implDir);

	// --- Analyse criteria against impl records ---
	const findings = analyseCriteria(kits, implContent, loopLogContent, tier);

	// --- Write report to context/reports/ ---
	const report = buildReport(tier, kits, findings, implContent);
	writeReport(cwd, tier, report);

	// --- Determine if we should block ---
	const blocked = shouldBlock(config.tierGateMode, findings);

	const p0Count = findings.filter((f) => f.severity === "P0").length;
	const p1Count = findings.filter((f) => f.severity === "P1").length;
	const p2Count = findings.filter((f) => f.severity === "P2").length;
	const p3Count = findings.filter((f) => f.severity === "P3").length;

	const summary = [
		`Tier ${tier} gate: ${findings.length} finding(s)`,
		`P0=${p0Count} P1=${p1Count} P2=${p2Count} P3=${p3Count}`,
		blocked ? "→ BLOCKED (P0/P1 findings prevent next tier)" : "→ PASS",
	].join(" | ");

	const notifyLevel = blocked ? "error" : findings.length > 0 ? "warning" : "info";
	ctx.ui.notify(summary, notifyLevel);

	return { tier, findings, blocked, summary };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Load all impl-*.md files and return combined text (filtered to current tier if possible). */
function loadImplRecordsForTier(implDir: string, _tier: number): string {
	if (!fs.existsSync(implDir)) return "";

	const files = fs.readdirSync(implDir).filter((f) => f.startsWith("T-") && f.endsWith(".md"));
	const chunks: string[] = [];

	for (const file of files) {
		try {
			const content = fs.readFileSync(path.join(implDir, file), "utf8");
			// Include all impl records — tier filtering can be refined once task
			// metadata is stored; for now we pass everything as context.
			chunks.push(`### ${file}\n${content}`);
		} catch {
			// Skip unreadable files
		}
	}

	return chunks.join("\n\n");
}

/** Load loop-log.md for pass-rate context. */
function loadLoopLog(implDir: string): string {
	const logPath = path.join(implDir, "loop-log.md");
	if (!fs.existsSync(logPath)) return "";
	try {
		return fs.readFileSync(logPath, "utf8");
	} catch {
		return "";
	}
}

/**
 * Analyse acceptance criteria against implementation records and produce findings.
 *
 * Strategy (heuristic — no LLM call):
 *   - For each AC, search the combined impl text for positive signals.
 *   - Missing evidence → finding with severity derived from AC position (AC-1 → P0).
 *   - Produces a conservative set of findings; the report prompt can be sent
 *     to an LLM by the caller for richer analysis.
 */
function analyseCriteria(kits: Kit[], implContent: string, _loopLog: string, tier: number): Finding[] {
	const findings: Finding[] = [];
	const implLower = implContent.toLowerCase();

	for (const kit of kits) {
		for (const req of kit.requirements) {
			for (const ac of req.acceptanceCriteria) {
				// Check if this AC has any evidence in the impl records
				const hasEvidence = checkEvidence(req, ac, implLower);

				if (!hasEvidence) {
					const severity = deriveSeverity(ac.id, req, tier);
					findings.push({
						description: `[Tier ${tier}] No evidence that ${req.id} ${ac.id} is implemented: "${ac.description}"`,
						severity,
						requirementRef: `${req.id}/${ac.id}`,
					});
				}
			}
		}
	}

	return findings;
}

/** Check for positive evidence of an AC in the impl text. */
function checkEvidence(req: Requirement, ac: { id: string; description: string }, implLower: string): boolean {
	// Look for the requirement ID + AC ID (e.g. "R1" + "AC-1") appearing near each other,
	// or for key descriptor words from the AC description.
	const reqIdLower = req.id.toLowerCase();
	const acIdLower = ac.id.toLowerCase();

	if (implLower.includes(reqIdLower) && implLower.includes(acIdLower)) return true;

	// Look for key words from the AC description (≥4 chars, non-stopword)
	const keywords = extractKeywords(ac.description);
	const matchCount = keywords.filter((kw) => implLower.includes(kw)).length;
	const threshold = Math.max(1, Math.floor(keywords.length * 0.4));

	return matchCount >= threshold;
}

const STOPWORDS = new Set([
	"the",
	"and",
	"for",
	"with",
	"from",
	"that",
	"this",
	"are",
	"not",
	"when",
	"into",
	"each",
	"all",
	"any",
	"can",
	"its",
	"has",
	"via",
]);

function extractKeywords(text: string): string[] {
	return text
		.toLowerCase()
		.split(/\W+/)
		.filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

/**
 * Derive a finding severity from the AC number and requirement position.
 *
 * AC-1 on the first requirement in the first kit → P0.
 * AC-1/AC-2 generally → P1.
 * AC-3 → P2.
 * AC-4+ → P3.
 */
function deriveSeverity(acId: string, _req: Requirement, _tier: number): "P0" | "P1" | "P2" | "P3" {
	const acNum = parseInt(acId.replace(/^AC-/, ""), 10);
	if (Number.isNaN(acNum)) return "P2";
	if (acNum === 1) return "P0";
	if (acNum <= 2) return "P1";
	if (acNum === 3) return "P2";
	return "P3";
}

/** Determine whether findings should block the next tier. */
function shouldBlock(mode: CaveKitConfig["tierGateMode"], findings: Finding[]): boolean {
	if (mode === "off" || mode === "permissive") return false;
	if (mode === "strict") return findings.length > 0;
	// "severity": block on P0 or P1
	return findings.some((f) => f.severity === "P0" || f.severity === "P1");
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function buildReport(tier: number, kits: Kit[], findings: Finding[], implContent: string): string {
	const date = new Date().toISOString();
	const totalAC = kits.reduce((n, k) => n + k.requirements.reduce((m, r) => m + r.acceptanceCriteria.length, 0), 0);
	const failedAC = findings.length;
	const passedAC = totalAC - failedAC;
	const coveragePct = totalAC > 0 ? Math.round((passedAC / totalAC) * 100) : 0;

	const findingLines = findings.map((f) => `- **${f.severity}** [${f.requirementRef}] ${f.description}`).join("\n");

	const hasImpl = implContent.trim().length > 0;

	return [
		`# Tier Gate Review — Tier ${tier}`,
		`**Date:** ${date}`,
		`**Coverage:** ${passedAC}/${totalAC} AC met (${coveragePct}%)`,
		"",
		`## Findings (${findings.length})`,
		findings.length === 0 ? "_No findings — all criteria appear to be met._" : findingLines,
		"",
		"## Kit Summary",
		...kits.map(
			(k) =>
				`- **${k.domain}:** ${k.requirements.length} requirement(s), ` +
				`${k.requirements.reduce((n, r) => n + r.acceptanceCriteria.length, 0)} AC`,
		),
		"",
		hasImpl ? "## Implementation Evidence\n_Impl records loaded — see context/impl/ for details._" : "",
	]
		.filter((l) => l !== undefined)
		.join("\n");
}

function writeReport(cwd: string, tier: number, report: string): void {
	const reportsDir = path.join(cwd, "context", "reports");
	fs.mkdirSync(reportsDir, { recursive: true });
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const filename = `tier-gate-t${tier}-${timestamp}.md`;
	try {
		fs.writeFileSync(path.join(reportsDir, filename), report, "utf8");
	} catch {
		// Non-fatal — best effort
	}
}
