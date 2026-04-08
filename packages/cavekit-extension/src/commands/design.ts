/**
 * /ck:design — Create, audit, or import a DESIGN.md for cross-cutting constraints.
 *
 * Subcommands: create | audit | import
 * The DESIGN.md is injected into every build subagent via before_agent_start.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";

const DESIGN_SUBCOMMANDS = ["create", "audit", "import", "show"];

export function registerDesignCommand(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.registerCommand("ck:design", {
		description: "Manage DESIGN.md — cross-cutting constraints enforced across all builds",
		getArgumentCompletions: (prefix) => {
			const matches = DESIGN_SUBCOMMANDS.filter((s) => s.startsWith(prefix));
			return matches.length > 0 ? matches.map((s) => ({ value: s, label: s })) : null;
		},
		handler: async (args, ctx) => {
			const [sub, ...rest] = args.trim().split(/\s+/);
			const cwd = ctx.cwd;
			const designPath = path.join(cwd, "DESIGN.md");

			switch (sub) {
				case "create":
					await handleDesignCreate(pi, ctx, designPath);
					break;
				case "audit":
					await handleDesignAudit(pi, ctx, designPath);
					break;
				case "import":
					await handleDesignImport(pi, ctx, designPath, rest.join(" "));
					break;
				case "show":
					if (fs.existsSync(designPath)) {
						const content = fs.readFileSync(designPath, "utf8");
						ctx.ui.notify(`DESIGN.md (${content.split("\n").length} lines)`, "info");
					} else {
						ctx.ui.notify("No DESIGN.md found. Run /ck:design create", "warning");
					}
					break;
				default:
					ctx.ui.notify("Usage: /ck:design <create|audit|import|show>", "warning");
			}
		},
	});
}

async function handleDesignCreate(pi: ExtensionAPI, ctx: ExtensionCommandContext, designPath: string): Promise<void> {
	const exists = fs.existsSync(designPath);
	if (exists) {
		ctx.ui.notify("DESIGN.md already exists. Use /ck:design audit to review it.", "warning");
		return;
	}

	ctx.ui.notify("Starting guided DESIGN.md creation…", "info");
	await ctx.waitForIdle();

	pi.sendUserMessage([
		{
			type: "text",
			text: buildDesignCreatePrompt(designPath),
		},
	]);
}

async function handleDesignAudit(pi: ExtensionAPI, ctx: ExtensionCommandContext, designPath: string): Promise<void> {
	if (!fs.existsSync(designPath)) {
		ctx.ui.notify("No DESIGN.md found. Run /ck:design create first.", "warning");
		return;
	}
	await ctx.waitForIdle();
	pi.sendUserMessage([
		{
			type: "text",
			text: `Audit the DESIGN.md at ${designPath}. Check for: completeness (all 9 sections present), consistency (no contradictions), actionability (constraints are specific and enforceable). Report issues and suggest improvements.`,
		},
	]);
}

async function handleDesignImport(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
	designPath: string,
	sourcePath: string,
): Promise<void> {
	if (!sourcePath) {
		ctx.ui.notify("Usage: /ck:design import <source-file>", "warning");
		return;
	}
	await ctx.waitForIdle();
	pi.sendUserMessage([
		{
			type: "text",
			text: `Convert the design document at ${sourcePath} into a CaveKit DESIGN.md format at ${designPath}. Preserve all constraints. Use the standard 9-section format.`,
		},
	]);
}

function buildDesignCreatePrompt(designPath: string): string {
	return `You are helping create a DESIGN.md — the cross-cutting constraints document that will be injected into every build subagent during the CaveKit build phase.

Ask the user questions one at a time to gather the following, then write the DESIGN.md:

1. **Architecture pattern** — What high-level architecture? (e.g., REST API, event-driven, monolith)
2. **Tech stack** — Languages, frameworks, key libraries
3. **Code style** — Naming conventions, file organization, linting rules
4. **Security requirements** — Auth model, data validation approach, secrets handling
5. **Error handling** — How errors should be structured and surfaced
6. **Testing approach** — Unit/integration/e2e expectations, test file location
7. **Performance constraints** — Any SLOs or resource limits
8. **Data model principles** — DB patterns, schema conventions
9. **Forbidden patterns** — What should never be done (anti-patterns to avoid)

Write the final DESIGN.md to: ${designPath}

The file will be automatically injected as context into all build subagents to enforce these constraints.`;
}
