/**
 * Hooks subsystem entrypoint.
 *
 * Public API:
 *   - HooksRegistry  — load + match Claude Code-format hook configs
 *   - HooksExecutor  — run command hooks per CC contract
 *   - HooksManager   — convenience wrapper that owns both
 *   - subscribeHooksToExtensionEvents() — wire HooksManager into the
 *     existing cave extension event bus so the 12 lifecycle events
 *     fire without churning agent-session.ts. WS5/WS6 etc. can plug
 *     additional events into the manager directly.
 */

import type { CaveHookEvent, HookDispatchResult, HookStdin } from "./events.js";
import { CAVE_HOOK_EVENTS, isCaveHookEvent } from "./events.js";
import { type ExecutorOptions, HooksExecutor } from "./executor.js";
import { HooksRegistry, type HooksRegistryOptions } from "./registry.js";

export {
	buildCavememHooksSnippet,
	buildDefaultCavememHooks,
	CAVEMEM_HOOK_EVENT_NAMES,
	type CavememHookOptions,
} from "./cavemem-hooks.js";
export * from "./events.js";
export { type ExecutorOptions, HooksExecutor } from "./executor.js";
export { HooksRegistry, type HooksRegistryOptions, type MatchedHook } from "./registry.js";

export interface HooksManagerOptions {
	executor?: ExecutorOptions;
	registry?: HooksRegistryOptions;
	/** Returns the current session id (used for stdin payloads). */
	sessionId?: () => string;
	/** Returns cwd. Defaults to process.cwd(). */
	cwd?: () => string;
	/** Project root for $CAVE_PROJECT_DIR. Defaults to cwd. */
	projectDir?: () => string;
}

/**
 * High-level facade. One per agent session.
 */
export class HooksManager {
	readonly registry: HooksRegistry;
	readonly executor: HooksExecutor;
	private getSessionId: () => string;
	private getCwd: () => string;

	constructor(options: HooksManagerOptions = {}) {
		this.registry = new HooksRegistry(options.registry);
		this.executor = new HooksExecutor({
			...options.executor,
			cwd: options.executor?.cwd ?? options.cwd?.(),
			projectDir: options.executor?.projectDir ?? options.projectDir?.() ?? options.cwd?.(),
		});
		this.getSessionId = options.sessionId ?? (() => "cave-session");
		this.getCwd = options.cwd ?? (() => process.cwd());
	}

	/** Build a stdin payload with the manager's defaults filled in. */
	buildStdin(event: CaveHookEvent | string, extra: Partial<HookStdin> = {}): HookStdin {
		return {
			session_id: this.getSessionId(),
			cwd: this.getCwd(),
			hook_event_name: event,
			...extra,
		};
	}

	/** Run all hooks matched for an event. */
	async dispatch(
		event: CaveHookEvent | string,
		matcherInput: string | undefined,
		stdinExtras: Partial<HookStdin> = {},
	): Promise<HookDispatchResult> {
		const matched = this.registry.resolve(event, matcherInput);
		if (matched.length === 0) {
			return {
				event,
				matcher: matcherInput,
				results: [],
				continue: true,
			};
		}
		const stdin = this.buildStdin(event, stdinExtras);
		const result = await this.executor.dispatch(event, matcherInput, matched, stdin);
		// Mark `once` hooks as consumed.
		for (const m of matched) {
			this.registry.markFired(m.hook);
		}
		return result;
	}

	/**
	 * Test helper: dispatch with a synthetic stdin payload regardless of
	 * matcher input. Powers `cave hooks test <event>`.
	 */
	async test(event: CaveHookEvent | string, matcherInput: string | undefined): Promise<HookDispatchResult> {
		const stdin = this.buildStdin(event, {
			tool_name: matcherInput,
			tool_input: { command: "echo 'cave hooks test'" },
		} as Partial<HookStdin>);
		const matched = this.registry.resolve(event, matcherInput);
		const result = await this.executor.dispatch(event, matcherInput, matched, stdin);
		for (const m of matched) {
			this.registry.markFired(m.hook);
		}
		return result;
	}
}

/**
 * Minimal subset of `ExtensionAPI` we need to subscribe to.
 * Defining it locally avoids a circular import with extensions/types.ts.
 */
export interface ExtensionEventBusLike {
	on(event: string, handler: (e: any, ctx: any) => any): void;
}

/**
 * Wire a HooksManager into cave's existing extension event bus.
 *
 * This adapter translates extension events (`session_start`, `tool_call`,
 * `tool_result`, ...) to Claude Code-compatible event names + matcher
 * inputs and runs the corresponding hooks.
 *
 * Returns the manager so callers can keep tweaking the registry later.
 */
