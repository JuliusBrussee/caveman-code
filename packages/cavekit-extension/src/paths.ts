import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Returns the canonical build site directory for a given project root.
 * The architect command writes to context/plans/; falls back to context/sites/
 * for legacy compatibility.
 */
export function getBuildSiteDir(cwd: string): string {
	const primary = path.join(cwd, "context", "plans");
	if (fs.existsSync(primary)) return primary;

	const legacy = path.join(cwd, "context", "sites");
	if (fs.existsSync(legacy)) return legacy;

	return primary;
}
