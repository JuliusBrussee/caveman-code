/**
 * tool_call hook — intercept bash calls and apply safety gating.
 *
 * Modes:
 *   allowlist — only allow commands matching known-safe patterns
 *   blocklist — block commands matching dangerous patterns
 *   codex     — forward to Codex for classification (Phase 2, stub for now)
 */

import type { ExtensionAPI } from "cave";
import { isToolCallEventType } from "cave";
import type { CaveKitConfig } from "../config/index.js";

// Commands that are never safe regardless of mode
const ALWAYS_BLOCK = [
	/rm\s+-rf\s+\//,
	/dd\s+if=/,
	/mkfs/,
	/:(){ :|:& };:/, // fork bomb
	/curl.*\|\s*bash/,
	/wget.*\|\s*sh/,
];

// Commands that are safe to always allow
const SAFE_ALLOWLIST = [
	/^(ls|cat|head|tail|grep|find|echo|pwd|cd|mkdir|touch|cp|mv)\b/,
	/^git\s+(status|diff|log|show|branch|add|commit|push|pull|fetch|merge|stash)\b/,
	/^npm\s+(install|run|test|build|ci)\b/,
	/^(node|tsx|ts-node|bun|python|python3)\s+/,
	/^(tsc|eslint|prettier|biome)\b/,
];

export function registerCommandSafetyGate(pi: ExtensionAPI, config: CaveKitConfig): void {
	pi.on("tool_call", async (event, ctx) => {
		// Only intercept bash tool calls
		if (!isToolCallEventType("bash", event)) return;

		const command = event.input?.command ?? "";
		if (!command) return;

		// Always block dangerous commands regardless of mode
		for (const pattern of ALWAYS_BLOCK) {
			if (pattern.test(command)) {
				ctx.ui.notify(`CaveKit safety gate: blocked dangerous command\n${command}`, "error");
				return { block: true, reason: "Dangerous command blocked by CaveKit safety gate" };
			}
		}

		if (config.commandGate === "allowlist") {
			const isAllowed = SAFE_ALLOWLIST.some((p) => p.test(command.trim()));
			if (!isAllowed) {
				const allow = await ctx.ui.confirm(
					"Command Safety Gate",
					`Allow this command?\n\n\`${command}\`\n\nThis command is not in the CaveKit safe list.`,
				);
				if (!allow) {
					ctx.ui.notify("Command blocked by safety gate.", "warning");
					return { block: true, reason: "Command not in CaveKit allowlist" };
				}
			}
		} else if (config.commandGate === "blocklist") {
			// Only block ALWAYS_BLOCK (already handled above)
		}
		// codex mode: Phase 2, stub — falls through to allowlist behavior
	});
}
