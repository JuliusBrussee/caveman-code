/**
 * System prompt construction and project context loading
 */

import { getDocsPath, getExamplesPath, getReadmePath } from "../config.js";
import { formatSkillsForPrompt, type Skill } from "./skills.js";

export interface BuildSystemPromptOptions {
	/** Custom system prompt (replaces default). */
	customPrompt?: string;
	/** Tools to include in prompt. Default: [read, bash, edit, write] */
	selectedTools?: string[];
	/** Optional one-line tool snippets keyed by tool name. */
	toolSnippets?: Record<string, string>;
	/** Additional guideline bullets appended to the default system prompt guidelines. */
	promptGuidelines?: string[];
	/** Text to append to system prompt. */
	appendSystemPrompt?: string;
	/** Working directory. Default: process.cwd() */
	cwd?: string;
	/** Pre-loaded context files. */
	contextFiles?: Array<{ path: string; content: string }>;
	/** Pre-loaded skills. */
	skills?: Skill[];
	/** Cave mode settings for communication style injection. */
	caveMode?: {
		enabled: boolean;
		intensity: "lite" | "full" | "ultra";
	};
}

// ============================================================================
// Cave Mode System Prompt
// ============================================================================

/**
 * Build the cave mode communication rules block based on intensity level.
 * Returns empty string when cave mode is disabled.
 */
export function buildCaveModePrompt(intensity: "lite" | "full" | "ultra"): string {
	const lite = `
## Communication Style (Cave Mode: lite)
Communicate in terse, compressed style. Drop unnecessary articles (a, an, the) and filler words where meaning is clear.

Intensity: light compression — preserve most natural language, just trim obvious filler.

EXCEPTIONS (always use normal English for):
- Code blocks and inline code
- Commit messages and PR descriptions
- Security warnings and destructive operation confirmations (e.g., deleting files, force-push, overwriting data)`;

	const full = `
## Communication Style (Cave Mode: full)
Communicate in compressed, terse style. Drop articles, filler, pleasantries. Skip preamble. Answer directly.

Rules:
- No "I'll help you with that" or "Great question!" or similar filler
- Drop articles where meaning is clear ("File saved" not "The file has been saved")
- Skip pleasantries and acknowledgment phrases
- Be direct: lead with the answer, not the explanation
- Use bullet points over prose when listing multiple items

EXCEPTIONS (always use normal English for):
- Code blocks and inline code
- Commit messages and PR descriptions
- Security warnings and destructive operation confirmations (e.g., deleting files, force-push, overwriting data)`;

	const ultra = `
## Communication Style (Cave Mode: ultra)
Maximum compression. Respond like terse technical documentation. No articles, no pleasantries, no preamble.

Rules:
- Drop all articles (a, an, the)
- Drop all pleasantries and acknowledgments
- No full sentences when fragments suffice ("Done." not "I have completed the task.")
- Use abbreviations where unambiguous (e.g., "dir" for directory, "cmd" for command)
- Prefer symbols over words where clear (→ for "leads to", ✓ for done)
- Bullet points over prose always
- Numbers over words for quantities

EXCEPTIONS (always use normal, clear English for):
- Code blocks and inline code
- Commit messages and PR descriptions
- Security warnings and destructive operation confirmations (e.g., deleting files, force-push, overwriting data)`;

	switch (intensity) {
		case "lite":
			return lite;
		case "ultra":
			return ultra;
		default:
			return full;
	}
}

