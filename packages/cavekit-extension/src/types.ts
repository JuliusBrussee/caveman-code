/**
 * Shared CaveKit domain model types.
 * Canonical definitions for kits, requirements, build sites, tasks, findings,
 * and review overlays shared across commands, widgets, and runtime hooks.
 */

export const ACCEPTANCE_STATUSES = ["pass", "fail"] as const;
export type AcceptanceStatus = (typeof ACCEPTANCE_STATUSES)[number];

export interface AcceptanceCriterion {
	id: string;
	description: string;
	status: AcceptanceStatus;
}

export interface Requirement {
	id: string;
	name: string;
	description: string;
	acceptanceCriteria: AcceptanceCriterion[];
}

export interface Kit {
	domain: string;
	requirements: Requirement[];
	outOfScope: string[];
}

export const BUILD_TASK_STATUSES = ["pending", "in-progress", "complete", "failed", "blocked"] as const;
export type BuildTaskStatus = (typeof BUILD_TASK_STATUSES)[number];
export type TaskStatus = BuildTaskStatus | "done";

export interface BuildTask {
	id: string;
	name: string;
	acceptanceCriteriaIds: string[];
	tier: number;
	status: BuildTaskStatus;
	retryCount: number;
}

export type BuildDependencyEdge = readonly [taskId: string, dependsOnTaskId: string];

export interface BuildSite {
	name: string;
	tasks: BuildTask[];
	tierAssignments: Record<string, number>;
	dependencyEdges: BuildDependencyEdge[];
}

export const FINDING_SEVERITIES = ["P0", "P1", "P2", "P3"] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export interface Finding {
	description: string;
	severity: FindingSeverity;
	requirementRef: string;
}

export function isTaskStatus(value: string): value is TaskStatus {
	return value === "done" || (BUILD_TASK_STATUSES as readonly string[]).includes(value);
}

export function normalizeTaskStatus(value: string): BuildTaskStatus {
	if (value === "done") return "complete";
	return (BUILD_TASK_STATUSES as readonly string[]).includes(value) ? (value as BuildTaskStatus) : "pending";
}

export function isTaskComplete(status: TaskStatus): boolean {
	return status === "done" || status === "complete";
}

// ---------------------------------------------------------------------------
// Review overlay types — used by the two-pane review pane at phase gates.
// ---------------------------------------------------------------------------

export type ReviewItemStatus = "pending" | "approved" | "rejected" | "skipped";

export interface ReviewItem {
	/** Unique identifier for navigation and result tracking. */
	id: string;
	/** Display title shown in tab bar and right pane header. */
	title: string;
	/** Markdown content rendered in the left pane. */
	markdownContent: string;
	/** Key-value metadata shown in the right pane. */
	metadata: Array<{ label: string; value: string }>;
	/** Current review status. */
	status: ReviewItemStatus;
	/** Optional file path associated with this artifact. */
	filePath?: string;
}

export interface ReviewResult {
	items: Array<{ id: string; status: ReviewItemStatus }>;
	/** True if the user dismissed via Escape without completing all items. */
	dismissed: boolean;
}
