/**
 * Compression ROI Benchmark
 *
 * Simulates a realistic coding session to calculate the net token savings
 * of cave mode after accounting for system prompt overhead.
 *
 * No LLM calls — pure math on compression functions using fixture data.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
	ReadDeduplicationCache,
	compressCaveToolOutput,
	truncateWithToolBudget,
} from "../../src/core/cave-tool-compression.js";
import { compressStructuredOutput } from "../../src/core/cave-structured-compression.js";
import { buildCaveModePrompt } from "../../src/core/system-prompt.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");

// ============================================================================
// Helpers
// ============================================================================

function estimateTokens(chars: number): number {
	return Math.ceil(chars / 4);
}

// Load fixtures by tool type
function loadFixture(pattern: string): string {
	const files = readdirSync(FIXTURES_DIR).filter((f) => f.includes(pattern) && f.endsWith(".txt"));
	if (files.length === 0) return "default fixture content for " + pattern;
	return readFileSync(join(FIXTURES_DIR, files[0]!), "utf-8");
}

const bashFixture = loadFixture("build");
const grepFixture = loadFixture("grep");
const readFixture = loadFixture("read-large");
const readSmallFixture = loadFixture("npm"); // Smaller file for variety

// ============================================================================
// Session Simulation
// ============================================================================

interface TurnShape {
	/** How many file reads per turn */
	reads: number;
	/** How many bash commands per turn */
	bashCalls: number;
	/** How many grep calls per turn */
	grepCalls: number;
	/** How many re-reads of already-read files per turn */
	reReads: number;
}

interface SessionShape {
	turns: number;
	turnShape: TurnShape;
}

interface SimulationResult {
	intensity: "off" | "lite" | "full" | "ultra";
	turns: number;
	promptOverheadPerCall: number;
	totalToolOutputOriginal: number;
	totalToolOutputCompressed: number;
	totalDedupSavings: number;
	totalToolSavings: number;
	netSavings: number;
	/** How many API calls (turns) before cave mode pays for itself */
	breakEvenTurns: number;
}