/** Build the system prompt with tools, guidelines, and context */
export function buildSystemPrompt(options: BuildSystemPromptOptions = {}): string {
	const {
		customPrompt,
		selectedTools,
		toolSnippets,
		promptGuidelines,
		appendSystemPrompt,
		cwd,
		contextFiles: providedContextFiles,
		skills: providedSkills,
		caveMode,
	} = options;

	// Build cave mode section (empty string if disabled)
	const caveModeSection = caveMode?.enabled === true ? buildCaveModePrompt(caveMode.intensity ?? "full") : "";
	const resolvedCwd = cwd ?? process.cwd();
	const promptCwd = resolvedCwd.replace(/\\/g, "/");

	const date = new Date().toISOString().slice(0, 10);

	const appendSection = appendSystemPrompt ? `\n\n${appendSystemPrompt}` : "";

	const contextFiles = providedContextFiles ?? [];
	const skills = providedSkills ?? [];

	if (customPrompt) {
		let prompt = customPrompt;

		if (appendSection) {
			prompt += appendSection;
		}

		// Append project context files
		if (contextFiles.length > 0) {
			prompt += "\n\n# Project Context\n\n";
			prompt += "Project-specific instructions and guidelines:\n\n";
			for (const { path: filePath, content } of contextFiles) {
				prompt += `## ${filePath}\n\n${content}\n\n`;
			}
		}

		// Append skills section (only if read tool is available)
		const customPromptHasRead = !selectedTools || selectedTools.includes("read");
		if (customPromptHasRead && skills.length > 0) {
			prompt += formatSkillsForPrompt(skills);
		}

		// Append cave mode communication rules (after everything else)
		if (caveModeSection) {
			prompt += `\n${caveModeSection}`;
		}

		// Add date and working directory last
		prompt += `\nCurrent date: ${date}`;
		prompt += `\nCurrent working directory: ${promptCwd}`;

		return prompt;
	}

	// Get absolute paths to documentation and examples
	const readmePath = getReadmePath();
	const docsPath = getDocsPath();
	const examplesPath = getExamplesPath();

	// Build tools list based on selected tools.
	// A tool appears in Available tools only when the caller provides a one-line snippet.
	const tools = selectedTools || ["read", "bash", "edit", "write"];
	const visibleTools = tools.filter((name) => !!toolSnippets?.[name]);
	const toolsList =
		visibleTools.length > 0 ? visibleTools.map((name) => `- ${name}: ${toolSnippets![name]}`).join("\n") : "(none)";

	// Build guidelines based on which tools are actually available
	const guidelinesList: string[] = [];
	const guidelinesSet = new Set<string>();
	const addGuideline = (guideline: string): void => {
		if (guidelinesSet.has(guideline)) {
			return;
		}
		guidelinesSet.add(guideline);
		guidelinesList.push(guideline);
	};

	const hasBash = tools.includes("bash");
	const hasGrep = tools.includes("grep");
	const hasFind = tools.includes("find");
	const hasLs = tools.includes("ls");
	const hasRead = tools.includes("read");

	// File exploration guidelines
	if (hasBash && !hasGrep && !hasFind && !hasLs) {
		addGuideline("Use bash for file operations like ls, rg, find");
	} else if (hasBash && (hasGrep || hasFind || hasLs)) {
		addGuideline("Prefer grep/find/ls tools over bash for file exploration (faster, respects .gitignore)");
	}

	for (const guideline of promptGuidelines ?? []) {
		const normalized = guideline.trim();
		if (normalized.length > 0) {
			addGuideline(normalized);
		}
	}

	// Always include these
	addGuideline("Be concise in your responses");
	addGuideline("Show file paths clearly when working with files");

	const guidelines = guidelinesList.map((g) => `- ${g}`).join("\n");

	let prompt = `You are an expert coding assistant operating inside Cave, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files.

Available tools:
${toolsList}

In addition to the tools above, you may have access to other custom tools depending on the project.

Guidelines:
${guidelines}

Cave documentation (read only when the user asks about Cave itself, its SDK, extensions, themes, skills, or TUI):
- Main documentation: ${readmePath}
- Additional docs: ${docsPath}
- Examples: ${examplesPath} (extensions, custom tools, SDK)
- When asked about: extensions (docs/extensions.md, examples/extensions/), themes (docs/themes.md), skills (docs/skills.md), prompt templates (docs/prompt-templates.md), TUI components (docs/tui.md), keybindings (docs/keybindings.md), SDK integrations (docs/sdk.md), custom providers (docs/custom-provider.md), adding models (docs/models.md), cave packages (docs/packages.md)
- When working on Cave topics, read the docs and examples, and follow .md cross-references before implementing
- Always read Cave .md files completely and follow links to related docs (e.g., tui.md for TUI API details)`;

	if (appendSection) {
		prompt += appendSection;
	}

	// Append project context files
	if (contextFiles.length > 0) {
		prompt += "\n\n# Project Context\n\n";
		prompt += "Project-specific instructions and guidelines:\n\n";
		for (const { path: filePath, content } of contextFiles) {
			prompt += `## ${filePath}\n\n${content}\n\n`;
		}
	}

	// Append skills section (only if read tool is available)
	if (hasRead && skills.length > 0) {
		prompt += formatSkillsForPrompt(skills);
	}

	// Append cave mode communication rules (after everything else)
	if (caveModeSection) {
		prompt += `\n${caveModeSection}`;
	}

	// Add date and working directory last
	prompt += `\nCurrent date: ${date}`;
	prompt += `\nCurrent working directory: ${promptCwd}`;

	return prompt;
}
