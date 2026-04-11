import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

const packageRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");

export const BUNDLED_SKILLS = [
	{
		id: "ck-brownfield-adoption",
		legacyMarkdownFile: "ck-brownfield-adoption.md",
		description:
			"Adopt CaveKit incrementally inside existing codebases by retrofitting specs around bounded changes.",
	},
	{
		id: "ck-context-architecture",
		legacyMarkdownFile: "ck-context-architecture.md",
		description: "Keep agent context focused on design constraints and task-relevant material.",
	},
	{
		id: "ck-convergence-monitoring",
		legacyMarkdownFile: "ck-convergence-monitoring.md",
		description: "Detect repeated failure patterns and break convergence plateaus during iterative work.",
	},
	{
		id: "ck-design-system",
		legacyMarkdownFile: "ck-design-system.md",
		description: "Integrate design-system tokens and waivers into CaveKit specs and implementation workflows.",
	},
	{
		id: "ck-documentation-inversion",
		legacyMarkdownFile: "ck-documentation-inversion.md",
		description: "Drive implementation from user-facing documentation written first.",
	},
	{
		id: "ck-impl-tracking",
		legacyMarkdownFile: "ck-impl-tracking.md",
		description: "Track build tasks, wave state, and persisted execution progress for CaveKit.",
	},
	{
		id: "ck-methodology",
		legacyMarkdownFile: "ck-methodology.md",
		description: "Core CaveKit spec-driven workflow covering Draft, Architect, Build, and Inspect.",
	},
	{
		id: "ck-peer-review-loop",
		legacyMarkdownFile: "ck-peer-review-loop.md",
		description: "Run iterative review and revision loops until findings are resolved or retries are exhausted.",
	},
	{
		id: "ck-peer-review",
		legacyMarkdownFile: "ck-peer-review.md",
		description: "Review implementation against acceptance criteria with structured findings.",
	},
	{
		id: "ck-prompt-pipeline",
		legacyMarkdownFile: "ck-prompt-pipeline.md",
		description: "Guide agents through clarify, plan, execute, verify, and summarize stages.",
	},
	{
		id: "ck-revision",
		legacyMarkdownFile: "ck-revision.md",
		description: "Revise implementation systematically from findings, feedback, and failing acceptance criteria.",
	},
	{
		id: "ck-speculative-pipeline",
		legacyMarkdownFile: "ck-speculative-pipeline.md",
		description: "Explore multiple implementation strategies in parallel and select the best-passing result.",
	},
	{
		id: "ck-ui-craft",
		legacyMarkdownFile: "ck-ui-craft.md",
		description: "Specify and validate high-fidelity, accessible UI work under CaveKit.",
	},
	{
		id: "ck-validation-first",
		legacyMarkdownFile: "ck-validation-first.md",
		description: "Write acceptance criteria and validation checks before implementation.",
	},
	{
		id: "ck-writing",
		legacyMarkdownFile: "ck-writing.md",
		description: "Write clear, implementation-agnostic CaveKit kits with measurable acceptance criteria.",
	},
] as const;

export type BundledSkillId = (typeof BUNDLED_SKILLS)[number]["id"];

export function getBundledSkillsRoot(): string {
	return path.join(packageRoot, "skills", "bundled");
}

export function getBundledSkillDirectory(skillId: BundledSkillId): string {
	return path.join(getBundledSkillsRoot(), skillId);
}

export function getBundledSkillFile(skillId: BundledSkillId): string {
	return path.join(getBundledSkillDirectory(skillId), "SKILL.md");
}

export function getBundledSkillSourceFile(skillId: BundledSkillId): string {
	const skill = BUNDLED_SKILLS.find((entry) => entry.id === skillId);
	if (!skill) {
		throw new Error(`Unknown bundled CaveKit skill: ${skillId}`);
	}
	return path.join(packageRoot, "skills", skill.legacyMarkdownFile);
}

export function getBundledSkillDiscoveryPaths(): string[] {
	const bundledSkillsRoot = getBundledSkillsRoot();
	return fs.existsSync(bundledSkillsRoot) ? [bundledSkillsRoot] : [];
}
