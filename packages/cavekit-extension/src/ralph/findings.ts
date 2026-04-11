/**
 * Ralph findings parser, formatter, and file writer.
 *
 * Parses Codex review output into structured findings aligned with the
 * existing CaveKit Finding/FindingSeverity types. Writes iteration
 * history to context/impl/ralph-findings.md.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { FindingSeverity } from "../types.js";
import type { FindingsSummary } from "./state.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RalphFinding {
	severity: FindingSeverity;
	file: string;
	line: number | null;
	finding: string;
	suggestion: string;
}

// ---------------------------------------------------------------------------
// Severity mapping
// ---------------------------------------------------------------------------

const SEVERITY_ALIASES: Record<string, FindingSeverity> = {
	critical: "P0",
	p0: "P0",
	high: "P1",
	p1: "P1",
	medium: "P2",
	p2: "P2",
	low: "P3",
	p3: "P3",
};

function parseSeverity(raw: string): FindingSeverity {
	const normalized = raw.trim().toLowerCase();
	return SEVERITY_ALIASES[normalized] ?? "P2";
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse findings from Codex review output.
 *
 * Expects a markdown table with columns: Severity | File | Line | Finding | Suggestion.
 * Falls back to line-by-line heuristic parsing if no table is found.
 */
export function parseFindings(raw: string): RalphFinding[] {
	const findings: RalphFinding[] = [];

	// Try table-format first
	const tableFindings = parseTableFindings(raw);
	if (tableFindings.length > 0) return tableFindings;

	// Fallback: look for structured lines like "P0: file.ts:42 — description"
	const lines = raw.split("\n");
	for (const line of lines) {
		const match = line.match(
			/^\s*\*?\*?\s*(P[0-3]|critical|high|medium|low)\s*[:|-]\s*`?([^`:]+?)`?\s*(?::(\d+))?\s*[-—]\s*(.+)/i,
		);
		if (match) {
			findings.push({
				severity: parseSeverity(match[1]),
				file: match[2].trim(),
				line: match[3] ? Number.parseInt(match[3], 10) : null,
				finding: match[4].trim(),
				suggestion: "",
			});
		}
	}

	return findings;
}

function parseTableFindings(raw: string): RalphFinding[] {
	const findings: RalphFinding[] = [];
	const lines = raw.split("\n");

	let inTable = false;
	let headerSeen = false;

	for (const line of lines) {
		const trimmed = line.trim();

		// Detect header row containing Severity
		if (!inTable && /severity/i.test(trimmed) && trimmed.includes("|")) {
			inTable = true;
			headerSeen = false;
			continue;
		}

		// Skip separator row (---|---|---)
		if (inTable && !headerSeen && /^[|\s-:]+$/.test(trimmed)) {
			headerSeen = true;
			continue;
		}

		// Parse data rows
		if (inTable && headerSeen) {
			if (!trimmed || !trimmed.includes("|")) {
				inTable = false;
				continue;
			}

			const cells = trimmed
				.split("|")
				.map((c) => c.trim())
				.filter((c) => c.length > 0);

			if (cells.length >= 4) {
				findings.push({
					severity: parseSeverity(cells[0]),
					file: cells[1].replace(/`/g, ""),
					line: cells[2] && /^\d+$/.test(cells[2]) ? Number.parseInt(cells[2], 10) : null,
					finding: cells[3],
					suggestion: cells[4] ?? "",
				});
			}
		}
	}

	return findings;
}

// ---------------------------------------------------------------------------
// Summarize
// ---------------------------------------------------------------------------

export function summarizeFindings(findings: RalphFinding[], iteration: number): FindingsSummary {
	return {
		iteration,
		critical: findings.filter((f) => f.severity === "P0").length,
		high: findings.filter((f) => f.severity === "P1").length,
		medium: findings.filter((f) => f.severity === "P2").length,
		low: findings.filter((f) => f.severity === "P3").length,
		total: findings.length,
		timestamp: new Date().toISOString(),
	};
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatFindings(findings: RalphFinding[]): string {
	if (findings.length === 0) return "No findings — clean pass.";

	const lines: string[] = [
		"| Severity | File | Line | Finding | Suggestion |",
		"|----------|------|------|---------|------------|",
	];

	for (const f of findings) {
		const loc = f.line != null ? String(f.line) : "-";
		lines.push(`| ${f.severity} | \`${f.file}\` | ${loc} | ${f.finding} | ${f.suggestion} |`);
	}

	return lines.join("\n");
}

export function formatSummaryLine(summary: FindingsSummary): string {
	return `${summary.critical}C ${summary.high}H ${summary.medium}M ${summary.low}L`;
}

// ---------------------------------------------------------------------------
// File writer
// ---------------------------------------------------------------------------

/**
 * Appends findings for this iteration to context/impl/ralph-findings.md.
 * Creates the file if it doesn't exist.
 */
export function writeFindingsToFile(
	cwd: string,
	iteration: number,
	findings: RalphFinding[],
	summary: FindingsSummary,
): string {
	const implDir = path.join(cwd, "context", "impl");
	fs.mkdirSync(implDir, { recursive: true });

	const filePath = path.join(implDir, "ralph-findings.md");

	const header = fs.existsSync(filePath)
		? ""
		: `# Ralph Review Findings\n\nAdversarial review history from Ralph Loop iterations.\n\n`;

	const section = [
		`## Iteration ${iteration} — ${summary.timestamp}`,
		`**Summary:** ${formatSummaryLine(summary)} (${summary.total} total)`,
		"",
		formatFindings(findings),
		"",
		"---",
		"",
	].join("\n");

	fs.appendFileSync(filePath, header + section, "utf8");
	return filePath;
}
