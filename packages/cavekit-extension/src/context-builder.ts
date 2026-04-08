/**
 * Scoped Context Builder (T-029 / extension-commands R14)
 *
 * Given a task ID and the active build site, extracts only the kit requirement
 * sections relevant to that task, producing a minimal context string suitable
 * for injection into a subagent prompt.
 *
 * Fallback: when scoping fails (missing build site, missing kits, parse errors),
 * returns the full content of all kit files concatenated.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { CaveKitConfig } from "./config/index.js";
import { parseBuildSite } from "./parsers/build-site-parser.js";
import { parseKit } from "./parsers/kit-parser.js";
import type { Kit, Requirement } from "./types.js";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a scoped context string for a given task.
 *
 * AC-1: Extracts only the kit requirement sections referenced by the task.
 * AC-2: Prepends DESIGN.md constraints when the file is present.
 * AC-3: Returns a single string ready for subagent prompt injection.
 * AC-4: Falls back to full kit content when scoping fails.
 */
export function buildScopedContext(taskId: string, cwd: string, config: CaveKitConfig): string {
	// When scoped context is disabled, immediately return full kit content.
	if (!config.scopedContext) {
		return buildFullKitContext(cwd);
	}

	try {
		return buildScoped(taskId, cwd);
	} catch {
		// AC-4: Fall back gracefully on any error
		return buildFullKitContext(cwd);
	}
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Attempt to build a scoped context for the given task.
 * Throws on any unrecoverable parsing / resolution failure so the caller
 * can catch and fall back to full-kit content.
 */
function buildScoped(taskId: string, cwd: string): string {
	// --- Locate and parse the build site ---
	const buildSitePath = findBuildSite(cwd);
	if (!buildSitePath) {
		throw new Error("No build site found");
	}

	const siteContent = fs.readFileSync(buildSitePath, "utf8");
	const siteResult = parseBuildSite(siteContent);

	if (!siteResult.site || siteResult.site.tasks.length === 0) {
		throw new Error("Build site could not be parsed or contains no tasks");
	}

	const task = siteResult.site.tasks.find((t) => t.id === taskId);
	if (!task) {
		throw new Error(`Task ${taskId} not found in build site`);
	}

	// --- Resolve kit refs from the task's acceptanceCriteriaIds ---
	// Each entry is a raw ref string like "extension-commands/R14" or "R14"
	const kitRefs = parseKitRefs(task.acceptanceCriteriaIds);

	if (kitRefs.length === 0) {
		// No scoped refs — fall back to full kit content
		throw new Error(`Task ${taskId} has no kit refs — cannot scope context`);
	}

	// --- Locate kit files ---
	const kitsDir = resolveKitsDir(cwd);
	if (!kitsDir) {
		throw new Error("No kits directory found");
	}

	const kitFiles = fs.readdirSync(kitsDir).filter((f) => f.endsWith(".md"));
	if (kitFiles.length === 0) {
		throw new Error("No kit files found");
	}

	// Parse all kits and index by domain name
	const kitsByDomain = new Map<string, Kit>();
	for (const file of kitFiles) {
		const content = fs.readFileSync(path.join(kitsDir, file), "utf8");
		const result = parseKit(content);
		if (result.kit) {
			kitsByDomain.set(result.kit.domain, result.kit);
		}
	}

	// --- Extract only the referenced requirements ---
	const sections: string[] = [];

	// Group refs by domain so we emit each domain's block once
	const refsByDomain = new Map<string, Set<string>>();
	for (const { domain, requirementId } of kitRefs) {
		if (!refsByDomain.has(domain)) {
			refsByDomain.set(domain, new Set());
		}
		refsByDomain.get(domain)!.add(requirementId);
	}

	for (const [domain, reqIds] of refsByDomain) {
		const kit = kitsByDomain.get(domain);
		if (!kit) {
			// Domain not found — include a note but don't abort
			sections.push(`<!-- Kit '${domain}' not found — skipped -->`);
			continue;
		}

		const matchedReqs: Requirement[] = [];
		for (const reqId of reqIds) {
			const req = kit.requirements.find((r) => r.id === reqId || r.id.toLowerCase() === reqId.toLowerCase());
			if (req) {
				matchedReqs.push(req);
			}
		}

		if (matchedReqs.length === 0) continue;

		sections.push(formatKitSection(domain, matchedReqs));
	}

	if (sections.length === 0) {
		throw new Error("No matching requirements found for task refs — cannot scope context");
	}

	// --- Prepend DESIGN.md when present (AC-2) ---
	const designSection = loadDesignConstraints(cwd);

	// --- Assemble final context string (AC-3) ---
	const parts: string[] = [];

	if (designSection) {
		parts.push(designSection);
	}

	parts.push(`## Scoped Context for ${taskId}: ${task.name}`);
	parts.push("The following requirements and acceptance criteria are the ONLY scope for this task.\n");
	parts.push(...sections);

	return parts.join("\n\n");
}

/**
 * Parse raw kit ref strings into typed { domain, requirementId } pairs.
 *
 * Accepted formats (as stored in BuildTask.acceptanceCriteriaIds):
 *   - "extension-commands/R14"  → domain=extension-commands, req=R14
 *   - "fork-identity/R1"        → domain=fork-identity,       req=R1
 *   - "R14"                     → domain=* (wildcard), req=R14
 */
function parseKitRefs(rawRefs: string[]): Array<{ domain: string; requirementId: string }> {
	const result: Array<{ domain: string; requirementId: string }> = [];

	for (const raw of rawRefs) {
		const trimmed = raw.trim();
		const slashIdx = trimmed.indexOf("/");

		if (slashIdx !== -1) {
			const domain = trimmed.slice(0, slashIdx).trim();
			const reqPart = trimmed.slice(slashIdx + 1).trim();
			// reqPart might be "R14 (AC-1, AC-2)" — strip AC annotations
			const reqId = reqPart.replace(/\s*\(.*\)/, "").trim();
			if (domain && reqId) {
				result.push({ domain, requirementId: reqId });
			}
		} else {
			// No domain — store with an empty-string domain (wildcard)
			const reqId = trimmed.replace(/\s*\(.*\)/, "").trim();
			if (reqId) {
				result.push({ domain: "", requirementId: reqId });
			}
		}
	}

	return result;
}

/** Format a set of requirements from one domain into a markdown block. */
function formatKitSection(domain: string, reqs: Requirement[]): string {
	const lines: string[] = [`### Kit: ${domain}`];

	for (const req of reqs) {
		lines.push(`\n#### ${req.id}: ${req.name}`);

		if (req.description) {
			lines.push(`\n${req.description}`);
		}

		if (req.acceptanceCriteria.length > 0) {
			lines.push("\n**Acceptance Criteria:**");
			for (const ac of req.acceptanceCriteria) {
				const check = ac.status === "pass" ? "x" : " ";
				lines.push(`- [${check}] ${ac.id}: ${ac.description}`);
			}
		}
	}

	return lines.join("\n");
}

/**
 * Load DESIGN.md constraints, if the file exists.
 * Returns null when DESIGN.md is absent.
 */
function loadDesignConstraints(cwd: string): string | null {
	const candidates = [
		path.join(cwd, "DESIGN.md"),
		path.join(cwd, "context", "designs", "DESIGN.md"),
		path.join(cwd, "context", "DESIGN.md"),
	];

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			const content = fs.readFileSync(candidate, "utf8").trim();
			if (content) {
				return `## Design Constraints (from DESIGN.md)\n\n${content}`;
			}
		}
	}

	return null;
}

