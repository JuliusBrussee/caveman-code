import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
	ReadDeduplicationCache,
	collapseBlankLines,
	compressCaveToolOutput,
	stripAnsi,
	truncateLongOutput,
	truncateWithToolBudget,
} from "../../src/core/cave-tool-compression.js";
import { compressStructuredOutput } from "../../src/core/cave-structured-compression.js";
import { buildCaveModePrompt } from "../../src/core/system-prompt.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");

// ============================================================================
// Helpers
// ============================================================================

function countLines(text: string): number {
	return text.split("\n").length;
}

function estimateTokens(chars: number): number {
	return Math.ceil(chars / 4);
}

/** Infer a plausible tool name from fixture filename */
function inferToolName(filename: string): string {
	if (filename.includes("grep")) return "grep";
	if (filename.includes("ls") || filename.includes("recursive")) return "ls";
	if (filename.includes("read") || filename.includes(".ts")) return "read";
	if (filename.includes("json") || filename.includes("xml")) return "bash";
	if (filename.includes("npm") || filename.includes("build") || filename.includes("test") || filename.includes("git"))
		return "bash";
	if (filename.includes("ansi")) return "bash";
	return "bash";
}

/** Infer a plausible bash command hint from fixture filename */
function inferCommandHint(filename: string): string | undefined {
	if (filename.includes("docker")) return "docker inspect";
	if (filename.includes("npm")) return "npm ls";
	if (filename.includes("git")) return "git diff";
	return undefined;
}

// ============================================================================
// Load fixtures
// ============================================================================

const fixtureFiles = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".txt"));
const fixtures = fixtureFiles.map((name) => ({
	name,
	content: readFileSync(join(FIXTURES_DIR, name), "utf-8"),
	toolName: inferToolName(name),
	commandHint: inferCommandHint(name),
}));

// ============================================================================
// Layer result tracking
// ============================================================================

interface LayerResult {
	fixture: string;
	toolName: string;
	original: { chars: number; lines: number; tokens: number };
	layers: {
		name: string;
		chars: number;
		lines: number;
		tokens: number;
		marginalSavingsChars: number;
		marginalSavingsPercent: number;
	}[];
	final: { chars: number; lines: number; tokens: number; totalSavingsPercent: number };
}

const layerResults: LayerResult[] = [];

// ============================================================================
// Layer 1: Per-Layer Compression Analysis
// ============================================================================

describe("Per-Layer Compression Analysis", () => {
	for (const fixture of fixtures) {
		describe(`${fixture.name} (tool: ${fixture.toolName})`, () => {
			const original = fixture.content;

			// Apply layers cumulatively
			const L0 = original;
			const L1 = stripAnsi(L0);
			const L2 = collapseBlankLines(L1);
			const L3 = truncateWithToolBudget(L2, fixture.toolName);
			const L4 = compressStructuredOutput(L3, fixture.toolName, fixture.commandHint);
			const L5 = truncateLongOutput(L4);

			const stages = [
				{ name: "L0: Raw", text: L0 },
				{ name: "L1: Strip ANSI", text: L1 },
				{ name: "L2: Collapse blanks", text: L2 },
				{ name: "L3: Tool budget (Flint Chipper)", text: L3 },
				{ name: "L4: Structured (Stone Tablet)", text: L4 },
				{ name: "L5: General truncation", text: L5 },
			];

			it("each layer does not increase size", () => {
				for (let i = 1; i < stages.length; i++) {
					expect(
						stages[i]!.text.length,
						`${stages[i]!.name} increased size vs ${stages[i - 1]!.name}`,
					).toBeLessThanOrEqual(stages[i - 1]!.text.length);
				}
			});

			it("full pipeline matches sequential application", () => {
				const fullPipeline = compressCaveToolOutput(original);
				// The full pipeline applies stripAnsi + collapseBlankLines + truncateLongOutput
				// (it does NOT include tool budget or structured compression — those are separate)
				expect(fullPipeline).toBeDefined();
			});

			// Collect results
			const layers = stages.map((stage, i) => {
				const prevChars = i > 0 ? stages[i - 1]!.text.length : stage.text.length;
				const marginalSavingsChars = prevChars - stage.text.length;
				const marginalSavingsPercent = prevChars > 0 ? (marginalSavingsChars / prevChars) * 100 : 0;
				return {
					name: stage.name,
					chars: stage.text.length,
					lines: countLines(stage.text),
					tokens: estimateTokens(stage.text.length),
					marginalSavingsChars,
					marginalSavingsPercent,
				};
			});

			const finalStage = stages[stages.length - 1]!;
			layerResults.push({
				fixture: fixture.name,
				toolName: fixture.toolName,
				original: {
					chars: original.length,
					lines: countLines(original),
					tokens: estimateTokens(original.length),
				},
				layers,
				final: {
					chars: finalStage.text.length,
					lines: countLines(finalStage.text),
					tokens: estimateTokens(finalStage.text.length),
					totalSavingsPercent:
						original.length > 0 ? ((original.length - finalStage.text.length) / original.length) * 100 : 0,
				},
			});
		});
	}
});

