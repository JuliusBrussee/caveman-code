/**
 * /ck:architect — Generate a tiered build site from approved kits.
 *
 * Reads context/kits/, constructs a prompt using the Core Methodology skill,
 * and produces context/sites/build-site-{name}.md with tiered tasks and
 * a coverage matrix mapping every AC to at least one task.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";

export function registerArchitectCommand(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.registerCommand("ck:architect", {
		description: "Generate a tiered build site from approved kits",
		getArgumentCompletions: () => null,
		handler: async (args, ctx) => {
			const cwd = ctx.cwd;
			const kitsDir = path.join(cwd, "context", "kits");
			const sitesDir = path.join(cwd, "context", "sites");

			if (!fs.existsSync(kitsDir)) {
				ctx.ui.notify("No kits found. Run /ck:draft first.", "warning");
				return;
			}

			const kitFiles = fs.readdirSync(kitsDir).filter((f) => f.startsWith("kit-") && f.endsWith(".md"));

			if (kitFiles.length === 0) {
				ctx.ui.notify("No kit files found in context/kits/", "warning");
				return;
			}

			fs.mkdirSync(sitesDir, { recursive: true });

			const siteName = args.trim() || "build-site";
			const outputPath = path.join(sitesDir, `${siteName}.md`);

			ctx.ui.notify(`Architecting build site from ${kitFiles.length} kit(s)…`, "info");
			await ctx.waitForIdle();

			const prompt = buildArchitectPrompt(kitsDir, kitFiles, outputPath);
			pi.sendUserMessage([{ type: "text", text: prompt }]);
		},
	});
}

function buildArchitectPrompt(kitsDir: string, kitFiles: string[], outputPath: string): string {
	const kitList = kitFiles.map((f) => `- ${path.join(kitsDir, f)}`).join("\n");
	return `You are executing the CaveKit ARCHITECT phase.

## Task
Read the approved kits and generate a tiered build site with dependency-ordered tasks.

## Kit Files
${kitList}

## Instructions
1. Read each kit file
2. Decompose requirements into discrete implementation tasks (T-001, T-002, …)
3. Assign each task to a tier (T0, T1, T2, …) based on dependencies
   - Tasks in the same tier have NO dependencies on each other (safe to parallelize)
   - Tasks in tier N may depend on tasks from tiers 0..N-1
4. For each task specify:
   - ID (T-NNN), name, description
   - Tier (0-based)
   - Dependencies (list of T-IDs)
   - Kit references (which R-numbers and ACs it implements)
   - Estimated complexity (S/M/L)
5. Build a coverage matrix confirming every AC maps to at least one task
6. Write the build site to: ${outputPath}

## Build Site Format
\`\`\`markdown
# Build Site: {name}
**Generated:** {date}
**Total Tasks:** N
**Tiers:** M
**Coverage:** N/N ACs mapped

## Tier 0 — Foundation (no dependencies)

### T-001: {Task Name}
**Kit Refs:** R-001 (AC-1, AC-2), R-003 (AC-1)
**Dependencies:** none
**Complexity:** M
**Status:** pending

{Task description — what must be implemented}

---

## Coverage Matrix
| Req | AC | Task |
|-----|----|------|
| R-001 | AC-1 | T-001 |
\`\`\`

Write the build site file now.`;
}
