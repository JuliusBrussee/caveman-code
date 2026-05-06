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
	private ambiguousModelIds: Set<string> | null = null;

	constructor(
		private session: AgentSession,
		private footerData: ReadonlyFooterDataProvider,
	) {}

	setSession(session: AgentSession): void {
		this.session = session;
		this.ambiguousModelIds = null;
	}

	setAutoCompactEnabled(enabled: boolean): void {
		this.autoCompactEnabled = enabled;
	}

	invalidate(): void {
		// Reset the ambiguous-id cache on invalidate so a registry refresh
		// (e.g. after editing models.json) is reflected in the footer.
		this.ambiguousModelIds = null;
	}

	private getAmbiguousModelIds(): Set<string> {
		if (this.ambiguousModelIds) return this.ambiguousModelIds;
		const counts = new Map<string, number>();
		try {
			for (const model of this.session.modelRegistry.getAll()) {
				counts.set(model.id, (counts.get(model.id) ?? 0) + 1);
			}
		} catch {
			// Registry might not be ready; treat as no ambiguity.
		}
		const set = new Set<string>();
		for (const [id, n] of counts) if (n > 1) set.add(id);
		this.ambiguousModelIds = set;
		return set;
	}

	dispose(): void {
		// Git watcher cleanup handled by provider
	}

	render(width: number): string[] {
		const state = this.session.state;

		// Context usage
		const contextUsage = this.session.getContextUsage();
		const contextWindow = contextUsage?.contextWindow ?? state.model?.contextWindow ?? 0;
		const contextPercentValue = contextUsage?.percent ?? 0;
		const contextPercent = contextUsage?.percent !== null ? contextPercentValue.toFixed(0) : "?";
		const contextDisplay = `${contextPercent}%/${formatTokens(contextWindow)}`;

		// Path with ~ substitution + git branch
		let pwd = this.session.sessionManager.getCwd();
		const home = process.env.HOME || process.env.USERPROFILE;
		if (home && pwd.startsWith(home)) {
			pwd = `~${pwd.slice(home.length)}`;
		}
		const branch = this.footerData.getGitBranch();
		if (branch) {
			pwd = `${pwd}:${branch}`;
		}

		const leftPrefixRaw = `${pwd}  `;
		const leftRaw = leftPrefixRaw + contextDisplay;

		// Right side: model + thinking. Prefix with provider when the bare model id
		// is ambiguous across providers (e.g. `gpt-4o` lives on OpenAI, OpenRouter,
		// and Vercel Gateway), so users can tell at a glance which one is active.
		let modelName: string;
		if (state.model) {
			const ambiguous = this.getAmbiguousModelIds();
			modelName = ambiguous.has(state.model.id) ? `${state.model.provider}/${state.model.id}` : state.model.id;
		} else {
			modelName = "no-model";
		}
		let rightSide = modelName;
		if (state.model?.reasoning) {
			const thinkingLevel = state.thinkingLevel || "off";
			rightSide = thinkingLevel === "off" ? `${modelName} · off` : `${modelName} · ${thinkingLevel}`;
		}

		const leftWidth = visibleWidth(leftRaw);
		const rightWidth = visibleWidth(rightSide);
		const minPadding = 2;

		const styleContext = (text: string): string => {
			if (contextPercentValue > 90) return theme.fg("error", text);
			if (contextPercentValue > 70) return theme.fg("warning", text);
			return theme.fg("dim", text);
		};

		if (leftWidth + minPadding + rightWidth <= width) {
			const padding = " ".repeat(width - leftWidth - rightWidth);
			const dimPrefix = leftPrefixRaw.length > 0 ? theme.fg("dim", leftPrefixRaw) : "";
			const ctxStyled = styleContext(contextDisplay);
			const tail = theme.fg("dim", padding + rightSide);
			return [dimPrefix + ctxStyled + tail];
		}

		const availableForRight = width - leftWidth - minPadding;
		if (availableForRight > 0) {
			const truncatedRight = truncateToWidth(rightSide, availableForRight, "");
			const truncatedRightWidth = visibleWidth(truncatedRight);
			const padding = " ".repeat(Math.max(0, width - leftWidth - truncatedRightWidth));
			const dimPrefix = leftPrefixRaw.length > 0 ? theme.fg("dim", leftPrefixRaw) : "";
			const ctxStyled = styleContext(contextDisplay);
			const tail = theme.fg("dim", padding + truncatedRight);
			return [dimPrefix + ctxStyled + tail];
		}

		// Left alone exceeds budget — truncate the raw plain-text and dim it.
		const truncated = truncateToWidth(leftRaw, width, "...");
		return [theme.fg("dim", truncated)];
	}
}
