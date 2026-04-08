/**
 * /ck:architect — Generate a tiered build site from approved kits.
 *
 * AC-1: Reads kit files from context/blueprints/ (T-030 requirement).
 * AC-2: Generates a build site with tiered task dependency graph.
 * AC-3: Writes output to context/plans/build-site.md.
 * AC-4: Tasks reference kit requirement IDs (e.g. fork-identity/R1).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";
import { parseKitDirectory } from "../parsers/kit-parser.js";
import { reviewKits } from "../widgets/kit-reviewer.js";

export function registerArchitectCommand(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.registerCommand("ck:architect", {
		description: "Generate a tiered build site from approved kits",
		getArgumentCompletions: () => null,
		handler: async (args, ctx) => {
			const cwd = ctx.cwd;

			// AC-1: Read kits from context/blueprints/ (primary source per T-030)
			// Fall back to context/kits/ for backward compatibility.
			const blueprintsDir = path.join(cwd, "context", "blueprints");
			const kitsDir = path.join(cwd, "context", "kits");

			let sourceDir: string;
			if (fs.existsSync(blueprintsDir)) {
				sourceDir = blueprintsDir;
			} else if (fs.existsSync(kitsDir)) {
				sourceDir = kitsDir;
			} else {
				ctx.ui.notify("No kits found. Run /ck:draft first or add blueprints to context/blueprints/.", "warning");
				return;
			}

			// AC-1: Use the kit parser to extract requirements
			const { kits, errors } = parseKitDirectory(sourceDir);

			if (errors.length > 0 && kits.length === 0) {
				ctx.ui.notify(`Kit parsing failed: ${errors[0].message}`, "error");
				return;
			}

			if (kits.length === 0) {
				ctx.ui.notify(`No parseable kit files found in ${sourceDir}`, "warning");
				return;
			}

			// T-047 / extension-ui R6: Review kits before architecting
			const { approvedKits, rejectedKits } = await reviewKits(kits, { ui: ctx.ui });
			if (approvedKits.length === 0) {
				ctx.ui.notify("All kits were rejected. Aborting architect.", "warning");
				return;
			}
			if (rejectedKits.length > 0) {
				ctx.ui.notify(
					`${rejectedKits.length} kit(s) rejected, proceeding with ${approvedKits.length} approved kit(s).`,
					"info",
				);
			}

			// AC-3: Output path is context/plans/build-site.md
			const plansDir = path.join(cwd, "context", "plans");
			fs.mkdirSync(plansDir, { recursive: true });

			const siteName = args.trim() || "build-site";
			const outputPath = path.join(plansDir, `${siteName}.md`);

			ctx.ui.notify(
				`Architecting build site from ${approvedKits.length} kit(s) in ${path.relative(cwd, sourceDir)}…`,
				"info",
			);
			await ctx.waitForIdle();

			// AC-2 + AC-4: Build prompt with approved kit data, requiring domain/RN refs
			const prompt = buildArchitectPrompt(approvedKits, outputPath, sourceDir);
			pi.sendUserMessage([{ type: "text", text: prompt }]);

			ctx.ui.notify("Build site will be written to context/plans/. Preview with: /ck:preview plan", "info");
		},
	});
}

interface KitSummary {
	domain: string;
	requirements: Array<{ id: string; name: string; acCount: number }>;
}

function buildArchitectPrompt(
	kits: Array<{
		domain: string;
		requirements: Array<{ id: string; name: string; acceptanceCriteria: Array<unknown> }>;
	}>,
	outputPath: string,
	sourceDir: string,
): string {
	// Summarise parsed kit data so the LLM knows exactly what to cover
	const kitSummaries: KitSummary[] = kits.map((kit) => ({
		domain: kit.domain,
		requirements: kit.requirements.map((req) => ({
			id: req.id,
			name: req.name,
			acCount: req.acceptanceCriteria.length,
		})),
	}));

	const totalReqs = kitSummaries.reduce((sum, k) => sum + k.requirements.length, 0);
	const totalACs = kits.reduce(
		(sum, k) => sum + k.requirements.reduce((s, r) => s + r.acceptanceCriteria.length, 0),
		0,
	);

	const kitOverview = kitSummaries
		.map((k) => {
			const reqs = k.requirements.map((r) => `    - ${k.domain}/${r.id}: ${r.name} (${r.acCount} AC)`).join("\n");
			return `  **${k.domain}** (${k.requirements.length} requirements)\n${reqs}`;
		})
		.join("\n\n");

	const coverageTableHeader = kitSummaries
		.flatMap((k) =>
			k.requirements.flatMap((r) =>
				Array.from({ length: r.acCount }, (_, i) => `| ${k.domain}/${r.id} | AC-${i + 1} | _(task)_ |`),
			),
		)
		.join("\n");

	return `You are executing the CaveKit ARCHITECT phase.

## Task
Read the parsed kit data below and generate a tiered build site with dependency-ordered tasks.
All kit files were loaded from: ${sourceDir}

## Parsed Kits (${kits.length} kits · ${totalReqs} requirements · ${totalACs} acceptance criteria)

${kitOverview}

## Instructions

1. Decompose all requirements above into discrete implementation tasks (T-001, T-002, …).
2. Assign each task to a tier (Tier 0, Tier 1, Tier 2, …) based on dependencies:
   - Tasks in the SAME tier have NO mutual dependencies (safe to parallelise).
   - Tasks in Tier N may depend on tasks from Tiers 0..N-1.
3. For each task provide:
   - ID (T-NNN format), name, one-paragraph description
   - Tier number
   - Dependencies (list of T-IDs, or "none")
   - **Kit Refs** using domain/RN notation (e.g. \`fork-identity/R1\`, \`extension-commands/R14\`)
   - Estimated complexity: S | M | L
4. Build a coverage matrix confirming EVERY AC from EVERY kit maps to ≥ 1 task.
   Use the domain/RN format in the Req column (e.g. \`extension-commands/R14\`).
5. Write the complete build site to: ${outputPath}

## Build Site Format

\`\`\`markdown
# Build Site: {name}
**Generated:** {date}
**Source:** ${sourceDir}
**Total Tasks:** N
**Tiers:** M
**Coverage:** N/N ACs mapped

## Tier 0 — Foundation (no dependencies)

### T-001: {Task Name}
**Kit Refs:** fork-identity/R1 (AC-1, AC-2), extension-commands/R14 (AC-1)
**Dependencies:** none
**Complexity:** M
**Status:** pending

{One-paragraph description of what must be implemented}

---

## Tier 1 — {Label}

### T-002: {Task Name}
**Kit Refs:** extension-commands/R2 (AC-1, AC-2, AC-3)
**Dependencies:** T-001
**Complexity:** L
**Status:** pending

{Description}

---

## Coverage Matrix
| Req | AC | Task |
|-----|----|------|
${coverageTableHeader}
\`\`\`

## Build Site List Format (for parsers)

Below the prose sections, also include a machine-readable task list in this exact format
(required by the build site parser):

\`\`\`markdown
## Tier 0

- T-001: {Task Name} --> fork-identity/R1
- T-002: {Task Name} --> extension-commands/R2

## Tier 1

- T-003: {Task Name} (blockedBy: T-001, T-002) --> extension-commands/R14
\`\`\`

Write the complete build site file now. Make sure every requirement listed above is covered.`;
}
