/**
 * Session Replay Benchmark (Tier 2)
 *
 * Parses real .jsonl session files and computes what-if compression savings.
 * Skips gracefully when no session files exist.
 *
 * Run: npx vitest run test/benchmarks/session-replay.bench.ts
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, it } from "vitest";
import {
	type WhatIfReport,
	calculateWhatIfSavings,
	discoverSessionFiles,
	loadSession,
} from "./session-replay-utils.js";

// ============================================================================
// Session discovery
// ============================================================================

// Try known session directories
const SESSIONS_BASE = join(homedir(), ".cave", "agent", "sessions");
const ALT_SESSIONS_BASE = join(homedir(), ".pi", "agent", "sessions");

const sessionsBase = existsSync(SESSIONS_BASE) ? SESSIONS_BASE : existsSync(ALT_SESSIONS_BASE) ? ALT_SESSIONS_BASE : null;

const sessionFiles = sessionsBase ? discoverSessionFiles(sessionsBase, 50) : [];
const hasSession = sessionFiles.length > 0;

// ============================================================================
// Results
// ============================================================================

const reports: WhatIfReport[] = [];

// ============================================================================
// Tests
// ============================================================================

describe.skipIf(!hasSession)("Session Replay Analysis", () => {
	it("loads and analyzes sessions", () => {
		for (const filePath of sessionFiles) {
			const session = loadSession(filePath);
			if (!session) continue;

			// Skip sessions with fewer than 3 tool calls
			if (session.toolResults.length < 3) continue;

			const report = calculateWhatIfSavings(session);
			reports.push(report);
		}
	});

	it("reports findings", () => {
		// This test exists to ensure the afterAll report runs with data
		if (reports.length === 0) return;
		// At least some sessions should have compressible tool output
		const withSavings = reports.filter((r) => r.compression.savingsPercent > 0);
		console.log(`  ${reports.length} sessions analyzed, ${withSavings.length} with compression savings`);
	});
});

describe.skipIf(hasSession)("Session Replay (no sessions found)", () => {
	it("skipped — no session files at ~/.cave/agent/sessions/", () => {
		console.log("  No session files found. Run some cave sessions first, then re-run this benchmark.");
	});
});

// ============================================================================
// Report
// ============================================================================

afterAll(() => {
	if (reports.length === 0) return;

	console.log(`\n=== Session Replay Analysis (${reports.length} sessions) ===\n`);

	// --- Per-session summary ---
	console.log("| Session ID (short) | Tool Calls | Orig Tokens | Compressed | Savings % | Dedup Hits | Net (full) |");
	console.log("|--------------------|------------|-------------|------------|-----------|------------|------------|");

	let totalOrigTokens = 0;
	let totalCompTokens = 0;
	let totalDedupSavings = 0;
	let totalNetFull = 0;

	for (const report of reports) {
		const shortId = report.session.id.slice(0, 8);
		const toolCalls = String(report.session.toolResults.length).padStart(10);
		const origTokens = report.compression.originalTotalTokens.toLocaleString().padStart(11);
		const compTokens = report.compression.compressedTotalTokens.toLocaleString().padStart(10);
		const savingsPct = `${report.compression.savingsPercent.toFixed(1)}%`.padStart(9);
		const dedupHits = String(report.dedup.dedupHits).padStart(10);
		const netFull = report.netSavings.full !== undefined
			? `${report.netSavings.full > 0 ? "+" : ""}${report.netSavings.full.toLocaleString()}`.padStart(10)
			: "—".padStart(10);

		console.log(`| ${shortId.padEnd(18)} | ${toolCalls} | ${origTokens} | ${compTokens} | ${savingsPct} | ${dedupHits} | ${netFull} |`);

		totalOrigTokens += report.compression.originalTotalTokens;
		totalCompTokens += report.compression.compressedTotalTokens;
		totalDedupSavings += report.dedup.savingsTokens;
		totalNetFull += (report.netSavings.full ?? 0);
	}

	const totalSavingsPct = totalOrigTokens > 0 ? ((totalOrigTokens - totalCompTokens) / totalOrigTokens) * 100 : 0;

	console.log("|--------------------|------------|-------------|------------|-----------|------------|------------|");
	console.log(
		`| ${"TOTAL".padEnd(18)} | ${String(reports.reduce((s, r) => s + r.session.toolResults.length, 0)).padStart(10)} | ${totalOrigTokens.toLocaleString().padStart(11)} | ${totalCompTokens.toLocaleString().padStart(10)} | ${`${totalSavingsPct.toFixed(1)}%`.padStart(9)} | ${String(reports.reduce((s, r) => s + r.dedup.dedupHits, 0)).padStart(10)} | ${`${totalNetFull > 0 ? "+" : ""}${totalNetFull.toLocaleString()}`.padStart(10)} |`,
	);

	// --- Per-tool breakdown ---
	console.log("\n--- Per-Tool Compression Breakdown ---\n");

	const toolAgg: Record<string, { original: number; compressed: number; savings: number; count: number }> = {};
	for (const report of reports) {
		for (const [tool, data] of Object.entries(report.compression.perTool)) {
			if (!toolAgg[tool]) {
				toolAgg[tool] = { original: 0, compressed: 0, savings: 0, count: 0 };
			}
			toolAgg[tool]!.original += data.original;
			toolAgg[tool]!.compressed += data.compressed;
			toolAgg[tool]!.savings += data.savings;
			toolAgg[tool]!.count += data.count;
		}
	}

	console.log("| Tool    | Calls | Orig Chars    | Compressed    | Savings % |");
	console.log("|---------|-------|---------------|---------------|-----------|");

	const sortedTools = Object.entries(toolAgg).sort((a, b) => b[1].savings - a[1].savings);
	for (const [tool, data] of sortedTools) {
		const pct = data.original > 0 ? ((data.savings / data.original) * 100).toFixed(1) : "0.0";
		console.log(
			`| ${tool.padEnd(7)} | ${String(data.count).padStart(5)} | ${data.original.toLocaleString().padStart(13)} | ${data.compressed.toLocaleString().padStart(13)} | ${`${pct}%`.padStart(9)} |`,
		);
	}

	// --- Dedup summary ---
	const totalReads = reports.reduce((s, r) => s + r.dedup.totalReads, 0);
	const totalDedupHits = reports.reduce((s, r) => s + r.dedup.dedupHits, 0);
	console.log(
		`\nRead deduplication: ${totalDedupHits} dedup hits out of ${totalReads} total reads (${totalReads > 0 ? ((totalDedupHits / totalReads) * 100).toFixed(1) : 0}% hit rate)`,
	);
	console.log(`Dedup token savings: ~${totalDedupSavings.toLocaleString()} tokens`);

	// --- Net savings per intensity ---
	console.log("\n--- Net Savings by Intensity (tool savings + dedup - prompt overhead) ---\n");

	const intensities = ["lite", "full", "ultra"] as const;
	for (const intensity of intensities) {
		const net = reports.reduce((s, r) => s + (r.netSavings[intensity] ?? 0), 0);
		const sign = net > 0 ? "+" : "";
		console.log(`${intensity}: ${sign}${net.toLocaleString()} tokens net across all sessions`);
	}

	// --- Actual API usage from sessions ---
	const totalActualInput = reports.reduce(
		(s, r) => s + r.session.assistantUsages.reduce((us, u) => us + u.usage.input, 0),
		0,
	);
	const totalActualOutput = reports.reduce(
		(s, r) => s + r.session.assistantUsages.reduce((us, u) => us + u.usage.output, 0),
		0,
	);
	const totalActualCacheRead = reports.reduce(
		(s, r) => s + r.session.assistantUsages.reduce((us, u) => us + u.usage.cacheRead, 0),
		0,
	);

	if (totalActualInput > 0) {
		console.log("\n--- Actual API Token Usage (from session data) ---\n");
		console.log(`Total input tokens:      ${totalActualInput.toLocaleString()}`);
		console.log(`Total output tokens:     ${totalActualOutput.toLocaleString()}`);
		console.log(`Total cache read tokens: ${totalActualCacheRead.toLocaleString()}`);
		console.log(
			`Compression savings as % of actual input: ~${((totalOrigTokens - totalCompTokens) / Math.max(totalActualInput, 1) * 100).toFixed(1)}%`,
		);
	}

	console.log("");
});
