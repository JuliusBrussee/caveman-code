/**
 * Ralph Loop module — adversarial peer review integration for CaveKit.
 *
 * Ralph is the resident rival in the cave: an adversarial code reviewer
 * powered by Codex that challenges your code through iterative review cycles.
 */

export {
	type CodexReviewOptions,
	type CodexReviewResult,
	invokeCodexReview,
	isCodexAvailable,
} from "./codex.js";

export {
	formatFindings,
	formatSummaryLine,
	parseFindings,
	type RalphFinding,
	summarizeFindings,
	writeFindingsToFile,
} from "./findings.js";

export {
	convergenceLabel,
	createInitialState,
	type FindingsSummary,
	isCeiling,
	isClean,
	isConverging,
	persistState,
	type RalphState,
	restoreState,
} from "./state.js";
