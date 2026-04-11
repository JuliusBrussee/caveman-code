import { type Component, truncateToWidth, visibleWidth } from "@cave/tui";
import type { AgentSession } from "../../../core/agent-session.js";
import type { ReadonlyFooterDataProvider } from "../../../core/footer-data-provider.js";
import { theme } from "../theme/theme.js";

/**
 * Format token counts compactly.
 */
function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
	return `${Math.round(count / 1000000)}M`;
}

/**
 * Single-line footer: path:branch  stats  model
 */
export class FooterComponent implements Component {
	private autoCompactEnabled = true;

	constructor(
		private session: AgentSession,
		private footerData: ReadonlyFooterDataProvider,
	) {}

	setSession(session: AgentSession): void {
		this.session = session;
	}

	setAutoCompactEnabled(enabled: boolean): void {
		this.autoCompactEnabled = enabled;
	}

	invalidate(): void {
		// No-op: git branch caching handled by provider
	}

	dispose(): void {
		// Git watcher cleanup handled by provider
	}

	render(width: number): string[] {
		const state = this.session.state;

		// Cumulative usage from ALL session entries
		let totalInput = 0;
		let totalOutput = 0;
		let totalCost = 0;

		for (const entry of this.session.sessionManager.getEntries()) {
			if (entry.type === "message" && entry.message.role === "assistant") {
				totalInput += entry.message.usage.input;
				totalOutput += entry.message.usage.output;
				totalCost += entry.message.usage.cost.total;
			}
		}

		// Context usage
		const contextUsage = this.session.getContextUsage();
		const contextWindow = contextUsage?.contextWindow ?? state.model?.contextWindow ?? 0;
		const contextPercentValue = contextUsage?.percent ?? 0;
		const contextPercent = contextUsage?.percent !== null ? contextPercentValue.toFixed(0) : "?";

		// Path with ~ substitution
		let pwd = this.session.sessionManager.getCwd();
		const home = process.env.HOME || process.env.USERPROFILE;
		if (home && pwd.startsWith(home)) {
			pwd = `~${pwd.slice(home.length)}`;
		}

		// Append git branch
		const branch = this.footerData.getGitBranch();
		if (branch) {
			pwd = `${pwd}:${branch}`;
		}

		// Build left side: path + stats
		const statsParts = [];
		if (totalInput) statsParts.push(`↑${formatTokens(totalInput)}`);
		if (totalOutput) statsParts.push(`↓${formatTokens(totalOutput)}`);
		if (totalCost) statsParts.push(`$${totalCost.toFixed(2)}`);

		// Context percentage — color-coded
		let contextPercentStr: string;
		const contextDisplay = `${contextPercent}%/${formatTokens(contextWindow)}`;
		if (contextPercentValue > 90) {
			contextPercentStr = theme.fg("error", contextDisplay);
		} else if (contextPercentValue > 70) {
			contextPercentStr = theme.fg("warning", contextDisplay);
		} else {
			contextPercentStr = contextDisplay;
		}
		statsParts.push(contextPercentStr);

		const leftParts = [pwd, ...statsParts].join("  ");

		// Build right side: model + thinking
		const modelName = state.model?.id || "no-model";
		let rightSide = modelName;
		if (state.model?.reasoning) {
			const thinkingLevel = state.thinkingLevel || "off";
			rightSide = thinkingLevel === "off" ? `${modelName} · off` : `${modelName} · ${thinkingLevel}`;
		}

		// Compose single line
		const leftWidth = visibleWidth(leftParts);
		const rightWidth = visibleWidth(rightSide);
		const minPadding = 2;
		const totalNeeded = leftWidth + minPadding + rightWidth;

		let line: string;
		if (totalNeeded <= width) {
			const padding = " ".repeat(width - leftWidth - rightWidth);
			line = leftParts + padding + rightSide;
		} else {
			// Truncate right side or drop it
			const availableForRight = width - leftWidth - minPadding;
			if (availableForRight > 0) {
				const truncatedRight = truncateToWidth(rightSide, availableForRight, "");
				const truncatedRightWidth = visibleWidth(truncatedRight);
				const padding = " ".repeat(Math.max(0, width - leftWidth - truncatedRightWidth));
				line = leftParts + padding + truncatedRight;
			} else {
				line = truncateToWidth(leftParts, width, "...");
			}
		}

		// Dim the parts separately to preserve context % coloring
		const dimLeft = theme.fg("dim", leftParts);
		const remainder = line.slice(leftParts.length);
		const dimRemainder = theme.fg("dim", remainder);

		return [dimLeft + dimRemainder];
	}
}
