/**
 * /ck:preview — Preview CaveKit artifacts with rendered markdown.
 *
 * Resolves shorthand names to file paths and dispatches a preview request
 * via custom message. The markdown-preview extension listens for the
 * "ck:preview-request" custom type and renders the file.
 *
 * Falls back gracefully if markdown-preview is not installed.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "cave";
import type { CaveKitConfig } from "../config/index.js";

type PreviewTarget = "terminal" | "browser" | "pdf";

interface ParsedArgs {
	shorthand: string;
	target: PreviewTarget;
}

function parseArgs(args: string): ParsedArgs {
	const parts = args.trim().split(/\s+/);
	let target: PreviewTarget = "terminal";
	const nonFlags: string[] = [];

	for (const part of parts) {
		if (part === "--browser" || part === "browser") target = "browser";
		else if (part === "--pdf" || part === "pdf") target = "pdf";
		else if (part === "--terminal" || part === "terminal") target = "terminal";
		else nonFlags.push(part);
	}

	return { shorthand: nonFlags.join(" "), target };
}

/**
 * Resolve a CaveKit shorthand to an absolute file path.
 *
 * - "kit-auth" → context/kits/kit-auth.md or context/blueprints/kit-auth.md
 * - "plan" / "build-site" → latest context/plans/*.md
 * - "gap" → latest context/reports/gap-analysis-*.md
 * - "design" → DESIGN.md
 * - "T-001" → context/impl/T-001.md
 * - "ref-<name>" → context/refs/<name>.md
 * - Path with "/" → treat as relative path
 */
function resolveShorthand(cwd: string, shorthand: string): string | null {
	// Direct relative/absolute path
	if (shorthand.includes("/") || shorthand.includes("\\")) {
		const resolved = path.resolve(cwd, shorthand);
		return fs.existsSync(resolved) ? resolved : null;
	}

	// "design" → DESIGN.md
	if (shorthand === "design") {
		const p = path.join(cwd, "DESIGN.md");
		return fs.existsSync(p) ? p : null;
	}

	// "plan" or "build-site" → latest context/plans/*.md
	if (shorthand === "plan" || shorthand === "build-site") {
		return findLatestMd(path.join(cwd, "context", "plans"));
	}

	// "gap" or "gap-analysis" → latest context/reports/gap-analysis-*.md
	if (shorthand === "gap" || shorthand === "gap-analysis") {
		return findLatestMd(path.join(cwd, "context", "reports"), "gap-analysis-");
	}

	// "T-NNN" → context/impl/T-NNN.md
	if (/^T-\d+$/i.test(shorthand)) {
		const p = path.join(cwd, "context", "impl", `${shorthand.toUpperCase()}.md`);
		return fs.existsSync(p) ? p : null;
	}

	// "ref-<name>" → context/refs/<name>.md
	if (shorthand.startsWith("ref-")) {
		const name = shorthand.slice(4);
		const p = path.join(cwd, "context", "refs", `${name}.md`);
		return fs.existsSync(p) ? p : null;
	}

	// "kit-<name>" or bare "<name>" → context/blueprints/kit-<name>.md or context/kits/kit-<name>.md
	const kitName = shorthand.startsWith("kit-") ? shorthand : `kit-${shorthand}`;
	const blueprintPath = path.join(cwd, "context", "blueprints", `${kitName}.md`);
	if (fs.existsSync(blueprintPath)) return blueprintPath;
	const kitPath = path.join(cwd, "context", "kits", `${kitName}.md`);
	if (fs.existsSync(kitPath)) return kitPath;

	// Try as a direct filename under context/
	const directPath = path.join(cwd, "context", `${shorthand}.md`);
	if (fs.existsSync(directPath)) return directPath;

	return null;
}

function findLatestMd(dir: string, prefix?: string): string | null {
	if (!fs.existsSync(dir)) return null;
	const files = fs
		.readdirSync(dir)
		.filter((f) => f.endsWith(".md") && (!prefix || f.startsWith(prefix)))
		.map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
		.sort((a, b) => b.mtime - a.mtime);
	return files.length > 0 ? path.join(dir, files[0]!.name) : null;
}

