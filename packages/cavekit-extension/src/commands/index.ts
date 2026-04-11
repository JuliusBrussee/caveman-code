/**
 * Registers all /ck:* slash commands with the Pi ExtensionAPI.
 */

import type { ExtensionAPI } from "cave";
import type { CaveKitConfig } from "../config/index.js";
import { registerArchitectCommand } from "./architect.js";
import { registerBuildCommand } from "./build.js";
import { registerConfigCommand } from "./config.js";
import { registerConvergenceCommand } from "./convergence.js";
import { registerDesignCommand } from "./design.js";
import { registerDraftCommand } from "./draft.js";
import { registerHelpCommand } from "./help.js";
import { registerInspectCommand } from "./inspect.js";
import { registerPreviewCommand } from "./preview.js";
import { registerProgressCommand } from "./progress.js";
import { registerResearchCommand } from "./research.js";

export function registerCommands(pi: ExtensionAPI, config: CaveKitConfig): void {
	registerDraftCommand(pi, config);
	registerArchitectCommand(pi, config);
	registerBuildCommand(pi, config);
	registerInspectCommand(pi, config);
	registerResearchCommand(pi, config);
	registerDesignCommand(pi, config);
	registerConfigCommand(pi, config);
	registerHelpCommand(pi, config);
	registerProgressCommand(pi, config);
	registerConvergenceCommand(pi, config);
	registerPreviewCommand(pi, config);
}
