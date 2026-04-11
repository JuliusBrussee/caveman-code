/**
 * /ck:research — Dispatch parallel explore subagents to synthesize a brief.
 *
 * Spawns 2–8 parallel Pi instances (via print mode) to search the codebase
 * and web, then synthesizes findings into context/refs/{topic}.md.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "cave";
import type { CaveKitConfig } from "../config/index.js";

export function registerResearchCommand(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.registerCommand("ck:research", {
		description: "Dispatch parallel research subagents and synthesize a brief",
		getArgumentCompletions: () => null,
		handler: async (args, ctx) => {
			const topic = args.trim();
			if (!topic) {
				ctx.ui.notify("Usage: /ck:research <topic>", "warning");
				return;
			}

			const cwd = ctx.cwd;
			const refsDir = path.join(cwd, "context", "refs");
			fs.mkdirSync(refsDir, { recursive: true });

			ctx.ui.notify(`Researching: ${topic}`, "info");
			await ctx.waitForIdle();

			const prompt = buildResearchPrompt(topic, refsDir);
			pi.sendUserMessage([{ type: "text", text: prompt }]);
		},
	});
}

function buildResearchPrompt(topic: string, refsDir: string): string {
	const slug = topic
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.slice(0, 40);
	const outputFile = path.join(refsDir, `${slug}.md`);

	return `You are executing the CaveKit RESEARCH phase.

## Topic
${topic}

## Instructions
Research this topic thoroughly using the following approach:

**Web search (AC-3 — use when available):**
- Search the web for current best practices, official docs, and community guidance on the topic
- Use the WebSearch or WebFetch tool if available; otherwise note in the brief that web search was unavailable
- Prioritize authoritative sources (official docs, RFC/spec documents, well-known engineering blogs)

**Codebase exploration:**
- Search the current codebase for existing implementations, patterns, or related code
- Identify files, functions, and patterns most relevant to the topic
- Note any constraints or conventions already established

**Best practices research:**
- Research current best practices and recommended approaches
- Note common pitfalls and how to avoid them
- Identify relevant libraries, tools, or patterns

**Synthesis:**
- Cross-validate findings from codebase and web/research sources
- Identify gaps between current state and best practices
- Produce actionable recommendations

## Output
Write a research brief to: ${outputFile}

## Brief Format
\`\`\`markdown
# Research Brief: ${topic}
**Date:** {date}

## Summary
{2–3 sentence executive summary}

## Codebase Findings
{What exists, what patterns are in use}

## Best Practices
{Current recommendations, key sources}

## Recommendations
1. {Specific, actionable recommendation}
2. {Specific, actionable recommendation}

## References
- {Source, URL if applicable}
\`\`\``;
}
