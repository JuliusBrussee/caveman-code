/**
 * build_site_status — Query current wave/task state from the active build site.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Type } from "@cave/ai";
import { defineTool } from "cave";
import { parseBuildSite } from "../wave/executor.js";

export const buildSiteStatusTool = defineTool({
	name: "build_site_status",
	label: "Build Site Status",
	description: "Query current task and wave state from the active build site",
	parameters: Type.Object({
		taskId: Type.Optional(Type.String({ description: "Task ID to query (e.g. T-001). Omit for overall status." })),
	}),
	async execute(_id, params, _signal, _onUpdate, ctx) {
		const cwd = ctx?.cwd ?? process.cwd();
		const sitesDir = path.join(cwd, "context", "sites");

		if (!fs.existsSync(sitesDir)) {
			return { details: undefined, content: [{ type: "text", text: "No build sites found." }] };
		}

		const siteFiles = fs.readdirSync(sitesDir).filter((f) => f.endsWith(".md"));
		if (siteFiles.length === 0) {
			return { details: undefined, content: [{ type: "text", text: "No build sites found." }] };
		}

		const siteFile = path.join(sitesDir, siteFiles[siteFiles.length - 1]);
		const content = fs.readFileSync(siteFile, "utf8");
		const tasks = parseBuildSite(content);

		if (params.taskId) {
			const task = tasks.find((t) => t.id === params.taskId);
			if (!task) {
				return { details: undefined, content: [{ type: "text", text: `Task ${params.taskId} not found.` }] };
			}
			return {
				details: undefined,
				content: [
					{
						type: "text",
						text: [
							`**${task.id}: ${task.name}**`,
							`Status: ${task.status}`,
							`Tier: ${task.tier}`,
							`Iterations: ${task.iterations}`,
							`Kit Refs: ${task.kitRefs.join(", ") || "none"}`,
							`Dependencies: ${task.dependencies.join(", ") || "none"}`,
						].join("\n"),
					},
				],
			};
		}

		const total = tasks.length;
		const done = tasks.filter((t) => t.status === "done").length;
		const inProgress = tasks.filter((t) => t.status === "in-progress").length;
		const blocked = tasks.filter((t) => t.status === "blocked").length;
		const pending = tasks.filter((t) => t.status === "pending").length;

		return {
			details: undefined,
			content: [
				{
					type: "text",
					text: [
						`Build Site: ${path.basename(siteFile)}`,
						`Total: ${total} | Done: ${done} | Active: ${inProgress} | Pending: ${pending} | Blocked: ${blocked}`,
						"",
						...tasks.map((t) => `${t.id} [${t.status}] Tier ${t.tier}: ${t.name}`),
					].join("\n"),
				},
			],
		};
	},
});
