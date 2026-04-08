/**
 * /ck:inspect — Gap analysis comparing built output against original kits.
 *
 * Reads context/kits/, context/sites/, and context/impl/ records,
 * dispatches a gap analysis prompt, and presents findings.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";

export function registerInspectCommand(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.registerCommand("ck:inspect", {
		description: "Run gap analysis comparing built code against kit requirements",
		getArgumentCompletions: () => null,
		handler: async (_args, ctx) => {
			const cwd = ctx.cwd;
			const kitsDir = path.join(cwd, "context", "kits");
			const sitesDir = path.join(cwd, "context", "sites");
			const implDir = path.join(cwd, "context", "impl");

			if (!fs.existsSync(kitsDir)) {
				ctx.ui.notify("No kits found. Run /ck:draft first.", "warning");
				return;
			}

			ctx.ui.notify("Running gap analysis…", "info");
			await ctx.waitForIdle();

			const kitFiles = fs.existsSync(kitsDir) ? fs.readdirSync(kitsDir).filter((f) => f.endsWith(".md")) : [];
			const siteFiles = fs.existsSync(sitesDir) ? fs.readdirSync(sitesDir).filter((f) => f.endsWith(".md")) : [];
			const implFiles = fs.existsSync(implDir) ? fs.readdirSync(implDir).filter((f) => f.endsWith(".md")) : [];

			const prompt = buildInspectPrompt(cwd, kitsDir, kitFiles, sitesDir, siteFiles, implDir, implFiles);
			pi.sendUserMessage([{ type: "text", text: prompt }]);
		},
	});
}

function buildInspectPrompt(
	cwd: string,
	_kitsDir: string,
	kitFiles: string[],
	_sitesDir: string,
	siteFiles: string[],
	_implDir: string,
	implFiles: string[],
): string {
	return `You are executing the CaveKit INSPECT phase — gap analysis.

## Task
Compare what was built against the original kit requirements and identify gaps.

## Available Context
**Kits (${kitFiles.length}):** ${path.join(cwd, "context", "kits")}/
${kitFiles.map((f) => `  - ${f}`).join("\n") || "  (none)"}

**Build Sites (${siteFiles.length}):** ${path.join(cwd, "context", "sites")}/
${siteFiles.map((f) => `  - ${f}`).join("\n") || "  (none)"}

**Impl Records (${implFiles.length}):** ${path.join(cwd, "context", "impl")}/
${implFiles.map((f) => `  - ${f}`).join("\n") || "  (none)"}

## Instructions
1. Read all kit files to extract every requirement and AC
2. Read impl records and/or inspect actual source code to check coverage
3. For each requirement, determine: ✓ fully met | ⚠ partially met | ✗ missing
4. For each missing/partial item, describe specifically what's absent
5. Generate remediation tasks for any gaps found
6. Output a gap report to context/reports/gap-analysis-{timestamp}.md

## Gap Report Format
\`\`\`markdown
# Gap Analysis
**Date:** {date}
**Coverage:** N/M requirements fully met

## Gaps Found
### R-NNN: {Requirement} — ⚠ PARTIAL / ✗ MISSING
- **AC-N:** {What's missing or incorrect}
- **Remediation:** {Specific task to close this gap}

## Remediation Tasks
1. {Task description, references requirement and AC}
\`\`\``;
}
