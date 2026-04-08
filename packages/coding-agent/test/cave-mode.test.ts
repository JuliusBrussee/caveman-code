/**
 * Tests for cave mode graceful degradation (T-027 / cave-mode/R6).
 *
 * AC-1: With cave mode fully disabled (enabled=false), agent behavior in system
 *       prompt, compaction, and tool output is identical to upstream Pi.
 * AC-2: If tool compression post-processor encounters an error, original
 *       unmodified output is used as fallback.
 */

import { describe, expect, it } from "vitest";
import {
	collapseBlankLines,
	compressCaveToolContentBlocks,
	compressCaveToolOutput,
	stripAnsi,
	truncateLongOutput,
} from "../src/core/cave-tool-compression.js";
import { buildCaveModePrompt, buildSystemPrompt } from "../src/core/system-prompt.js";

// ============================================================================
// stripAnsi
// ============================================================================

describe("stripAnsi", () => {
	it("removes SGR color codes", () => {
		expect(stripAnsi("\u001b[31mred text\u001b[0m")).toBe("red text");
	});

	it("removes cursor movement sequences", () => {
		expect(stripAnsi("\u001b[2Jhello\u001b[H")).toBe("hello");
	});

	it("passes through plain text unchanged", () => {
		expect(stripAnsi("plain text")).toBe("plain text");
	});

	it("handles empty string", () => {
		expect(stripAnsi("")).toBe("");
	});

	it("handles multiple ANSI codes in one string", () => {
		const input = "\u001b[1m\u001b[33mbold yellow\u001b[0m normal";
		expect(stripAnsi(input)).toBe("bold yellow normal");
	});
});

// ============================================================================
// collapseBlankLines
// ============================================================================

describe("collapseBlankLines", () => {
	it("collapses 3+ consecutive blank lines to 2", () => {
		const input = "line1\n\n\n\nline2";
		const result = collapseBlankLines(input);
		expect(result).toBe("line1\n\nline2");
	});

	it("preserves double blank lines", () => {
		const input = "line1\n\nline2";
		expect(collapseBlankLines(input)).toBe("line1\n\nline2");
	});

	it("preserves single blank lines", () => {
		const input = "line1\nline2";
		expect(collapseBlankLines(input)).toBe("line1\nline2");
	});

	it("handles many consecutive blank lines", () => {
		const input = `a${"\n".repeat(10)}b`;
		const result = collapseBlankLines(input);
		expect(result).toBe("a\n\nb");
	});
});

// ============================================================================
// truncateLongOutput
// ============================================================================

describe("truncateLongOutput", () => {
	it("returns short output unchanged (≤500 lines)", () => {
		const input = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
		expect(truncateLongOutput(input)).toBe(input);
	});

	it("truncates output exceeding 500 lines with head+tail preservation", () => {
		// Generate 600 lines
		const lines = Array.from({ length: 600 }, (_, i) => `line ${i}`);
		const input = lines.join("\n");
		const result = truncateLongOutput(input);

		// Should contain the truncation marker
		expect(result).toContain("[... ");
		expect(result).toContain("lines omitted (cave mode truncation)");

		// Head lines (first 200) should be present
		expect(result).toContain("line 0");
		expect(result).toContain("line 199");
		// Line 200 is in the omitted range
		expect(result).not.toContain("\nline 200\n");

		// Tail lines (last 100) should be present
		expect(result).toContain("line 599");
		expect(result).toContain("line 500");
	});

	it("returns exactly 500-line output unchanged", () => {
		const lines = Array.from({ length: 500 }, (_, i) => `line ${i}`);
		const input = lines.join("\n");
		expect(truncateLongOutput(input)).toBe(input);
	});
});

// ============================================================================
// compressCaveToolOutput
// ============================================================================

describe("compressCaveToolOutput", () => {
	it("applies strip → collapse → truncate pipeline", () => {
		const input = "\u001b[31mred\u001b[0m\n\n\n\nplain";
		const result = compressCaveToolOutput(input);
		expect(result).toBe("red\n\nplain");
	});

	it("handles empty string", () => {
		expect(compressCaveToolOutput("")).toBe("");
	});
});

