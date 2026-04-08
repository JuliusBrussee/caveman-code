/**
 * Build site parser — parses build site markdown into the canonical BuildSite type.
 *
 * Expected format (from context/plans/build-site.md):
 *
 *   ## Tier N -- optional label
 *   - T-001: Task name --> domain/RN
 *   - T-002: Task name (blockedBy: T-001, T-003) --> domain/RN
 *
 * Validation:
 *   - All blockedBy references must point to existing task IDs (no dangling refs).
 *   - Dependency graph must be acyclic (DFS cycle detection).
 */

import type { BuildSite, BuildTask, TaskStatus } from "../types.js";
import type { ParseError } from "./kit-parser.js";

export interface BuildSiteParseResult {
	site: BuildSite | null;
	errors: ParseError[];
}

/** Parse a build site markdown string into a BuildSite. */
export function parseBuildSite(content: string, name = "Build Site"): BuildSiteParseResult {
	const errors: ParseError[] = [];
	const lines = content.split("\n");
	const tasks: BuildTask[] = [];
	const tierAssignments: Record<string, number> = {};
	const dependencyEdges: Array<[string, string]> = [];

	// blockedBy maps task id -> list of dependency ids (before validation)
	const rawDeps: Record<string, string[]> = {};

	let currentTier = 0;

	// Detect the file-level name from a top-level heading, if present
	let siteName = name;

	for (let i = 0; i < lines.length; i++) {
		const lineNum = i + 1;
		const line = lines[i];

		// File-level heading: # Build Site: Name
		const h1Match = line.match(/^#\s+Build\s+Site:\s*(.+)/i);
		if (h1Match) {
			siteName = h1Match[1].trim();
			continue;
		}

		// Tier heading: ## Tier N  or  ## Tier N -- label
		const tierMatch = line.match(/^##\s+Tier\s+(\d+)/i);
		if (tierMatch) {
			currentTier = Number(tierMatch[1]);
			continue;
		}

		// Task line: - T-NNN: Name (blockedBy: T-xxx, T-yyy) --> domain/RN
		// The blockedBy and --> parts are optional.
		const taskLineMatch = line.match(/^-\s+(T-\d+):\s+(.+)/);
		if (!taskLineMatch) continue;

		const rawId = taskLineMatch[1];
		let rest = taskLineMatch[2];

		// Extract blockedBy clause: (blockedBy: T-xxx, T-yyy)
		let deps: string[] = [];
		const blockedByMatch = rest.match(/\(blockedBy:\s*([^)]+)\)/i);
		if (blockedByMatch) {
			deps = blockedByMatch[1]
				.split(/,\s*/)
				.map((s) => s.trim())
				.filter(Boolean);
			rest = rest.replace(blockedByMatch[0], "").trim();
		}

		// Extract kit ref clause: --> domain/RN
		const kitRefMatch = rest.match(/-->\s*(.+)$/);
		const acceptanceCriteriaIds: string[] = [];
		if (kitRefMatch) {
			// Store the raw ref as-is; could be resolved later by scoped context builder
			acceptanceCriteriaIds.push(kitRefMatch[1].trim());
			rest = rest.replace(kitRefMatch[0], "").trim();
		}

		// Strip trailing backticks, commas, etc.
		const taskName = rest.replace(/[`]+/g, "").trim();

		// Detect duplicate task IDs
		if (tasks.some((t) => t.id === rawId)) {
			errors.push({ line: lineNum, message: `Duplicate task ID: ${rawId}` });
			continue;
		}

		const task: BuildTask = {
			id: rawId,
			name: taskName,
			acceptanceCriteriaIds,
			tier: currentTier,
			status: "pending" as TaskStatus,
			retryCount: 0,
		};

		tasks.push(task);
		tierAssignments[rawId] = currentTier;
		rawDeps[rawId] = deps;
	}

	if (tasks.length === 0) {
		errors.push({ line: 1, message: "No tasks found in build site" });
		return { site: null, errors };
	}

	const taskIds = new Set(tasks.map((t) => t.id));

	// --- Validate: no dangling dependency references ---
	for (const task of tasks) {
		for (const dep of rawDeps[task.id] ?? []) {
			if (!taskIds.has(dep)) {
				const lineRef = lines.findIndex((l) => l.includes(task.id)) + 1;
				errors.push({
					line: lineRef,
					message: `Task ${task.id} has dangling dependency reference: ${dep} (task not found)`,
				});
			} else {
				dependencyEdges.push([task.id, dep]);
			}
		}
	}

	// --- Validate: no circular dependencies (DFS) ---
	const cycles = detectCycles(taskIds, rawDeps);
	for (const cycle of cycles) {
		errors.push({
			line: 0,
			message: `Circular dependency detected: ${cycle.join(" -> ")}`,
		});
	}

	const site: BuildSite = {
		name: siteName,
		tasks,
		tierAssignments,
		dependencyEdges,
	};

	return { site, errors };
}

/**
 * DFS-based cycle detection.
 * Returns an array of cycles, each represented as the sequence of task IDs that form the cycle.
 */
function detectCycles(taskIds: Set<string>, deps: Record<string, string[]>): string[][] {
	const WHITE = 0; // unvisited
	const GRAY = 1; // in current DFS path
	const BLACK = 2; // fully processed

	const color: Record<string, number> = {};
	const parent: Record<string, string | null> = {};
	const cycles: string[][] = [];

	for (const id of taskIds) {
		color[id] = WHITE;
		parent[id] = null;
	}

	const dfs = (node: string) => {
		color[node] = GRAY;
		for (const dep of deps[node] ?? []) {
			if (!taskIds.has(dep)) continue; // dangling — already reported
			if (color[dep] === GRAY) {
				// Found a back edge — reconstruct the cycle
				const cycle: string[] = [dep, node];
				let cur = node;
				while (parent[cur] && parent[cur] !== dep) {
					cur = parent[cur]!;
					cycle.unshift(cur);
				}
				cycle.unshift(dep);
				cycles.push(cycle);
			} else if (color[dep] === WHITE) {
				parent[dep] = node;
				dfs(dep);
			}
		}
		color[node] = BLACK;
	};

	for (const id of taskIds) {
		if (color[id] === WHITE) {
			dfs(id);
		}
	}

	return cycles;
}
