export {
	AgentSchema,
	type AgentToolDetails,
	type AgentToolInput,
	type AgentToolOptions,
	agentToolDefinition,
	createAgentToolDefinition,
} from "./agent.js";
export {
	type BashOperations,
	type BashSpawnContext,
	type BashSpawnHook,
	type BashToolDetails,
	type BashToolInput,
	type BashToolOptions,
	bashTool,
	bashToolDefinition,
	createBashTool,
	createBashToolDefinition,
	createLocalBashOperations,
} from "./bash.js";
export {
	ClarifySchema,
	type ClarifyToolDetails,
	type ClarifyToolInput,
	clarifyToolDefinition,
} from "./clarify.js";
export {
	createEditTool,
	createEditToolDefinition,
	type EditOperations,
	type EditToolDetails,
	type EditToolInput,
	type EditToolOptions,
	editTool,
	editToolDefinition,
} from "./edit.js";
export { withFileMutationQueue } from "./file-mutation-queue.js";
export {
	createFindTool,
	createFindToolDefinition,
	type FindOperations,
	type FindToolDetails,
	type FindToolInput,
	type FindToolOptions,
	findTool,
	findToolDefinition,
} from "./find.js";
export {
	createGrepTool,
	createGrepToolDefinition,
	type GrepOperations,
	type GrepToolDetails,
	type GrepToolInput,
	type GrepToolOptions,
	grepTool,
	grepToolDefinition,
} from "./grep.js";
export {
	createLsTool,
	createLsToolDefinition,
	type LsOperations,
	type LsToolDetails,
	type LsToolInput,
	type LsToolOptions,
	lsTool,
	lsToolDefinition,
} from "./ls.js";
export {
	createReadTool,
	createReadToolDefinition,
	type ReadOperations,
	type ReadToolDetails,
	type ReadToolInput,
	type ReadToolOptions,
	readTool,
	readToolDefinition,
} from "./read.js";
export {
	type SendMessageDetails,
	type SendMessageInput,
	sendMessageToolDefinition,
	type TaskStatusInput,
	taskStatusToolDefinition,
} from "./send-message.js";
// WS6: Subagents & Plan Mode
export {
	createTaskToolDefinition,
	TaskSchema,
	type TaskToolDetails,
	type TaskToolInput,
	type TaskToolOptions,
	taskToolDefinition,
} from "./task.js";
export {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	type TruncationOptions,
	type TruncationResult,
	truncateHead,
	truncateLine,
	truncateTail,
} from "./truncate.js";
export {
	createWriteTool,
	createWriteToolDefinition,
	type WriteOperations,
	type WriteToolInput,
	type WriteToolOptions,
	writeTool,
	writeToolDefinition,
} from "./write.js";

import type { AgentTool } from "@cave/agent";
import type { ToolDefinition } from "../extensions/types.js";
import { createAgentToolDefinition } from "./agent.js";
import {
	type BashToolOptions,
	bashTool,
	bashToolDefinition,
	createBashTool,
	createBashToolDefinition,
} from "./bash.js";
import { clarifyToolDefinition } from "./clarify.js";
import { createEditTool, createEditToolDefinition, editTool, editToolDefinition } from "./edit.js";
import { createFindTool, createFindToolDefinition, findTool, findToolDefinition } from "./find.js";
import { createGrepTool, createGrepToolDefinition, grepTool, grepToolDefinition } from "./grep.js";
import { createLsTool, createLsToolDefinition, lsTool, lsToolDefinition } from "./ls.js";
import {
	createReadTool,
	createReadToolDefinition,
	type ReadToolOptions,
	readTool,
	readToolDefinition,
} from "./read.js";
import { sendMessageToolDefinition, taskStatusToolDefinition } from "./send-message.js";
import { createTaskToolDefinition, type TaskToolOptions } from "./task.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";
import { createWriteTool, createWriteToolDefinition, writeTool, writeToolDefinition } from "./write.js";

export type Tool = AgentTool<any>;
export type ToolDef = ToolDefinition<any, any>;

