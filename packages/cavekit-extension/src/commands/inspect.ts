/**
 * /ck:inspect — Gap analysis comparing built output against kit acceptance criteria.
 *
 * AC-1: Reads kits and current implementation.
 * AC-2: Compares against acceptance criteria.
 * AC-3: Produces gap analysis report.
 * AC-4: Callable as /ck:inspect.
 *
 * Optionally accepts a domain filter argument (e.g. /ck:inspect auth).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "cave";
import type { CaveKitConfig } from "../config/index.js";
import { parseKitDirectory } from "../parsers/kit-parser.js";
import type { AcceptanceCriterion, Kit, Requirement } from "../types.js";

// ---------------------------------------------------------------------------
// Gap analysis types
// ---------------------------------------------------------------------------

type AcStatus = "met" | "partial" | "missing";

interface AcGap {
	ac: AcceptanceCriterion;
	status: AcStatus;
	evidence: string | null;
}

interface RequirementGap {
	requirement: Requirement;
	acGaps: AcGap[];
	metCount: number;
	totalCount: number;
}

interface KitGap {
	kit: Kit;
	requirementGaps: RequirementGap[];
	metCount: number;
	totalCount: number;
}

interface GapAnalysis {
	kitGaps: KitGap[];
	totalMet: number;
	totalAC: number;
	coveragePct: number;
	domainFilter: string | null;
}

// ---------------------------------------------------------------------------
// Command registration (AC-4: callable as /ck:inspect)
// ---------------------------------------------------------------------------

export function registerInspectCommand(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.registerCommand("ck:inspect", {
		description: "Run gap analysis comparing built code against kit acceptance criteria",
		getArgumentCompletions: async (_prefix) => {
			// Offer domain names derived from the kits directory
			const kitsDir = path.join(process.cwd(), "context", "kits");
			if (!fs.existsSync(kitsDir)) return null;
			const { kits } = parseKitDirectory(kitsDir);
			const domains = kits.map((k) => ({ value: k.domain, label: k.domain }));
			return domains.length > 0 ? domains : null;
		},
		handler: async (args, ctx) => {
			const cwd = ctx.cwd;
			const domainFilter = args.trim() || null;

			// --- AC-1: Read kits ---
			const kitsDir = path.join(cwd, "context", "kits");
			if (!fs.existsSync(kitsDir)) {
				ctx.ui.notify("No kits found in context/kits/. Run /ck:draft first.", "warning");
				return;
			}

			const { kits, errors: kitErrors } = parseKitDirectory(kitsDir);
			if (kits.length === 0) {
				ctx.ui.notify(
					`No kits could be parsed from context/kits/.${kitErrors.length > 0 ? ` Errors: ${kitErrors.map((e) => e.message).join(", ")}` : ""}`,
					"warning",
				);
				return;
			}

			ctx.ui.notify(`Inspecting ${kits.length} kit(s)${domainFilter ? ` (domain: ${domainFilter})` : ""}…`, "info");

			// --- AC-1: Read implementation records ---
			const implDir = path.join(cwd, "context", "impl");
			const implContent = loadImplContent(implDir);

			// --- AC-2: Compare against acceptance criteria ---
			const analysis = runGapAnalysis(kits, implContent, domainFilter);

			// --- AC-3: Produce and write gap analysis report ---
			const report = buildGapReport(analysis);
			const reportPath = writeGapReport(cwd, report);

			// --- Summarise in UI ---
			const { totalMet, totalAC, coveragePct } = analysis;
			const notifyLevel = coveragePct >= 80 ? "info" : coveragePct >= 50 ? "warning" : "error";
			ctx.ui.notify(
				`Inspect complete: ${totalMet}/${totalAC} AC met (${coveragePct}%). Report saved to ${path.relative(cwd, reportPath)}. Preview: /ck:preview gap`,
				notifyLevel,
			);

			// --- Send detailed analysis as a user message for LLM follow-up ---
			const prompt = buildInspectPrompt(cwd, kits, analysis, domainFilter);
			pi.sendUserMessage([{ type: "text", text: prompt }]);
		},
	});
}

// ---------------------------------------------------------------------------
// Gap analysis engine (AC-2)
// ---------------------------------------------------------------------------

function loadImplContent(implDir: string): string {
	if (!fs.existsSync(implDir)) return "";

	const chunks: string[] = [];

	// Load loop-log for high-level pass-rate context
	const logPath = path.join(implDir, "loop-log.md");
	if (fs.existsSync(logPath)) {
		try {
			chunks.push(`## Loop Log\n${fs.readFileSync(logPath, "utf8")}`);
		} catch {
			// skip
		}
	}

	// Load per-task impl records
	const files = fs.readdirSync(implDir).filter((f) => f.startsWith("T-") && f.endsWith(".md"));
	for (const file of files) {
		try {
			chunks.push(`## ${file}\n${fs.readFileSync(path.join(implDir, file), "utf8")}`);
		} catch {
			// skip
		}
	}

	return chunks.join("\n\n");
}

function runGapAnalysis(kits: Kit[], implContent: string, domainFilter: string | null): GapAnalysis {
	const implLower = implContent.toLowerCase();

	const filteredKits = domainFilter
		? kits.filter((k) => k.domain.toLowerCase().includes(domainFilter.toLowerCase()))
		: kits;

	const kitGaps: KitGap[] = filteredKits.map((kit) => {
		const requirementGaps: RequirementGap[] = kit.requirements.map((req) => {
			const acGaps: AcGap[] = req.acceptanceCriteria.map((ac) => {
				const { status, evidence } = scoreAC(req, ac, implLower);
				return { ac, status, evidence };
			});

			const metCount = acGaps.filter((g) => g.status === "met").length;
			return { requirement: req, acGaps, metCount, totalCount: acGaps.length };
		});

		const metCount = requirementGaps.reduce((n, rg) => n + rg.metCount, 0);
		const totalCount = requirementGaps.reduce((n, rg) => n + rg.totalCount, 0);

		return { kit, requirementGaps, metCount, totalCount };
	});

	const totalMet = kitGaps.reduce((n, kg) => n + kg.metCount, 0);
	const totalAC = kitGaps.reduce((n, kg) => n + kg.totalCount, 0);
	const coveragePct = totalAC > 0 ? Math.round((totalMet / totalAC) * 100) : 0;

	return { kitGaps, totalMet, totalAC, coveragePct, domainFilter };
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
	"must",
	"will",
	"should",
	"shall",
]);

function extractKeywords(text: string): string[] {
	return text
		.toLowerCase()
		.split(/\W+/)
		.filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

function scoreAC(
	req: Requirement,
	ac: AcceptanceCriterion,
	implLower: string,
): { status: AcStatus; evidence: string | null } {
	if (!implLower) return { status: "missing", evidence: null };

	const reqIdLower = req.id.toLowerCase();
	const acIdLower = ac.id.toLowerCase();

	// Strong signal: both the req ID and AC ID appear in the impl content
	const hasReqId = implLower.includes(reqIdLower);
	const hasAcId = implLower.includes(acIdLower);

	if (hasReqId && hasAcId) {
		return { status: "met", evidence: `Found references to ${req.id} and ${ac.id} in implementation records.` };
	}

	// Keyword matching: count how many meaningful words from the AC description appear
	const keywords = extractKeywords(ac.description);
	if (keywords.length === 0) {
		return { status: hasReqId ? "partial" : "missing", evidence: hasReqId ? `Found ${req.id} reference.` : null };
	}

	const matchedKws = keywords.filter((kw) => implLower.includes(kw));
	const matchRatio = matchedKws.length / keywords.length;

	if (matchRatio >= 0.6) {
		return {
			status: "met",
			evidence: `Keyword coverage ${matchedKws.length}/${keywords.length}: ${matchedKws.slice(0, 5).join(", ")}`,
		};
	}
	if (matchRatio >= 0.3) {
		return {
			status: "partial",
			evidence: `Partial keyword coverage ${matchedKws.length}/${keywords.length}: ${matchedKws.slice(0, 3).join(", ")}`,
		};
	}

	return { status: "missing", evidence: null };
}

// ---------------------------------------------------------------------------
// Report generation (AC-3)
// ---------------------------------------------------------------------------

function buildGapReport(analysis: GapAnalysis): string {
	const { kitGaps, totalMet, totalAC, coveragePct, domainFilter } = analysis;
	const date = new Date().toISOString();

	const lines: string[] = [
		"# Gap Analysis",
		`**Date:** ${date}`,
		domainFilter ? `**Domain Filter:** ${domainFilter}` : "",
		`**Coverage:** ${totalMet}/${totalAC} requirements fully met (${coveragePct}%)`,
		"",
	].filter((l) => l !== "");

	// Per-kit sections
	for (const kitGap of kitGaps) {
		const kitPct = kitGap.totalCount > 0 ? Math.round((kitGap.metCount / kitGap.totalCount) * 100) : 0;
		lines.push(`## ${kitGap.kit.domain} — ${kitGap.metCount}/${kitGap.totalCount} AC (${kitPct}%)`);
		lines.push("");

		for (const rg of kitGap.requirementGaps) {
			const reqPct = rg.totalCount > 0 ? Math.round((rg.metCount / rg.totalCount) * 100) : 0;
			const reqIcon = rg.metCount === rg.totalCount ? "✓" : rg.metCount === 0 ? "✗" : "⚠";
			lines.push(`### ${reqIcon} ${rg.requirement.id}: ${rg.requirement.name} (${reqPct}%)`);
			lines.push("");

			for (const gap of rg.acGaps) {
				const icon = gap.status === "met" ? "✓" : gap.status === "partial" ? "⚠" : "✗";
				const evidenceSuffix = gap.evidence ? ` — _${gap.evidence}_` : "";
				lines.push(`- ${icon} **${gap.ac.id}:** ${gap.ac.description}${evidenceSuffix}`);
			}
			lines.push("");
		}
	}

	// Gaps section
	const allGaps = kitGaps.flatMap((kg) =>
		kg.requirementGaps.flatMap((rg) =>
			rg.acGaps
				.filter((g) => g.status !== "met")
				.map((g) => ({ domain: kg.kit.domain, req: rg.requirement, gap: g })),
		),
	);

	if (allGaps.length > 0) {
		lines.push("## Gaps Found");
		lines.push("");
		for (const { domain, req, gap } of allGaps) {
			const label = gap.status === "partial" ? "⚠ PARTIAL" : "✗ MISSING";
			lines.push(`### ${domain}/${req.id} ${gap.ac.id} — ${label}`);
			lines.push(`- **Criterion:** ${gap.ac.description}`);
			lines.push(`- **Evidence:** ${gap.evidence ?? "None found in implementation records."}`);
			lines.push(`- **Remediation:** Implement ${req.id} ${gap.ac.id}: ${gap.ac.description}`);
			lines.push("");
		}

		lines.push("## Remediation Tasks");
		lines.push("");
		allGaps.forEach(({ domain, req, gap }, i) => {
			lines.push(`${i + 1}. [${gap.status.toUpperCase()}] ${domain}/${req.id} ${gap.ac.id}: ${gap.ac.description}`);
		});
	} else {
		lines.push("## Gaps Found");
		lines.push("_No gaps found — all acceptance criteria appear to be met._");
	}

	return lines.join("\n");
}

function writeGapReport(cwd: string, report: string): string {
	const reportsDir = path.join(cwd, "context", "reports");
	fs.mkdirSync(reportsDir, { recursive: true });

	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const filename = `gap-analysis-${timestamp}.md`;
	const reportPath = path.join(reportsDir, filename);
	fs.writeFileSync(reportPath, report, "utf8");
	return reportPath;
}

// ---------------------------------------------------------------------------
// LLM prompt (for rich follow-up analysis via sendUserMessage)
// ---------------------------------------------------------------------------

function buildInspectPrompt(cwd: string, kits: Kit[], analysis: GapAnalysis, domainFilter: string | null): string {
	const kitsDir = path.join(cwd, "context", "kits");
	const implDir = path.join(cwd, "context", "impl");
	const { totalMet, totalAC, coveragePct } = analysis;

	const kitFiles = kits.map((k) => `- ${k.domain}.md`).join("\n") || "  (none)";

	const implFiles = fs.existsSync(implDir) ? fs.readdirSync(implDir).filter((f) => f.endsWith(".md")) : [];

	const gapSummary =
		analysis.kitGaps
			.flatMap((kg) =>
				kg.requirementGaps.flatMap((rg) =>
					rg.acGaps
						.filter((g) => g.status !== "met")
						.map(
							(g) =>
								`- [${g.status.toUpperCase()}] ${kg.kit.domain}/${rg.requirement.id} ${g.ac.id}: ${g.ac.description}`,
						),
				),
			)
			.join("\n") || "  (none — all criteria appear met)";

	return `You are executing the CaveKit INSPECT phase — gap analysis.

## Pre-computed Coverage
**Coverage:** ${totalMet}/${totalAC} AC met (${coveragePct}%)${domainFilter ? `\n**Domain Filter:** ${domainFilter}` : ""}

## Pre-identified Gaps
${gapSummary}

## Available Context
**Kits (${kits.length}):** ${kitsDir}/
${kitFiles}

**Impl Records (${implFiles.length}):** ${implDir}/
${implFiles.map((f) => `- ${f}`).join("\n") || "  (none)"}

## Instructions
1. Read all kit files listed above to get the full requirement text
2. Read impl records and/or inspect actual source code to verify coverage
3. For each gap identified above, confirm: ✗ missing | ⚠ partial | ✓ actually met
4. Identify any additional gaps the pre-analysis may have missed
5. For each missing/partial item, describe specifically what's absent
6. Generate remediation tasks for any gaps found
7. Update the gap report at context/reports/ with your findings

Focus on accuracy — the pre-analysis is heuristic-based and may have false positives or missed gaps.`;
}
