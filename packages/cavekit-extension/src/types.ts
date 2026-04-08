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