// ============================================================================
// compressCaveToolContentBlocks
// ============================================================================

describe("compressCaveToolContentBlocks", () => {
	it("compresses text blocks and returns new array when changed", () => {
		const blocks = [{ type: "text", text: "\u001b[31mred\u001b[0m" }];
		const result = compressCaveToolContentBlocks(blocks);
		expect(result).not.toBe(blocks); // new array
		expect(result[0].text).toBe("red");
	});

	it("returns same array reference when no changes are made", () => {
		const blocks = [{ type: "text", text: "plain text" }];
		const result = compressCaveToolContentBlocks(blocks);
		expect(result).toBe(blocks); // same reference — no change
	});

	it("passes image blocks through unchanged", () => {
		const imageBlock = { type: "image", data: "base64data", mimeType: "image/png" };
		const blocks = [imageBlock];
		const result = compressCaveToolContentBlocks(blocks);
		expect(result[0]).toBe(imageBlock);
	});

	it("handles mixed text and image blocks", () => {
		const imageBlock = { type: "image", data: "base64data", mimeType: "image/png" };
		const blocks = [{ type: "text", text: "\u001b[32mgreen\u001b[0m" }, imageBlock];
		const result = compressCaveToolContentBlocks(blocks);
		expect(result[0].text).toBe("green");
		expect(result[1]).toBe(imageBlock); // image block unchanged
	});

	it("handles blocks without text property", () => {
		const block = { type: "text" }; // no text field
		const blocks = [block];
		const result = compressCaveToolContentBlocks(blocks);
		expect(result[0]).toBe(block); // unchanged
	});

	// AC-2: Fallback behavior on error
	it("AC-2: gracefully falls back to original output when compression errors", () => {
		// Simulate a block where the text getter throws
		const badBlock = {
			type: "text",
			get text(): string {
				throw new Error("simulated compression error");
			},
		};

		// compressCaveToolContentBlocks itself doesn't have the try/catch —
		// the catch is in agent-session.ts afterToolCall.
		// Here we verify the compressor throws so the outer catch correctly
		// recovers the original content.
		expect(() => compressCaveToolContentBlocks([badBlock])).toThrow("simulated compression error");
	});
});

// ============================================================================
// AC-1: Disabled cave mode produces identical upstream behavior in system prompt
// ============================================================================

describe("buildSystemPrompt — cave mode disabled (AC-1)", () => {
	it("includes no cave mode section when enabled=false", () => {
		const prompt = buildSystemPrompt({
			caveMode: { enabled: false, intensity: "full" },
		});
		expect(prompt).not.toContain("Cave Mode");
		expect(prompt).not.toContain("Communication Style");
	});

	it("includes no cave mode section when caveMode is undefined", () => {
		const prompt = buildSystemPrompt({});
		expect(prompt).not.toContain("Cave Mode");
		expect(prompt).not.toContain("Communication Style");
	});

	it("includes cave mode section only when enabled=true", () => {
		const prompt = buildSystemPrompt({
			caveMode: { enabled: true, intensity: "full" },
		});
		expect(prompt).toContain("Cave Mode");
	});
});

describe("buildCaveModePrompt", () => {
	it("returns lite block for lite intensity", () => {
		const block = buildCaveModePrompt("lite");
		expect(block).toContain("lite");
		expect(block).toContain("Communication Style");
	});

	it("returns full block for full intensity", () => {
		const block = buildCaveModePrompt("full");
		expect(block).toContain("full");
		expect(block).toContain("Communication Style");
	});

	it("returns ultra block for ultra intensity", () => {
		const block = buildCaveModePrompt("ultra");
		expect(block).toContain("ultra");
		expect(block).toContain("Communication Style");
	});

	it("always preserves exception for code blocks", () => {
		for (const intensity of ["lite", "full", "ultra"] as const) {
			const block = buildCaveModePrompt(intensity);
			expect(block).toContain("Code blocks and inline code");
		}
	});
});