// Module-level Tool wrappers for the WS6 subagent + clarify tools. They share
// `process.cwd()` because callers that want a custom cwd build via the
// `createAll*` factories below.
const taskTool: Tool = wrapToolDefinition(createTaskToolDefinition(process.cwd()));
const agentTool: Tool = wrapToolDefinition(createAgentToolDefinition(process.cwd()));
const clarifyTool: Tool = wrapToolDefinition(clarifyToolDefinition);
const sendMessageTool: Tool = wrapToolDefinition(sendMessageToolDefinition);
const taskStatusTool: Tool = wrapToolDefinition(taskStatusToolDefinition);

export const codingTools: Tool[] = [readTool, bashTool, editTool, writeTool];
export const readOnlyTools: Tool[] = [readTool, grepTool, findTool, lsTool];

export const allTools = {
	read: readTool,
	bash: bashTool,
	edit: editTool,
	write: writeTool,
	grep: grepTool,
	find: findTool,
	ls: lsTool,
	clarify: clarifyTool,
	task: taskTool,
	agent: agentTool,
	send_message: sendMessageTool,
	task_status: taskStatusTool,
};

export const allToolDefinitions = {
	read: readToolDefinition,
	bash: bashToolDefinition,
	edit: editToolDefinition,
	write: writeToolDefinition,
	grep: grepToolDefinition,
	find: findToolDefinition,
	ls: lsToolDefinition,
	clarify: clarifyToolDefinition,
	task: createTaskToolDefinition(process.cwd()),
	agent: createAgentToolDefinition(process.cwd()),
	send_message: sendMessageToolDefinition,
	task_status: taskStatusToolDefinition,
};

export type ToolName = keyof typeof allTools;

export interface ToolsOptions {
	read?: ReadToolOptions;
	bash?: BashToolOptions;
	task?: TaskToolOptions;
}

export function createCodingToolDefinitions(cwd: string, options?: ToolsOptions): ToolDef[] {
	return [
		createReadToolDefinition(cwd, options?.read),
		createBashToolDefinition(cwd, options?.bash),
		createEditToolDefinition(cwd),
		createWriteToolDefinition(cwd),
	];
}

export function createReadOnlyToolDefinitions(cwd: string, options?: ToolsOptions): ToolDef[] {
	return [
		createReadToolDefinition(cwd, options?.read),
		createGrepToolDefinition(cwd),
		createFindToolDefinition(cwd),
		createLsToolDefinition(cwd),
	];
}

export function createAllToolDefinitions(cwd: string, options?: ToolsOptions): Record<ToolName, ToolDef> {
	return {
		read: createReadToolDefinition(cwd, options?.read),
		bash: createBashToolDefinition(cwd, options?.bash),
		edit: createEditToolDefinition(cwd),
		write: createWriteToolDefinition(cwd),
		grep: createGrepToolDefinition(cwd),
		find: createFindToolDefinition(cwd),
		ls: createLsToolDefinition(cwd),
		clarify: clarifyToolDefinition,
		task: createTaskToolDefinition(cwd, options?.task),
		agent: createAgentToolDefinition(cwd, options?.task),
		send_message: sendMessageToolDefinition,
		task_status: taskStatusToolDefinition,
	};
}

export function createCodingTools(cwd: string, options?: ToolsOptions): Tool[] {
	return [
		createReadTool(cwd, options?.read),
		createBashTool(cwd, options?.bash),
		createEditTool(cwd),
		createWriteTool(cwd),
	];
}

export function createReadOnlyTools(cwd: string, options?: ToolsOptions): Tool[] {
	return [createReadTool(cwd, options?.read), createGrepTool(cwd), createFindTool(cwd), createLsTool(cwd)];
}

export function createAllTools(cwd: string, options?: ToolsOptions): Record<ToolName, Tool> {
	return {
		read: createReadTool(cwd, options?.read),
		bash: createBashTool(cwd, options?.bash),
		edit: createEditTool(cwd),
		write: createWriteTool(cwd),
		grep: createGrepTool(cwd),
		find: createFindTool(cwd),
		ls: createLsTool(cwd),
		clarify: wrapToolDefinition(clarifyToolDefinition),
		task: wrapToolDefinition(createTaskToolDefinition(cwd, options?.task)),
		agent: wrapToolDefinition(createAgentToolDefinition(cwd, options?.task)),
		send_message: wrapToolDefinition(sendMessageToolDefinition),
		task_status: wrapToolDefinition(taskStatusToolDefinition),
	};
}