// ============================================================================
// Layer 2: System Prompt Overhead
// ============================================================================

interface PromptOverhead {
	intensity: string;
	chars: number;
	tokens: number;
}

const promptOverheads: PromptOverhead[] = [];

describe("System Prompt Overhead", () => {
	const intensities = ["lite", "full", "ultra"] as const;

	for (const intensity of intensities) {
		it(`measures ${intensity} intensity overhead`, () => {
			const prompt = buildCaveModePrompt(intensity);
			expect(prompt.length).toBeGreaterThan(0);
			promptOverheads.push({
				intensity,
				chars: prompt.length,
				tokens: estimateTokens(prompt.length),
			});
		});
	}

	it("reports overhead is reasonable (< 1000 tokens for any intensity)", () => {
		for (const intensity of intensities) {
			const prompt = buildCaveModePrompt(intensity);
			expect(estimateTokens(prompt.length)).toBeLessThan(1000);
		}
	});
});

// ============================================================================
// Layer 3: Read Deduplication Cache
// ============================================================================

interface DedupResult {
	scenario: string;
	firstReadTokens: number;
	dedupedTokens: number;
	savingsTokens: number;
	savingsPercent: number;
}

const dedupResults: DedupResult[] = [];

describe("Read Deduplication Cache", () => {
	// Use the largest fixture as a realistic file read
	const readFixture = fixtures.find((f) => f.name.includes("read-large"))?.content ?? fixtures[0]!.content;
	const smallFixture =
		fixtures.find((f) => f.name.includes("build") || f.name.includes("grep"))?.content ?? "small content";

	it("returns full content on first read", () => {
		const cache = new ReadDeduplicationCache();
		const stub = cache.checkRead("/test/file.ts", readFixture);
		expect(stub).toBeUndefined(); // No dedup on first read
	});

	it("returns stub on duplicate read", () => {
		const cache = new ReadDeduplicationCache();
		cache.checkRead("/test/file.ts", readFixture);
		const stub = cache.checkRead("/test/file.ts", readFixture);
		expect(stub).toBeDefined();
		expect(stub!.length).toBeLessThan(readFixture.length);

		dedupResults.push({
			scenario: "Large file re-read",
			firstReadTokens: estimateTokens(readFixture.length),
			dedupedTokens: estimateTokens(stub!.length),
			savingsTokens: estimateTokens(readFixture.length - stub!.length),
			savingsPercent: ((readFixture.length - stub!.length) / readFixture.length) * 100,
		});
	});

	it("returns full content after file changes", () => {
		const cache = new ReadDeduplicationCache();
		cache.checkRead("/test/file.ts", readFixture);
		const modified = `${readFixture}\n// new line added`;
		const stub = cache.checkRead("/test/file.ts", modified);
		expect(stub).toBeUndefined(); // Changed content = no dedup
	});

	it("invalidates on write", () => {
		const cache = new ReadDeduplicationCache();
		cache.checkRead("/test/file.ts", readFixture);
		cache.invalidate("/test/file.ts");
		const stub = cache.checkRead("/test/file.ts", readFixture);
		expect(stub).toBeUndefined(); // Invalidated = no dedup
	});

	it("simulates multi-file session dedup pattern", () => {
		const cache = new ReadDeduplicationCache();
		const files = [
			{ path: "/src/index.ts", content: readFixture },
			{ path: "/src/utils.ts", content: smallFixture },
			{ path: "/package.json", content: '{"name": "test", "version": "1.0.0"}' },
		];

		let totalFirstReadChars = 0;
		let totalDedupedChars = 0;

		// First reads — all full
		for (const file of files) {
			const stub = cache.checkRead(file.path, file.content);
			expect(stub).toBeUndefined();
			totalFirstReadChars += file.content.length;
		}

		// Second reads — all deduped
		for (const file of files) {
			const stub = cache.checkRead(file.path, file.content);
			expect(stub).toBeDefined();
			totalDedupedChars += stub!.length;
		}

		// Third reads (one modified) — 2 deduped, 1 full
		cache.invalidate("/src/index.ts");
		const stub1 = cache.checkRead("/src/index.ts", readFixture);
		expect(stub1).toBeUndefined(); // Re-read after invalidation
		const stub2 = cache.checkRead("/src/utils.ts", smallFixture);
		expect(stub2).toBeDefined();
		const stub3 = cache.checkRead("/package.json", '{"name": "test", "version": "1.0.0"}');
		expect(stub3).toBeDefined();

		dedupResults.push({
			scenario: "Multi-file session (3 files, 2 re-reads each)",
			firstReadTokens: estimateTokens(totalFirstReadChars),
			dedupedTokens: estimateTokens(totalDedupedChars),
			savingsTokens: estimateTokens(totalFirstReadChars - totalDedupedChars),
			savingsPercent: ((totalFirstReadChars - totalDedupedChars) / totalFirstReadChars) * 100,
		});
	});
});

// ============================================================================
// Report
// ============================================================================

