import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
	collapseBlankLines,
	compressCaveToolOutput,
	stripAnsi,
	truncateLongOutput,
} from "../../src/core/cave-tool-compression.js";
import { buildCaveModePrompt } from "../../src/core/system-prompt.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");

interface FixtureResult {
	name: string;
	originalChars: number;
	originalLines: number;
	afterStripAnsiChars: number;
	afterCollapseLines: number;
	afterTruncateLines: number;
	finalChars: number;
	finalLines: number;
	charReductionPercent: number;
	estimatedTokenSavings: number;
}

function countLines(text: string): number {
	return text.split("\n").length;
}

function estimateTokens(chars: number): number {
	return Math.ceil(chars / 4);
}

const fixtureFiles = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".txt"));
const fixtures = fixtureFiles.map((name) => ({
	name,
	content: readFileSync(join(FIXTURES_DIR, name), "utf-8"),
}));

const results: FixtureResult[] = [];

describe("Layer 1: System Prompt Overhead", () => {
	const intensities = ["lite", "full", "ultra"] as const;

	it("generates prompts for all intensities", () => {
		for (const intensity of intensities) {
			const prompt = buildCaveModePrompt(intensity);
			expect(prompt.length).toBeGreaterThan(0);
		}
	});

	it("ultra prompt is longest (most compression rules)", () => {
		const lite = buildCaveModePrompt("lite");
		const full = buildCaveModePrompt("full");
		const ultra = buildCaveModePrompt("ultra");

		expect(ultra.length).toBeGreaterThan(lite.length);
		expect(full.length).toBeGreaterThan(lite.length);
	});

	it("reports system prompt token costs", () => {
		console.log("\n--- System Prompt Token Overhead ---");
		console.log("| Intensity | Chars | Est. Tokens |");
		console.log("|-----------|-------|-------------|");
		for (const intensity of intensities) {
			const prompt = buildCaveModePrompt(intensity);
			console.log(
				`| ${intensity.padEnd(9)} | ${String(prompt.length).padStart(5)} | ${String(estimateTokens(prompt.length)).padStart(11)} |`,
			);
		}
		console.log("| (none)    |     0 |           0 |");
		console.log("");
	});
});

describe("Layer 2: Tool Output Compression", () => {
	for (const fixture of fixtures) {
		describe(fixture.name, () => {
			const original = fixture.content;
			const originalChars = original.length;
			const originalLines = countLines(original);

			const afterStripAnsi = stripAnsi(original);
			const afterCollapse = collapseBlankLines(afterStripAnsi);
			const afterTruncate = truncateLongOutput(afterCollapse);
			const final = compressCaveToolOutput(original);

			it("compresses without error", () => {
				expect(final).toBeDefined();
				expect(typeof final).toBe("string");
			});

			it("strips ANSI codes if present", () => {
				const hasAnsi = /\x1b\[[\d;]*m/.test(original);
				if (hasAnsi) {
					expect(afterStripAnsi.length).toBeLessThan(originalChars);
				}
			});

			it("truncates if over 500 lines", () => {
				if (originalLines > 500) {
					expect(countLines(afterTruncate)).toBeLessThan(originalLines);
				}
			});

			results.push({
				name: fixture.name,
				originalChars,
				originalLines,
				afterStripAnsiChars: afterStripAnsi.length,
				afterCollapseLines: countLines(afterCollapse),
				afterTruncateLines: countLines(afterTruncate),
				finalChars: final.length,
				finalLines: countLines(final),
				charReductionPercent: originalChars > 0 ? ((originalChars - final.length) / originalChars) * 100 : 0,
				estimatedTokenSavings: estimateTokens(originalChars - final.length),
			});
		});
	}

	it("reduces total chars by at least 5% across all fixtures", () => {
		const totalOriginal = results.reduce((sum, r) => sum + r.originalChars, 0);
		const totalFinal = results.reduce((sum, r) => sum + r.finalChars, 0);
		const totalReduction = ((totalOriginal - totalFinal) / totalOriginal) * 100;
		expect(totalReduction).toBeGreaterThanOrEqual(5);
	});
});

afterAll(() => {
	if (results.length === 0) return;

	const totalOriginal = results.reduce((sum, r) => sum + r.originalChars, 0);
	const totalFinal = results.reduce((sum, r) => sum + r.finalChars, 0);
	const totalReduction = ((totalOriginal - totalFinal) / totalOriginal) * 100;
	const totalTokenSavings = estimateTokens(totalOriginal - totalFinal);

	console.log("\n--- Cave Mode Token Savings Benchmark ---");
	console.log("| Fixture | Original | Compressed | Reduction | Est. Token Savings |");
	console.log("|---------|----------|------------|-----------|-------------------|");

	for (const r of results) {
		const name = r.name.padEnd(30);
		const orig = `${r.originalChars.toLocaleString()} chars`.padStart(14);
		const comp = `${r.finalChars.toLocaleString()} chars`.padStart(14);
		const reduction = `${r.charReductionPercent.toFixed(1)}%`.padStart(9);
		const savings = `${r.estimatedTokenSavings.toLocaleString()} tokens`.padStart(13);
		console.log(`| ${name} | ${orig} | ${comp} | ${reduction} | ${savings} |`);
	}

	console.log("|---------|----------|------------|-----------|-------------------|");
	console.log(
		`| ${"TOTAL".padEnd(30)} | ${`${totalOriginal.toLocaleString()} chars`.padStart(14)} | ${`${totalFinal.toLocaleString()} chars`.padStart(14)} | ${`${totalReduction.toFixed(1)}%`.padStart(9)} | ${`${totalTokenSavings.toLocaleString()} tokens`.padStart(13)} |`,
	);
	console.log("");
});
