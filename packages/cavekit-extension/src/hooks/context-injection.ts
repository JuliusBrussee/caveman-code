/**
 * before_agent_start hook — inject DESIGN.md constraints and kit context into subagents.
 *
 * AC-1: Injects DESIGN.md content when the file is present in the project root.
 * AC-2: When scopedContext is enabled, only kit sections referenced by the current
 *       in-progress task are injected (task-specific subagents).
 * AC-3: When scopedContext is disabled, the full kit content is injected.
 * AC-4: Returns immediately (no-op) when no SDD workflow is active (.cavekit/ absent).
 *
 * An SDD workflow is considered active when `.cavekit/` exists in cwd.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";
import { getBuildSiteDir } from "../paths.js";
import { parseBuildSite } from "../wave/executor.js";

/** Return true when a CaveKit SDD workflow is initialised in `cwd`. */
function isSddActive(cwd: string): boolean {
	return fs.existsSync(path.join(cwd, ".cavekit"));
}

/**
 * Collect kit refs for all currently in-progress tasks.
 * Used to scope context injection to only the relevant requirements.
 */
function getActiveKitRefs(cwd: string): Set<string> {
	const sitesDir = getBuildSiteDir(cwd);
	if (!fs.existsSync(sitesDir)) return new Set();

	const siteFiles = fs.readdirSync(sitesDir).filter((f) => f.endsWith(".md"));
	if (siteFiles.length === 0) return new Set();

	const siteFile = path.join(sitesDir, siteFiles[siteFiles.length - 1]);
	let content: string;
	try {
		content = fs.readFileSync(siteFile, "utf8");
	} catch {
		return new Set();
	}

	const tasks = parseBuildSite(content);
	const refs = new Set<string>();
	for (const task of tasks) {
		if (task.status === "in-progress" || task.status === "pending") {
			for (const ref of task.kitRefs) refs.add(ref);
		}
	}
	return refs;
}

/**
 * Load kit content from the kits directory.
 *
 * When `scopedRefs` is provided and non-empty, only kit files whose requirement
 * IDs appear in the set are included (scoped context).  When empty or absent,
 * all kit files are concatenated (full context).
 */
function buildKitContent(cwd: string, scopedRefs: Set<string> | null): string {
	const kitsDir = path.join(cwd, "context", "kits");
	if (!fs.existsSync(kitsDir)) return "";

	const kitFiles = fs.readdirSync(kitsDir).filter((f) => f.endsWith(".md"));
	if (kitFiles.length === 0) return "";

	const sections: string[] = [];
	for (const file of kitFiles) {
		const kitPath = path.join(kitsDir, file);
		let text: string;
		try {
			text = fs.readFileSync(kitPath, "utf8").trim();
		} catch {
			continue;
		}

		if (!scopedRefs || scopedRefs.size === 0) {
			// AC-3: full kit — include everything
			sections.push(text);
			continue;
		}

		// AC-2: scoped context — include only requirement blocks whose ID is referenced
		// Requirements start at "### R{N}:" headings
		const reqBlocks = text.split(/(?=^###\s+R\d+:)/m);
		const header = reqBlocks[0]; // preamble before first requirement
		const matchedBlocks: string[] = [];

		for (const block of reqBlocks.slice(1)) {
			// Extract requirement ID (e.g. "R5")
			const idMatch = block.match(/^###\s+(R\d+):/);
			if (!idMatch) continue;
			const reqId = idMatch[1];
			if (scopedRefs.has(reqId)) {
				matchedBlocks.push(block.trim());
			}
		}

		if (matchedBlocks.length > 0) {
			sections.push(`${header.trim()}\n\n${matchedBlocks.join("\n\n")}`);
		}
	}

	return sections.join("\n\n---\n\n");
}

export function registerContextInjectionHook(pi: ExtensionAPI, config: CaveKitConfig): void {
	pi.on("before_agent_start", (event, ctx) => {
		const cwd = ctx.cwd;

		// AC-4: no-op when no SDD workflow is active
		if (!isSddActive(cwd)) return;

		const injections: string[] = [];

		// AC-1: Inject DESIGN.md if present
		const designPath = path.join(cwd, "DESIGN.md");
		if (fs.existsSync(designPath)) {
			try {
				const design = fs.readFileSync(designPath, "utf8").trim();
				if (design) {
					injections.push(`## Design Constraints (enforced)\n${design}`);
				}
			} catch {
				// If unreadable, skip silently
			}
		}

		// AC-2/AC-3: Inject kit content (scoped or full based on config)
		let kitContent: string;
		if (config.scopedContext) {
			// AC-2: scoped — only include requirements referenced by active tasks
			const activeRefs = getActiveKitRefs(cwd);
			kitContent = buildKitContent(cwd, activeRefs);
		} else {
			// AC-3: full kit content
			kitContent = buildKitContent(cwd, null);
		}

		if (kitContent) {
			injections.push(`## Kit Requirements\n${kitContent}`);
		}

		// Inject CaveKit tool availability hint
		injections.push(
			[
				"## CaveKit Tools Available",
				"You have access to CaveKit tools for self-monitoring:",
				"- `kit_read` — Read kit requirements and acceptance criteria",
				"- `build_site_status` — Query current build wave/task state",
				"- `acceptance_check` — Validate an AC against current code",
				"- `convergence_check` — Detect if you're stuck in a plateau",
			].join("\n"),
		);

		if (injections.length === 0) return;

		// Return the enriched system prompt (chained by the extension framework)
		return {
			systemPrompt: `${event.systemPrompt}\n\n---\n\n${injections.join("\n\n")}`,
		};
	});
}