/**
 * Locate the build site markdown file.
 * Checks context/plans/build-site.md (canonical path per T-030),
 * then falls back to context/sites/ for older layouts.
 */
function findBuildSite(cwd: string): string | null {
	const candidates = [
		path.join(cwd, "context", "plans", "build-site.md"),
		path.join(cwd, "context", "sites", "build-site.md"),
	];

	// Also scan context/sites/ for any .md file
	const sitesDir = path.join(cwd, "context", "sites");
	if (fs.existsSync(sitesDir)) {
		const files = fs.readdirSync(sitesDir).filter((f) => f.endsWith(".md"));
		for (const f of files) {
			candidates.push(path.join(sitesDir, f));
		}
	}

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}

	return null;
}

/**
 * Locate the kits directory.
 * Checks context/kits/ (canonical CaveKit path).
 */
function resolveKitsDir(cwd: string): string | null {
	const candidates = [path.join(cwd, "context", "kits")];

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}

	return null;
}

/**
 * Build a full-kit context string (fallback / disabled-scoping path).
 * Concatenates all kit files from context/kits/ into a single string,
 * preceded by any DESIGN.md constraints.
 */
function buildFullKitContext(cwd: string): string {
	const parts: string[] = [];

	const designSection = loadDesignConstraints(cwd);
	if (designSection) {
		parts.push(designSection);
	}

	const kitsDir = resolveKitsDir(cwd);
	if (kitsDir) {
		const kitFiles = fs.readdirSync(kitsDir).filter((f) => f.endsWith(".md"));
		for (const file of kitFiles) {
			const content = fs.readFileSync(path.join(kitsDir, file), "utf8").trim();
			if (content) {
				parts.push(`<!-- Kit file: ${file} -->\n${content}`);
			}
		}
	}

	return parts.join("\n\n---\n\n");
}