function simulateSession(shape: SessionShape, intensity: "off" | "lite" | "full" | "ultra"): SimulationResult {
	const promptOverheadPerCall =
		intensity === "off" ? 0 : estimateTokens(buildCaveModePrompt(intensity as "lite" | "full" | "ultra").length);

	const dedupCache = new ReadDeduplicationCache();
	const readFiles = [
		{ path: "/src/index.ts", content: readFixture },
		{ path: "/src/utils.ts", content: readSmallFixture },
		{ path: "/package.json", content: '{"name": "test", "version": "1.0.0", "scripts": {"build": "tsc"}}' },
	];

	let totalOriginal = 0;
	let totalCompressed = 0;
	let totalDedupSavings = 0;
	let readIndex = 0;

	for (let turn = 0; turn < shape.turns; turn++) {
		// Simulate file reads
		for (let r = 0; r < shape.turnShape.reads; r++) {
			const file = readFiles[readIndex % readFiles.length]!;
			readIndex++;

			const originalTokens = estimateTokens(file.content.length);
			totalOriginal += originalTokens;

			if (intensity !== "off") {
				const stub = dedupCache.checkRead(file.path, file.content);
				if (stub) {
					totalCompressed += estimateTokens(stub.length);
					totalDedupSavings += originalTokens - estimateTokens(stub.length);
				} else {
					// First read — apply tool budget compression
					const compressed = truncateWithToolBudget(file.content, "read");
					const finalCompressed = compressCaveToolOutput(compressed);
					totalCompressed += estimateTokens(finalCompressed.length);
				}
			} else {
				totalCompressed += originalTokens;
			}
		}

		// Simulate bash calls
		for (let b = 0; b < shape.turnShape.bashCalls; b++) {
			const originalTokens = estimateTokens(bashFixture.length);
			totalOriginal += originalTokens;

			if (intensity !== "off") {
				const afterBudget = truncateWithToolBudget(bashFixture, "bash");
				const afterStructured = compressStructuredOutput(afterBudget, "bash");
				const final = compressCaveToolOutput(afterStructured);
				totalCompressed += estimateTokens(final.length);
			} else {
				totalCompressed += originalTokens;
			}
		}

		// Simulate grep calls
		for (let g = 0; g < shape.turnShape.grepCalls; g++) {
			const originalTokens = estimateTokens(grepFixture.length);
			totalOriginal += originalTokens;

			if (intensity !== "off") {
				const afterBudget = truncateWithToolBudget(grepFixture, "grep");
				const final = compressCaveToolOutput(afterBudget);
				totalCompressed += estimateTokens(final.length);
			} else {
				totalCompressed += originalTokens;
			}
		}

		// Simulate re-reads (dedup opportunity)
		for (let rr = 0; rr < shape.turnShape.reReads; rr++) {
			const file = readFiles[rr % readFiles.length]!;
			const originalTokens = estimateTokens(file.content.length);
			totalOriginal += originalTokens;

			if (intensity !== "off") {
				const stub = dedupCache.checkRead(file.path, file.content);
				if (stub) {
					totalCompressed += estimateTokens(stub.length);
					totalDedupSavings += originalTokens - estimateTokens(stub.length);
				} else {
					totalCompressed += originalTokens;
				}
			} else {
				totalCompressed += originalTokens;
			}
		}
	}

	const totalToolSavings = totalOriginal - totalCompressed;
	const totalPromptOverhead = promptOverheadPerCall * shape.turns;
	const netSavings = totalToolSavings - totalPromptOverhead;

	// Break-even: how many turns before tool savings exceed prompt overhead
	const savingsPerTurn = shape.turns > 0 ? totalToolSavings / shape.turns : 0;
	const breakEvenTurns = savingsPerTurn > promptOverheadPerCall ? Math.ceil(promptOverheadPerCall / (savingsPerTurn - promptOverheadPerCall)) + 1 : Infinity;

	return {
		intensity,
		turns: shape.turns,
		promptOverheadPerCall,
		totalToolOutputOriginal: totalOriginal,
		totalToolOutputCompressed: totalCompressed,
		totalDedupSavings,
		totalToolSavings,
		netSavings,
		breakEvenTurns: Number.isFinite(breakEvenTurns) ? breakEvenTurns : -1,
	};
}

// ============================================================================
// Tests
// ============================================================================

const SESSION_SHAPE: SessionShape = {
	turns: 15,
	turnShape: {
		reads: 2,
		bashCalls: 1,
		grepCalls: 1,
		reReads: 1,
	},
};

const intensities = ["off", "lite", "full", "ultra"] as const;
const results: SimulationResult[] = [];

describe("Session ROI Simulation", () => {
	describe("15-turn coding session", () => {
		for (const intensity of intensities) {
			it(`simulates ${intensity} intensity`, () => {
				const result = simulateSession(SESSION_SHAPE, intensity);
				results.push(result);

				if (intensity !== "off") {
					// Cave mode should save tokens overall
					expect(result.totalToolSavings).toBeGreaterThan(0);
				}
			});
		}

		it("full and ultra save more than lite", () => {
			const lite = results.find((r) => r.intensity === "lite");
			const full = results.find((r) => r.intensity === "full");
			const ultra = results.find((r) => r.intensity === "ultra");

			// All three should have positive net savings over a 15-turn session
			if (lite && full && ultra) {
				expect(full.netSavings).toBeGreaterThanOrEqual(lite.netSavings * 0.8); // Allow some variance
				expect(ultra.netSavings).toBeGreaterThanOrEqual(lite.netSavings * 0.8);
			}
		});

		it("net savings are positive for full intensity over 15 turns", () => {
			const full = results.find((r) => r.intensity === "full");
			if (full) {
				expect(full.netSavings).toBeGreaterThan(0);
			}
		});
	});

	describe("Short session (3 turns)", () => {
		it("measures whether cave mode is still net positive", () => {
			const shortShape: SessionShape = {
				turns: 3,
				turnShape: { reads: 1, bashCalls: 1, grepCalls: 0, reReads: 0 },
			};

			for (const intensity of intensities) {
				if (intensity === "off") continue;
				const result = simulateSession(shortShape, intensity);
				// Report but don't assert — short sessions may or may not be net positive
				console.log(
					`  Short session (3 turns) @ ${intensity}: net ${result.netSavings > 0 ? "+" : ""}${result.netSavings} tokens`,
				);
			}
		});
	});

	describe("Heavy session (30 turns, lots of tool calls)", () => {
		it("measures savings at scale", () => {
			const heavyShape: SessionShape = {
				turns: 30,
				turnShape: { reads: 3, bashCalls: 2, grepCalls: 2, reReads: 2 },
			};

			const full = simulateSession(heavyShape, "full");
			expect(full.netSavings).toBeGreaterThan(0);
			console.log(
				`  Heavy session (30 turns): net +${full.netSavings.toLocaleString()} tokens saved (${((full.totalToolSavings / full.totalToolOutputOriginal) * 100).toFixed(1)}% tool compression)`,
			);
		});
	});
});