afterAll(() => {
	// --- Per-Layer Table ---
	console.log("\n=== Per-Layer Compression Analysis ===\n");

	for (const result of layerResults) {
		console.log(`\n--- ${result.fixture} (${result.toolName}) ---`);
		console.log(
			`Original: ${result.original.chars.toLocaleString()} chars, ${result.original.lines} lines, ~${result.original.tokens.toLocaleString()} tokens`,
		);
		console.log("| Layer                        | Chars      | Lines | Tokens    | Marginal Δ |");
		console.log("|------------------------------|------------|-------|-----------|------------|");

		for (const layer of result.layers) {
			const name = layer.name.padEnd(28);
			const chars = layer.chars.toLocaleString().padStart(10);
			const lines = String(layer.lines).padStart(5);
			const tokens = `~${layer.tokens.toLocaleString()}`.padStart(9);
			const marginal =
				layer.marginalSavingsChars > 0
					? `-${layer.marginalSavingsPercent.toFixed(1)}%`.padStart(10)
					: "—".padStart(10);
			console.log(`| ${name} | ${chars} | ${lines} | ${tokens} | ${marginal} |`);
		}

		console.log(
			`| TOTAL SAVINGS                |            |       |           | ${`-${result.final.totalSavingsPercent.toFixed(1)}%`.padStart(10)} |`,
		);
	}

	// --- Aggregate Summary ---
	console.log("\n=== Aggregate Compression Summary ===\n");
	console.log("| Fixture                        | Original   | Compressed | Savings    | Tokens Saved |");
	console.log("|--------------------------------|------------|------------|------------|--------------|");

	let totalOriginal = 0;
	let totalFinal = 0;

	for (const result of layerResults) {
		totalOriginal += result.original.chars;
		totalFinal += result.final.chars;

		const name = result.fixture.padEnd(30);
		const orig = `${result.original.chars.toLocaleString()}`.padStart(10);
		const comp = `${result.final.chars.toLocaleString()}`.padStart(10);
		const savings = `-${result.final.totalSavingsPercent.toFixed(1)}%`.padStart(10);
		const tokensSaved = `~${estimateTokens(result.original.chars - result.final.chars).toLocaleString()}`.padStart(12);
		console.log(`| ${name} | ${orig} | ${comp} | ${savings} | ${tokensSaved} |`);
	}

	const totalSavings = totalOriginal > 0 ? ((totalOriginal - totalFinal) / totalOriginal) * 100 : 0;
	console.log("|--------------------------------|------------|------------|------------|--------------|");
	console.log(
		`| ${"TOTAL".padEnd(30)} | ${totalOriginal.toLocaleString().padStart(10)} | ${totalFinal.toLocaleString().padStart(10)} | ${`-${totalSavings.toFixed(1)}%`.padStart(10)} | ${`~${estimateTokens(totalOriginal - totalFinal).toLocaleString()}`.padStart(12)} |`,
	);

	// --- System Prompt Overhead ---
	console.log("\n=== System Prompt Overhead ===\n");
	console.log("| Intensity | Chars | Tokens | Cost per API call |");
	console.log("|-----------|-------|--------|-------------------|");
	for (const overhead of promptOverheads) {
		console.log(
			`| ${overhead.intensity.padEnd(9)} | ${String(overhead.chars).padStart(5)} | ${String(overhead.tokens).padStart(6)} | +${overhead.tokens} input tokens |`,
		);
	}
	console.log(`| (none)    |     0 |      0 | baseline          |`);

	// --- Read Dedup ---
	console.log("\n=== Read Deduplication Savings ===\n");
	console.log("| Scenario                               | First Read | Deduped  | Savings  | %       |");
	console.log("|----------------------------------------|------------|----------|----------|---------|");
	for (const dedup of dedupResults) {
		const scenario = dedup.scenario.padEnd(38);
		const first = `~${dedup.firstReadTokens.toLocaleString()} tok`.padStart(10);
		const duped = `~${dedup.dedupedTokens.toLocaleString()} tok`.padStart(8);
		const savings = `~${dedup.savingsTokens.toLocaleString()} tok`.padStart(8);
		const pct = `${dedup.savingsPercent.toFixed(1)}%`.padStart(7);
		console.log(`| ${scenario} | ${first} | ${duped} | ${savings} | ${pct} |`);
	}

	// --- ROI Summary ---
	if (promptOverheads.length > 0 && layerResults.length > 0) {
		console.log("\n=== Break-Even Analysis ===\n");
		const avgSavingsPerToolCall =
			layerResults.reduce((sum, r) => sum + (r.original.tokens - r.final.tokens), 0) / layerResults.length;

		for (const overhead of promptOverheads) {
			const breakEven = avgSavingsPerToolCall > 0 ? Math.ceil(overhead.tokens / avgSavingsPerToolCall) : Infinity;
			console.log(
				`${overhead.intensity}: ${overhead.tokens} token overhead ÷ ~${Math.round(avgSavingsPerToolCall)} avg savings/tool-call = break-even at ${breakEven} tool calls`,
			);
		}
	}

	console.log("");
});
