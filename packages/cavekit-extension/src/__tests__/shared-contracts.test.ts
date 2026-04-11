import { describe, expect, it } from "vitest";
import {
	BUILD_TASK_STATUSES,
	FINDING_SEVERITIES,
	isTaskComplete,
	isTaskStatus,
	normalizeTaskStatus,
	type AcceptanceCriterion,
	type BuildSite,
	type BuildTask,
	type Finding,
	type Kit,
	type Requirement,
} from "../index.js";

describe("shared contracts", () => {
	it("defines typed kit, requirement, task, build site, and finding contracts", () => {
		const criterion = {
			id: "AC-1",
			description: "Expose typed acceptance criteria.",
			status: "pass",
		} satisfies AcceptanceCriterion;

		const requirement = {
			id: "R-001",
			name: "Extension entry point",
			description: "Bootstraps config, commands, and hooks.",
			acceptanceCriteria: [criterion],
		} satisfies Requirement;

		const task = {
			id: "T-001",
			name: "Bootstrap runtime",
			acceptanceCriteriaIds: ["extension-core/R1/AC-1"],
			tier: 0,
			status: "complete",
			retryCount: 1,
		} satisfies BuildTask;

		const site = {
			name: "Foundation",
			tasks: [task],
			tierAssignments: { "T-001": 0 },
			dependencyEdges: [],
		} satisfies BuildSite;

		const kit = {
			domain: "extension-core",
			requirements: [requirement],
			outOfScope: ["Widget rendering details"],
		} satisfies Kit;

		const finding = {
			description: "Missing project override handling.",
			severity: "P1",
			requirementRef: "extension-core/R2",
		} satisfies Finding;

		expect(kit.domain).toBe("extension-core");
		expect(site.tasks[0]?.status).toBe("complete");
		expect(finding.severity).toBe("P1");
	});

	it("exposes canonical task statuses and status helpers", () => {
		expect(BUILD_TASK_STATUSES).toEqual(["pending", "in-progress", "complete", "failed", "blocked"]);
		expect(FINDING_SEVERITIES).toEqual(["P0", "P1", "P2", "P3"]);
		expect(isTaskStatus("complete")).toBe(true);
		expect(isTaskStatus("done")).toBe(true);
		expect(isTaskStatus("invalid")).toBe(false);
		expect(normalizeTaskStatus("done")).toBe("complete");
		expect(normalizeTaskStatus("blocked")).toBe("blocked");
		expect(isTaskComplete("done")).toBe(true);
		expect(isTaskComplete("complete")).toBe(true);
	});
});
