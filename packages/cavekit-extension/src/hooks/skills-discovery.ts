/**
 * resources_discover hook — register the bundled CaveKit skills directory.
 *
 * The ExtensionAPI fires "resources_discover" after session_start so extensions
 * can contribute additional skill, prompt, and theme paths to the resource loader.
 * Returning the bundled `skills/` directory from this hook satisfies T-011 AC-2:
 * skills are discoverable by the resource loader after init.
 *
 * The skills directory is read-only at runtime (it lives inside node_modules after
 * npm install), satisfying AC-3.
 */

import * as path from "node:path";
import * as url from "node:url";
import type { ExtensionAPI } from "cave";
import type { CaveKitConfig } from "../config/index.js";

/**
 * Resolve the absolute path to the bundled `skills/` directory.
 *
 * __dirname is not available in ESM; we derive the package root from import.meta.url
 * (this file lives at src/hooks/skills-discovery.ts → two levels up is the package root).
 */
function getBundledSkillsPath(): string {
	const hooksDir = path.dirname(url.fileURLToPath(import.meta.url));
	// src/hooks → src → package root → skills/
	const packageRoot = path.resolve(hooksDir, "..", "..");
	return path.join(packageRoot, "skills");
}

export function registerSkillsDiscoveryHook(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.on("resources_discover", async (_event) => {
		return {
			skillPaths: [getBundledSkillsPath()],
		};
	});
}
