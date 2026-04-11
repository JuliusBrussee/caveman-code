/**
 * Shared CaveKit domain model types.
 * Canonical definitions for kits, requirements, build sites, tasks, and findings.
 */

export interface AcceptanceCriterion {
	id: string;
	description: string;
	status: "pass" | "fail";
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

export type TaskStatus = "pending" | "in-progress" | "done" | "failed" | "blocked";

export interface BuildTask {
	id: string;
	name: string;
	acceptanceCriteriaIds: string[];
	tier: number;
	status: TaskStatus;
	retryCount: number;
}

export interface BuildSite {
	name: string;
	tasks: BuildTask[];
	tierAssignments: Record<string, number>;
	dependencyEdges: Array<[string, string]>;
}

export type FindingSeverity = "P0" | "P1" | "P2" | "P3";

export interface Finding {
	description: string;
	severity: FindingSeverity;
	requirementRef: string;
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
