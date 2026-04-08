/**
 * Kit parser — parses kit markdown files into structured Kit/Requirement/AcceptanceCriterion types.
 *
 * Expected format:
 *   ---
 *   domain: some-domain
 *   ---
 *   # Blueprint: Title
 *   ## Requirements
 *   ### R1: Requirement Name
 *   **Description:** ...
 *   **Acceptance Criteria:**
 *   - [ ] AC-1: description
 *   ## Out of Scope
 *   - item one
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { AcceptanceCriterion, Kit, Requirement } from "../types.js";

export interface ParseError {
	line: number;
	message: string;
}

export interface KitParseResult {
	kit: Kit | null;
	errors: ParseError[];
}

export interface KitDirectoryResult {
	kits: Kit[];
	errors: ParseError[];
}

/** Parse a single kit markdown string into a Kit object. */
export function parseKit(content: string): KitParseResult {
	const errors: ParseError[] = [];
	const lines = content.split("\n");

	// --- Parse YAML frontmatter ---
	let domain = "";
	let bodyStart = 0;

	if (lines[0]?.trim() === "---") {
		let fmEnd = -1;
		for (let i = 1; i < lines.length; i++) {
			if (lines[i]?.trim() === "---") {
				fmEnd = i;
				break;
			}
			const domainMatch = lines[i].match(/^domain:\s*(.+)/);
			if (domainMatch) {
				domain = domainMatch[1].trim().replace(/^["']|["']$/g, "");
			}
		}
		if (fmEnd === -1) {
			errors.push({ line: 1, message: "Unclosed YAML frontmatter — missing closing '---'" });
		} else {
			bodyStart = fmEnd + 1;
		}
	}

	if (!domain) {
		errors.push({ line: 1, message: "Missing 'domain' field in YAML frontmatter" });
	}

	// --- Parse body ---
	const requirements: Requirement[] = [];
	const outOfScope: string[] = [];

	let inRequirements = false;
	let inOutOfScope = false;
	let currentReq: Partial<Requirement> | null = null;
	let collectingDescription = false;
	let descLines: string[] = [];
	let inAcceptanceCriteria = false;

	const flushRequirement = (atLine: number) => {
		if (!currentReq) return;
		if (!currentReq.id) {
			errors.push({ line: atLine, message: "Requirement missing ID" });
			currentReq = null;
			return;
		}
		if (!currentReq.name) {
			errors.push({
				line: atLine,
				message: `Requirement ${currentReq.id} is missing a name`,
			});
		}
		if (!currentReq.acceptanceCriteria || currentReq.acceptanceCriteria.length === 0) {
			errors.push({
				line: atLine,
				message: `Requirement ${currentReq.id} has no acceptance criteria`,
			});
		}
		requirements.push({
			id: currentReq.id!,
			name: currentReq.name ?? "",
			description: currentReq.description ?? "",
			acceptanceCriteria: currentReq.acceptanceCriteria ?? [],
		});
		currentReq = null;
		collectingDescription = false;
		inAcceptanceCriteria = false;
		descLines = [];
	};

	for (let i = bodyStart; i < lines.length; i++) {
		const lineNum = i + 1; // 1-based
		const line = lines[i];
		const trimmed = line.trim();

		// Top-level ## sections
		if (/^##\s/.test(line)) {
			flushRequirement(lineNum);

			if (/^##\s+Requirements?/i.test(line)) {
				inRequirements = true;
				inOutOfScope = false;
				continue;
			}
			if (/^##\s+Out\s+of\s+Scope/i.test(line)) {
				inRequirements = false;
				inOutOfScope = true;
				continue;
			}
			// Any other ## section ends both
			inRequirements = false;
			inOutOfScope = false;
			continue;
		}

		// Requirement heading: ### R{N}: Name
		if (/^###\s+/.test(line)) {
			flushRequirement(lineNum);
			const reqMatch = line.match(/^###\s+(R\d+):\s+(.+)/);
			if (!reqMatch) {
				errors.push({
					line: lineNum,
					message: `Unrecognised ### heading (expected '### R{N}: Name'): ${trimmed}`,
				});
				continue;
			}
			if (!inRequirements) {
				// Treat requirements outside ## Requirements section as valid anyway
				inRequirements = true;
			}
			currentReq = {
				id: reqMatch[1],
				name: reqMatch[2].trim(),
				description: "",
				acceptanceCriteria: [],
			};
			collectingDescription = false;
			inAcceptanceCriteria = false;
			descLines = [];
			continue;
		}

		// Within a requirement block
		if (currentReq) {
			// **Description:** or **Acceptance Criteria:** markers
			if (/^\*\*Description:\*\*/.test(line)) {
				collectingDescription = true;
				inAcceptanceCriteria = false;
				const inline = line.replace(/^\*\*Description:\*\*\s*/, "").trim();
				if (inline) descLines = [inline];
				else descLines = [];
				continue;
			}

			if (/^\*\*Acceptance Criteria:\*\*/.test(line)) {
				currentReq.description = descLines.join(" ").trim();
				collectingDescription = false;
				inAcceptanceCriteria = true;
				continue;
			}

			// Acceptance criterion lines: - [ ] AC-N: description  or  - [x] AC-N: description
			if (inAcceptanceCriteria && /^-\s+\[[ xX]\]\s+/.test(line)) {
				const acMatch = line.match(/^-\s+\[[ xX]\]\s+(AC-\d+):\s*(.+)/);
				if (!acMatch) {
					errors.push({
						line: lineNum,
						message: `Malformed acceptance criterion (expected '- [ ] AC-N: description'): ${trimmed}`,
					});
					continue;
				}
				const statusChar = line.match(/\[([xX ])\]/)?.[1] ?? " ";
				const ac: AcceptanceCriterion = {
					id: acMatch[1],
					description: acMatch[2].trim(),
					status: statusChar.toLowerCase() === "x" ? "pass" : "fail",
				};
				currentReq.acceptanceCriteria = [...(currentReq.acceptanceCriteria ?? []), ac];
				continue;
			}

			// Accumulate description lines (before **Acceptance Criteria:** marker)
			if (collectingDescription && trimmed && !trimmed.startsWith("**")) {
				descLines.push(trimmed);
				continue;
			}

			// Plain description paragraph (no explicit **Description:** marker)
			if (!inAcceptanceCriteria && !collectingDescription && trimmed && !trimmed.startsWith("**")) {
				if (!currentReq.description) {
					// Treat as inline description
					currentReq.description = trimmed;
				}
			}

			continue;
		}

		// Out of scope bullet items
		if (inOutOfScope && /^-\s+/.test(line)) {
			outOfScope.push(trimmed.replace(/^-\s+/, ""));
		}
	}

	// Flush last requirement
	flushRequirement(lines.length);

	if (requirements.length === 0 && errors.length === 0) {
		errors.push({ line: bodyStart + 1, message: "No requirements found in kit file" });
	}

	if (errors.length > 0 && !domain) {
		return { kit: null, errors };
	}

	// Return a kit even with non-fatal errors so callers can inspect partial results
	const kit: Kit = { domain, requirements, outOfScope };
	return { kit, errors };
}

/** Parse all kit markdown files in a directory. */
export function parseKitDirectory(dir: string): KitDirectoryResult {
	const allErrors: ParseError[] = [];
	const kits: Kit[] = [];

	if (!fs.existsSync(dir)) {
		allErrors.push({ line: 0, message: `Directory not found: ${dir}` });
		return { kits, errors: allErrors };
	}

	const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));

	if (files.length === 0) {
		allErrors.push({ line: 0, message: `No markdown files found in directory: ${dir}` });
		return { kits, errors: allErrors };
	}

	for (const file of files) {
		const filePath = path.join(dir, file);
		let content: string;
		try {
			content = fs.readFileSync(filePath, "utf8");
		} catch (err) {
			allErrors.push({ line: 0, message: `Failed to read file ${file}: ${String(err)}` });
			continue;
		}

		const result = parseKit(content);

		// Prefix file name to error messages for directory-level context
		for (const error of result.errors) {
			allErrors.push({ line: error.line, message: `[${file}] ${error.message}` });
		}

		if (result.kit) {
			kits.push(result.kit);
		}
	}

	return { kits, errors: allErrors };
}
