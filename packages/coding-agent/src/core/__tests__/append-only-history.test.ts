// T-007, T-008
import { describe, expect, it } from "vitest";
import {
	AppendOnlyHistory,
	assertPrefixUnchanged,
	type HistoryBlock,
} from "../append-only-history.js";

function seed(n: number): AppendOnlyHistory {
	const h = new AppendOnlyHistory();
	for (let i = 0; i < n; i++) {
		h.append({ kind: "message", bytes: `turn-${i}` });
	}
	return h;
}

describe("AppendOnlyHistory", () => {
	it("appends blocks monotonically", () => {
		const h = seed(5);
		expect(h.length).toBe(5);
		expect(h.snapshot()[0].turnIndex).toBe(0);
		expect(h.snapshot()[4].turnIndex).toBe(4);
	});

	it("rejects non-monotonic turn index", () => {
		const h = seed(3);
		expect(() => h.append({ kind: "message", bytes: "x", turnIndex: 1 })).toThrow(
			/append-only/,
		);
	});

	it("frozen blocks resist in-place mutation", () => {
		const h = seed(1);
		const block = h.snapshot()[0] as HistoryBlock & { bytes: string };
		expect(() => {
			(block as { bytes: string }).bytes = "mutated";
		}).toThrow();
	});

	it("20-turn compaction leaves pre-15 bytes unchanged", () => {
		const h = new AppendOnlyHistory();
		for (let i = 0; i < 20; i++) {
			h.append({ kind: "message", bytes: `msg-${i}` });
		}
		const beforeHash = h.byteHash(14);
		const beforeSnap = h.snapshot();
		h.compactTo(14, "summary of turns 0..14");
		const afterHash = h.byteHash(14);
		const afterSnap = h.snapshot();
		expect(afterHash).toBe(beforeHash);
		assertPrefixUnchanged(beforeSnap, afterSnap, 15);
	});

	it("compaction summaries monotonically appended (multiple compactions)", () => {
		const h = seed(10);
		const s1 = h.compactTo(4, "sum 0..4");
		const s2 = h.compactTo(9, "sum 5..9");
		expect(s2.turnIndex).toBeGreaterThan(s1.turnIndex);
		// Prior blocks unchanged
		for (let i = 0; i < 10; i++) {
			expect(h.snapshot()[i].bytes).toBe(`turn-${i}`);
		}
	});

	it("mutating historical block surfaces as hash-visible failure", () => {
		const h = seed(5);
		const hashBefore = h.byteHash();
		// attempt to mutate via frozen — fails; hash unchanged proves block integrity
		try {
			(h.snapshot()[0] as { bytes: string }).bytes = "poison";
		} catch {
			/* frozen throws */
		}
		expect(h.byteHash()).toBe(hashBefore);
	});
});
