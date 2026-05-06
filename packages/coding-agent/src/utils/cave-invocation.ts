import { existsSync } from "node:fs";
import { basename } from "node:path";

export interface CaveInvocation {
	command: string;
	argsPrefix: string[];
}

/**
 * Resolve how to spawn same cave executable currently running.
 *
 * - source / dist script run → `node <script>`
 * - compiled binary run      → `<binary>`
 * - generic runtime fallback → `cave` on PATH
 */
export function resolveCurrentCaveInvocation(): CaveInvocation {
	const currentScript = process.argv[1];
	if (currentScript && existsSync(currentScript)) {
		return { command: process.execPath, argsPrefix: [currentScript] };
	}

	const execName = basename(process.execPath).toLowerCase();
	const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
	if (!isGenericRuntime) {
		return { command: process.execPath, argsPrefix: [] };
	}

	return { command: "cave", argsPrefix: [] };
}
