/**
 * turn_end hook — track iteration counts and detect plateaus.
 *
 * Monitors active build tasks across turns and fires circuit breaker
 * when a task exceeds maxIterations.
 */

import type { ExtensionAPI } from "cave";
import type { CaveKitConfig } from "../config/index.js";

export function registerConvergenceMonitor(pi: ExtensionAPI, _config: CaveKitConfig): void {
	const _iterationCounts = new Map<string, number>();
	const _lastErrors = new Map<string, string>();

	pi.on("turn_end", async (_event, _ctx) => {
		// Convergence detection placeholder for Phase 1.
		// WaveExecutor tracks per-task iterations directly; this hook is reserved
		// for future cross-session plateau detection.
	});

	pi.on("agent_end", async (_event, _ctx) => {
		// Reset per-session iteration tracking on clean agent end
		// (task transitions are tracked by WaveExecutor directly)
	});
}
