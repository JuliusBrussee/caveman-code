/**
 * Autopilot HUD — surfaces cost / stall / runaway counters when long-running
 * agent loops are configured to run unattended.
 *
 * Inert until external state is pushed via `setState`. Mounting cost is one
 * Container + one Text child, so leaving it always-on is fine when the
 * autopilot setting is off — the render output is empty.
 *
 * Wires into the same agent-event subscription as StatusRule but renders a
 * second line below the rule when `autopilot.enabled` is true.
 */

import { Container, Text, truncateToWidth } from "@cave/tui";
import { theme } from "../theme/theme.js";

export interface AutopilotHudState {
	/** True when autopilot is currently driving the agent loop. */
	enabled: boolean;
	/** Cumulative session cost in USD. */
	costUsd?: number;
	/** Hard budget ceiling. When `costUsd >= budgetUsd * 0.9` the line turns yellow; >= 1.0 turns red. */
	budgetUsd?: number;
	/** Wall-clock seconds since the last `message_update` from the agent. */
	stallSeconds?: number;
	/** Turns elapsed since the last user input. Yellow above 5, red above 15. */
	turnsSinceUserInput?: number;
}

export class AutopilotHudComponent extends Container {
	private state: AutopilotHudState = { enabled: false };
	private label: Text;

	constructor() {
		super();
		this.label = new Text("", 1, 0);
		this.addChild(this.label);
	}

	setState(patch: Partial<AutopilotHudState>): void {
		this.state = { ...this.state, ...patch };
		this.refresh();
	}

	render(width: number): string[] {
		this.refresh(width);
		return super.render(width);
	}

	private refresh(width?: number): void {
		if (!this.state.enabled) {
			this.label.setText("");
			return;
		}
		const cols = width ?? process.stdout.columns ?? 80;
		const segments: string[] = [theme.fg("accent", "✈ autopilot")];

		if (this.state.costUsd !== undefined) {
			segments.push(this.costSegment());
		}
		if (this.state.stallSeconds !== undefined && this.state.stallSeconds > 5) {
			segments.push(theme.fg("warning", `⏸ ${Math.round(this.state.stallSeconds)}s stall`));
		}
		if (this.state.turnsSinceUserInput !== undefined && this.state.turnsSinceUserInput > 5) {
			const colorFn =
				this.state.turnsSinceUserInput > 15 ? theme.fg.bind(theme, "error") : theme.fg.bind(theme, "warning");
			segments.push(colorFn(`${this.state.turnsSinceUserInput} turns since input`));
		}

		const sep = ` ${theme.fg("border", "│")} `;
		const line = segments.join(sep);
		this.label.setText(truncateToWidth(line, Math.max(10, cols - 2), "…"));
	}

	private costSegment(): string {
		const cost = this.state.costUsd ?? 0;
		const budget = this.state.budgetUsd;
		const text = budget !== undefined ? `$${cost.toFixed(4)} / $${budget.toFixed(2)}` : `$${cost.toFixed(4)}`;
		if (budget === undefined) return theme.fg("dim", text);
		const ratio = cost / budget;
		if (ratio >= 1.0) return theme.fg("error", text);
		if (ratio >= 0.9) return theme.fg("warning", text);
		return theme.fg("dim", text);
	}
}