export function subscribeHooksToExtensionEvents(api: ExtensionEventBusLike, manager: HooksManager): HooksManager {
	api.on("session_start", async (e: { reason: string }) => {
		await manager.dispatch("SessionStart", reasonToSource(e.reason), { source: e.reason } as any);
	});
	api.on("session_shutdown", async () => {
		await manager.dispatch("SessionEnd", "prompt_input_exit", {
			reason: "prompt_input_exit",
		} as any);
	});
	// Stop/SubagentStop are dispatched directly by AgentSession when it
	// observes agent_end. Keeping them out of this synthetic extension avoids
	// losing hooks if the extension event bus is rebound or torn down near the
	// end of a turn.
	api.on("session_compact", async () => {
		await manager.dispatch("PostCompact", "auto", { trigger: "auto" } as any);
	});
	api.on("session_before_compact", async () => {
		await manager.dispatch("PreCompact", "auto", { trigger: "auto" } as any);
	});

	// PreToolUse / PostToolUse: hooks are pure observers post-permission-strip.
	// They still receive the event and can patch input via `updatedInput`, but
	// they cannot deny / block tool execution.
	api.on("tool_call", async (e: { toolName: string; input: Record<string, unknown>; toolCallId: string }) => {
		const out = await manager.dispatch("PreToolUse", e.toolName, {
			tool_name: e.toolName,
			tool_input: e.input,
			tool_use_id: e.toolCallId,
		} as any);
		if (out.updatedInput) {
			Object.assign(e.input, out.updatedInput);
		}
		return undefined;
	});
	api.on(
		"tool_result",
		async (e: {
			toolName: string;
			input: Record<string, unknown>;
			toolCallId: string;
			content: any;
			isError: boolean;
		}) => {
			await manager.dispatch("PostToolUse", e.toolName, {
				tool_name: e.toolName,
				tool_input: e.input,
				tool_response: e.content,
				tool_error: e.isError,
				tool_use_id: e.toolCallId,
			} as any);
			return undefined;
		},
	);

	api.on("input", async (e: { text: string; source: string }) => {
		const result = await manager.dispatch("UserPromptSubmit", undefined, {
			prompt: e.text,
		} as any);
		if (!result.continue) {
			return { action: "handled" };
		}
		// stdout-as-context: re-inject the text into the assistant turn.
		if (result.additionalContext) {
			return {
				action: "transform",
				text: `${e.text}\n\n<system-reminder>\n${result.additionalContext}\n</system-reminder>`,
			};
		}
		return undefined;
	});
	return manager;
}

/**
 * Build a synthetic cave Extension whose handlers fire the configured hooks.
 *
 * Drop the returned object into the `extensions` array passed to
 * `new ExtensionRunner(...)` and the standard `runner.emit({type, ...})`
 * sites in agent-session will dispatch hook recipes alongside any
 * user-installed extensions. No event-bus refactor required.
 */
/**
 * Build a synthetic cave Extension whose handlers fire the configured hooks.
 *
 * Drop the returned object into the `extensions` array passed to
 * `new ExtensionRunner(...)` and the standard `runner.emit({type, ...})`
 * sites in agent-session will dispatch hook recipes alongside any
 * user-installed extensions. No event-bus refactor required.
 *
 * Return type is `unknown`-ish (Map<string, any>) because the cave Extension
 * shape lives in core/extensions/types.ts and we cannot import it here without
 * a cycle. The runner only reads `path`, `resolvedPath`, `sourceInfo`, and
 * `handlers`, so the empty maps below satisfy the structural shape.
 */
export function createHooksExtension(manager: HooksManager): unknown {
	const handlers = new Map<string, ((event: any, ctx: any) => any)[]>();
	const adapter: ExtensionEventBusLike = {
		on(event: string, handler: (e: any, ctx: any) => any): void {
			const list = handlers.get(event) ?? [];
			list.push(handler);
			handlers.set(event, list);
		},
	};
	subscribeHooksToExtensionEvents(adapter, manager);
	return {
		path: "<builtin:hooks>",
		resolvedPath: "<builtin:hooks>",
		sourceInfo: { path: "<builtin:hooks>" },
		handlers,
		tools: new Map(),
		messageRenderers: new Map(),
		commands: new Map(),
		flags: new Map(),
		shortcuts: new Map(),
	};
}

function reasonToSource(reason: string): string {
	switch (reason) {
		case "startup":
			return "startup";
		case "resume":
		case "fork":
			return "resume";
		case "reload":
			return "clear";
		default:
			return reason;
	}
}

/** Surface the registered events for slash command listing. */
export function listSupportedEvents(): readonly string[] {
	return CAVE_HOOK_EVENTS;
}

export { isCaveHookEvent };
