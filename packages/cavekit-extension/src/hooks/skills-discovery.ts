/**
 * resources_discover hook — register the bundled CaveKit skills directory.
 *
 * The ExtensionAPI fires "resources_discover" after session_start so extensions
 * can contribute additional skill, prompt, and theme paths to the resource loader.
 * Returning the bundled `skills/bundled/` directory from this hook satisfies R4/R6:
 * the host resource loader discovers CaveKit skills from a host-compatible layout
 * without mutating the original markdown sources.
 */

import type { ExtensionAPI } from "cave";
import type { CaveKitConfig } from "../config/index.js";
import { getBundledSkillDiscoveryPaths } from "../resources.js";

export function registerSkillsDiscoveryHook(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.on("resources_discover", async (_event) => {
		return {
			skillPaths: getBundledSkillDiscoveryPaths(),
		};
	});
}
