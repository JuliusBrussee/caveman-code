/**
 * /ck:draft — Decompose a natural language description into domain kits.
 *
 * Constructs a prompt incorporating the CaveKit Writing skill and
 * Validation-First Design skill, sends it, and parses output into
 * context/kits/kit-{domain}.md files.
 *
 * AC-1: Creates kit files in context/blueprints/ (and context/kits/)
 * AC-2: Uses Requirement/AcceptanceCriterion structure from types.ts
 * AC-3: Reads reference materials from context/refs/
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "cave";
import type { CaveKitConfig } from "../config/index.js";

export function registerDraftCommand(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.registerCommand("ck:draft", {
		description: "Decompose a feature description into CaveKit domain kits",
		getArgumentCompletions: () => null,
		handler: async (args, ctx) => {
			const description = args.trim();
			if (!description) {
				ctx.ui.notify("Usage: /ck:draft <feature description>", "warning");
				return;
			}

			ctx.ui.notify("Drafting kits…", "info");
			await ctx.waitForIdle();

			const cwd = ctx.cwd;
			const kitsDir = path.join(cwd, "context", "kits");
			const blueprintsDir = path.join(cwd, "context", "blueprints");
			fs.mkdirSync(kitsDir, { recursive: true });
			fs.mkdirSync(blueprintsDir, { recursive: true });

			// AC-3: Read reference materials from context/refs/
			const refContext = readRefsContext(cwd);

			const prompt = buildDraftPrompt(description, cwd, refContext);
			pi.sendUserMessage([{ type: "text", text: prompt }]);

			// After the agent completes, the kit files will be written to context/kits/
			// The /ck:architect command reads from there.
			// Hint: preview kits with /ck:preview
			ctx.ui.notify("Kits will be written to context/kits/. Preview with: /ck:preview <domain>", "info");
		},
	});
}

/** Read reference materials from context/refs/ to provide context for kit generation. */
function readRefsContext(cwd: string): string {
	const refsDir = path.join(cwd, "context", "refs");
	if (!fs.existsSync(refsDir)) return "";

	const refFiles = fs.readdirSync(refsDir).filter((f) => f.endsWith(".md"));
	if (refFiles.length === 0) return "";

	const sections: string[] = [];
	for (const file of refFiles.slice(0, 8)) {
		// Read first 30 lines of each ref as a summary
		try {
			const content = fs.readFileSync(path.join(refsDir, file), "utf8");
			const lines = content.split("\n");
			const excerpt = lines.slice(0, 30).join("\n");
			sections.push(`**${file}** (${lines.length} lines):\n${excerpt}`);
		} catch {
			// ignore unreadable files
		}
	}

	return sections.length > 0
		? `\n\n## Reference Materials (context/refs/)\nThe following reference documents are available. Use them to inform requirements:\n\n${sections.join("\n\n---\n\n")}`
		: "";
}

function buildDraftPrompt(description: string, cwd: string, refContext: string): string {
	const kitsDir = path.join(cwd, "context", "kits");
	const blueprintsDir = path.join(cwd, "context", "blueprints");
	return `You are executing the CaveKit DRAFT phase.

## Task
Decompose the following feature description into structured domain kits using the CaveKit specification format.

## Feature Description
${description}
${refContext}

## Instructions
1. Identify 1–5 domains (e.g. auth, api, database, frontend, config)
2. For each domain, create a kit file at \`${kitsDir}/kit-{domain}.md\`
3. Also create a blueprint file at \`${blueprintsDir}/blueprint-{domain}.md\` with the same content
4. Each kit must follow the Requirement/AcceptanceCriterion structure:
   - Kit has a domain name and list of Requirements
   - Each Requirement has: id (R-001 format), name, description, acceptanceCriteria[]
   - Each AcceptanceCriterion has: id (AC-1 format), description (testable, specific)
   - Requirements should be implementation-agnostic (WHAT, not HOW)
   - AcceptanceCriteria must be independently verifiable

## CaveKit Writing Principles (apply these)
- Write requirements in terms of observable behavior, not implementation details
- Each AC must be independently testable (a test can pass/fail on it alone)
- No AC should require reading another AC to understand it
- Include explicit out-of-scope statements for each kit
- Aim for 2–5 ACs per requirement

## Kit Format
\`\`\`markdown
# Kit: {Domain Name}
**Domain:** {domain}
**Version:** 1.0.0
**Status:** draft

## Requirements

### R1: {Requirement Title}
{1–2 sentence description of what must be true — implementation-agnostic}

**Acceptance Criteria:**
- AC-1: {Specific, testable, self-contained condition}
- AC-2: {Specific, testable, self-contained condition}

## Out of Scope
- {What this kit explicitly does NOT cover}
\`\`\`

Write each kit file AND the corresponding blueprint file.
After writing all files, output a summary table listing each kit, its domain, requirement count, and total AC count.
Output kit files to: ${kitsDir}/
Output blueprint files to: ${blueprintsDir}/`;
}