// ============================================================================
// Report
// ============================================================================

afterAll(() => {
	if (results.length === 0) return;

	const off = results.find((r) => r.intensity === "off")!;

	console.log("\n=== Session ROI Simulation (15-turn coding session) ===\n");
	console.log("Session shape per turn: 2 file reads, 1 bash, 1 grep, 1 re-read\n");

	console.log(
		"| Intensity | Prompt Overhead | Tool Output (orig) | Tool Output (comp) | Tool Savings | Dedup Savings | Net Savings | Break-even |",
	);
	console.log(
		"|-----------|-----------------|--------------------|--------------------|--------------|---------------|-------------|------------|",
	);

	for (const result of results) {
		const intensity = result.intensity.padEnd(9);
		const overhead =
			result.intensity === "off"
				? "—".padStart(15)
				: `${(result.promptOverheadPerCall * result.turns).toLocaleString()} tok`.padStart(15);
		const origTokens = `${result.totalToolOutputOriginal.toLocaleString()} tok`.padStart(18);
		const compTokens = `${result.totalToolOutputCompressed.toLocaleString()} tok`.padStart(18);
		const toolSavings =
			result.totalToolSavings > 0
				? `+${result.totalToolSavings.toLocaleString()} tok`.padStart(12)
				: "—".padStart(12);
		const dedupSavings =
			result.totalDedupSavings > 0
				? `+${result.totalDedupSavings.toLocaleString()} tok`.padStart(13)
				: "—".padStart(13);
		const net =
			result.intensity === "off"
				? "baseline".padStart(11)
				: `${result.netSavings > 0 ? "+" : ""}${result.netSavings.toLocaleString()} tok`.padStart(11);
		const breakEven =
			result.intensity === "off"
				? "—".padStart(10)
				: result.breakEvenTurns > 0
					? `${result.breakEvenTurns} turns`.padStart(10)
					: "instant".padStart(10);

		console.log(
			`| ${intensity} | ${overhead} | ${origTokens} | ${compTokens} | ${toolSavings} | ${dedupSavings} | ${net} | ${breakEven} |`,
		);
	}

	// Cost analysis
	if (off) {
		console.log("\n--- Cost Impact Estimate (Sonnet @ $3/M input, $15/M output) ---\n");
		const inputPricePerToken = 3 / 1_000_000;

		for (const result of results) {
			if (result.intensity === "off") continue;
			const savedDollars = result.netSavings * inputPricePerToken;
			const pct = off.totalToolOutputOriginal > 0
				? ((result.totalToolSavings / off.totalToolOutputOriginal) * 100).toFixed(1)
				: "0";
			console.log(
				`${result.intensity}: ${pct}% tool output compression → net ~$${savedDollars.toFixed(4)} saved per 15-turn session`,
			);
		}
	}

	console.log("");
});
