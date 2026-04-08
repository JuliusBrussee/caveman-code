/**
 * before_agent_start hook — inject DESIGN.md constraints into every build subagent.
 *
 * Also injects a brief CaveKit system prompt header describing available tools.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@cavepi/pi-coding-agent";
import type { CaveKitConfig } from "../config/index.js";

export function registerContextInjectionHook(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.on("before_agent_start", async (event, ctx) => {
		const cwd = ctx.cwd;
		const designPath = path.join(cwd, "DESIGN.md");
		const injections: string[] = [];

		// Inject DESIGN.md if present
		if (fs.existsSync(designPath)) {
			const design = fs.readFileSync(designPath, "utf8").trim();
			if (design) {
				injections.push(`## Design Constraints (enforced)\n${design}`);
			}
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

		if (injections.length > 0 && event.systemPrompt !== undefined) {
			// Append to existing system prompt
			event.systemPrompt = `${event.systemPrompt}\n\n---\n\n${injections.join("\n\n")}`;
		}
	});
}
