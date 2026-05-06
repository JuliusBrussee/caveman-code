import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BUILTIN_SLASH_COMMANDS } from "../src/core/slash-commands.js";

const here = dirname(fileURLToPath(import.meta.url));
const interactiveModePath = resolve(here, "../src/modes/interactive/interactive-mode.ts");

const SOURCE = readFileSync(interactiveModePath, "utf-8");

// Some commands intentionally route to a non-/<name> path (e.g. /plugins
// reuses /skills' handler, /scoped-models opens the models selector). The set
// below records those legitimate aliases / placeholders so the regression
// guard doesn't false-positive.
const ALIASES: Record<string, RegExp[]> = {
	plugins: [/text === "\/skills" \|\| text === "\/plugins"/],
	"scoped-models": [/text === "\/scoped-models"/],
	checkpoints: [/text === "\/checkpoints"/],
};

describe("slash command dispatcher", () => {
	it("every BUILTIN_SLASH_COMMAND is wired in interactive-mode (or covered by an alias)", () => {
		const missing: string[] = [];
		for (const cmd of BUILTIN_SLASH_COMMANDS) {
			const directBranch = new RegExp(
				`text === "/${cmd.name}"|text\\.startsWith\\("/${cmd.name}"\\)|text\\.startsWith\\("/${cmd.name} "\\)`,
			);
			if (directBranch.test(SOURCE)) continue;
			const aliases = ALIASES[cmd.name] ?? [];
			if (aliases.some((re) => re.test(SOURCE))) continue;
			missing.push(cmd.name);
		}
		expect(missing).toEqual([]);
	});

	it("dispatcher has an unknown-slash fallback that flags unwired built-ins", () => {
		expect(SOURCE).toMatch(/isUnwiredBuiltinSlash/);
	});
});
