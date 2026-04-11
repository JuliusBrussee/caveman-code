/**
 * kit_read — LLM-callable tool to read a specific kit or requirement.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Type } from "@cave/ai";
import { defineTool } from "cave";

export const kitReadTool = defineTool({
	name: "kit_read",
	label: "Kit Read",
	description: "Read a CaveKit domain kit or specific requirement from context/kits/",
	parameters: Type.Object({
		domain: Type.Optional(Type.String({ description: "Domain name (e.g. 'auth', 'api'). Omit to list all kits." })),
		requirement: Type.Optional(Type.String({ description: "Requirement ID (e.g. 'R-001'). Omit to read full kit." })),
	}),
	async execute(_id, params, _signal, _onUpdate, ctx) {
		const cwd = ctx?.cwd ?? process.cwd();
		const kitsDir = path.join(cwd, "context", "kits");

		if (!fs.existsSync(kitsDir)) {
			return {
				details: undefined,
				content: [{ type: "text" as const, text: "No kits directory found. Run /ck:draft first." }],
			};
		}

		if (!params.domain) {
			const files = fs.readdirSync(kitsDir).filter((f) => f.endsWith(".md"));
			const list = files.map((f) => `- ${f.replace("kit-", "").replace(".md", "")}`).join("\n");
			return {
				details: undefined,
				content: [{ type: "text" as const, text: `Available kits:\n${list || "(none)"}` }],
			};
		}

		const kitFile = path.join(kitsDir, `kit-${params.domain}.md`);
		if (!fs.existsSync(kitFile)) {
			return {
				details: undefined,
				content: [{ type: "text" as const, text: `Kit not found: ${params.domain}` }],
			};
		}

		const content = fs.readFileSync(kitFile, "utf8");

		if (!params.requirement) {
			return { details: undefined, content: [{ type: "text" as const, text: content }] };
		}

		// Extract specific requirement block
		const reqPattern = new RegExp(`(###\\s+${params.requirement}:[\\s\\S]*?)(?=###|##|$)`, "i");
		const match = content.match(reqPattern);
		if (!match) {
			return {
				details: undefined,
				content: [
					{
						type: "text" as const,
						text: `Requirement ${params.requirement} not found in ${params.domain} kit.`,
					},
				],
			};
		}

		return { details: undefined, content: [{ type: "text" as const, text: match[1].trim() }] };
	},
});