function collectArtifacts(cwd: string): Array<{ value: string; label: string; path: string }> {
	const artifacts: Array<{ value: string; label: string; path: string }> = [];

	// DESIGN.md
	const designPath = path.join(cwd, "DESIGN.md");
	if (fs.existsSync(designPath)) {
		artifacts.push({ value: "design", label: "design — DESIGN.md", path: designPath });
	}

	// Kits (blueprints first, then kits)
	for (const dir of ["context/blueprints", "context/kits"]) {
		const fullDir = path.join(cwd, dir);
		if (!fs.existsSync(fullDir)) continue;
		for (const f of fs.readdirSync(fullDir).filter((f) => f.startsWith("kit-") && f.endsWith(".md"))) {
			const name = f.replace(/\.md$/, "");
			if (!artifacts.some((a) => a.value === name)) {
				artifacts.push({ value: name, label: `${name} — ${dir}/${f}`, path: path.join(fullDir, f) });
			}
		}
	}

	// Plans
	const plansDir = path.join(cwd, "context", "plans");
	if (fs.existsSync(plansDir)) {
		for (const f of fs.readdirSync(plansDir).filter((f) => f.endsWith(".md"))) {
			artifacts.push({ value: "plan", label: `plan — context/plans/${f}`, path: path.join(plansDir, f) });
		}
	}

	// Gap analyses
	const reportsDir = path.join(cwd, "context", "reports");
	if (fs.existsSync(reportsDir)) {
		const gaps = fs
			.readdirSync(reportsDir)
			.filter((f) => f.startsWith("gap-analysis-") && f.endsWith(".md"))
			.sort()
			.reverse();
		if (gaps.length > 0) {
			artifacts.push({
				value: "gap",
				label: `gap — context/reports/${gaps[0]}`,
				path: path.join(reportsDir, gaps[0]!),
			});
		}
	}

	// Impl records
	const implDir = path.join(cwd, "context", "impl");
	if (fs.existsSync(implDir)) {
		for (const f of fs
			.readdirSync(implDir)
			.filter((f) => /^T-\d+\.md$/.test(f))
			.sort()) {
			const id = f.replace(/\.md$/, "");
			artifacts.push({ value: id, label: `${id} — context/impl/${f}`, path: path.join(implDir, f) });
		}
	}

	// Refs
	const refsDir = path.join(cwd, "context", "refs");
	if (fs.existsSync(refsDir)) {
		for (const f of fs.readdirSync(refsDir).filter((f) => f.endsWith(".md"))) {
			const name = f.replace(/\.md$/, "");
			artifacts.push({
				value: `ref-${name}`,
				label: `ref-${name} — context/refs/${f}`,
				path: path.join(refsDir, f),
			});
		}
	}

	return artifacts;
}

export function registerPreviewCommand(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.registerCommand("ck:preview", {
		description: "Preview a CaveKit artifact (kit, plan, gap analysis, design, impl record)",
		getArgumentCompletions: (prefix) => {
			const cwd = process.cwd();
			const artifacts = collectArtifacts(cwd);
			const matches = artifacts.filter((a) => a.value.startsWith(prefix));
			return matches.length > 0 ? matches : null;
		},
		handler: async (args, ctx) => {
			const cwd = ctx.cwd;
			const { shorthand, target } = parseArgs(args);

			// Check if markdown-preview is available
			const hasPreview = pi.getCommands().some((c) => c.name === "preview");

			let filePath: string | null = null;

			if (!shorthand) {
				// Interactive picker
				const artifacts = collectArtifacts(cwd);
				if (artifacts.length === 0) {
					ctx.ui.notify("No CaveKit artifacts found. Run /ck:draft to generate kits.", "warning");
					return;
				}

				const options = artifacts.map((a) => a.label);
				const selected = await ctx.ui.select("Preview CaveKit Artifact", options);
				if (!selected) return;
				filePath = artifacts.find((a) => a.label === selected)?.path ?? null;
			} else {
				filePath = resolveShorthand(cwd, shorthand);
			}

			if (!filePath) {
				ctx.ui.notify(`Could not resolve "${shorthand}" to a CaveKit artifact.`, "error");
				return;
			}

			if (!hasPreview) {
				ctx.ui.notify(
					`markdown-preview not installed. Run: cave install npm:pi-markdown-preview\nOr manually: /preview ${path.relative(cwd, filePath)}`,
					"warning",
				);
				return;
			}

			// Dispatch preview request via custom message protocol
			pi.sendMessage<{ filePath: string; target: string }>({
				customType: "ck:preview-request",
				content: `Preview: ${path.relative(cwd, filePath)}`,
				display: false,
				details: { filePath, target },
			});
		},
	});
}
