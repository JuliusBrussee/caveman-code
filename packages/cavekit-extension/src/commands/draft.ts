/**
 * /ck:draft — Decompose a natural language description into domain kits.
 *
 * Constructs a prompt incorporating the CaveKit Writing skill and
 * Validation-First Design skill, sends it, and parses output into
 * context/kits/kit-{domain}.md files.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
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
			fs.mkdirSync(kitsDir, { recursive: true });

			const prompt = buildDraftPrompt(description, cwd);
			pi.sendUserMessage([{ type: "text", text: prompt }]);

			// After the agent completes, the kit files will be written to context/kits/
			// The /ck:architect command reads from there.
		},
	});
}

function buildDraftPrompt(description: string, cwd: string): string {
	const kitsDir = path.join(cwd, "context", "kits");
	return `You are executing the CaveKit DRAFT phase.

## Task
Decompose the following feature description into structured domain kits using the CaveKit specification format.

## Feature Description
${description}

## Instructions
1. Identify 1–5 domains (e.g. auth, api, database, frontend, config)
2. For each domain, create a kit file at \`${kitsDir}/kit-{domain}.md\`
3. Each kit must follow this format:
   - Header with kit name and domain
   - R-numbered requirements (R-001, R-002, …)
   - Each requirement has 2–5 Acceptance Criteria (AC-1, AC-2, …)
   - Each AC must be testable and specific

## Kit Format
\`\`\`markdown
# Kit: {Domain Name}
**Domain:** {domain}
**Version:** 1.0.0
**Status:** draft

## Requirements

### R-001: {Requirement Title}
{1–2 sentence description of what must be true}

**Acceptance Criteria:**
- AC-1: {Specific, testable condition}
- AC-2: {Specific, testable condition}
\`\`\`

Write each kit file. After writing all kits, output a summary table listing each kit, its domain, requirement count, and AC count.
Output files to: ${kitsDir}/`;
}
