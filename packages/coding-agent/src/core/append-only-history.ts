// T-007, T-008: append-only message history invariant + 20-turn compaction immutability.
//
// Self-contained model of the append-only invariant. The existing
// SessionManager / JSONL v3 writer can adopt this helper in a follow-up
// packet; for now R4 is enforced as a reusable primitive with tests.

import { createHash } from "node:crypto";

export type HistoryBlockKind = "message" | "summary";

export interface HistoryBlock {
	readonly kind: HistoryBlockKind;
	readonly turnIndex: number;
	readonly bytes: string;
}

function frozen(block: HistoryBlock): HistoryBlock {
	return Object.freeze({ ...block });
}

export class AppendOnlyHistory {
	private readonly blocks: HistoryBlock[] = [];

	append(block: Omit<HistoryBlock, "turnIndex"> & { turnIndex?: number }): HistoryBlock {
		const turnIndex = block.turnIndex ?? this.blocks.length;
		if (
			this.blocks.length > 0 &&
			turnIndex <= this.blocks[this.blocks.length - 1].turnIndex
		) {
			throw new Error(
				`append-only: turnIndex ${turnIndex} must exceed tail ${this.blocks[this.blocks.length - 1].turnIndex}`,
			);
		}
		const b = frozen({ kind: block.kind, turnIndex, bytes: block.bytes });
		this.blocks.push(b);
		return b;
	}

	/** Read-only snapshot. Returned array is a copy; blocks are frozen. */
	snapshot(): readonly HistoryBlock[] {
		return [...this.blocks];
	}

	get length(): number {
		return this.blocks.length;
	}

	byteHash(upToTurn?: number): string {
		const slice =
			upToTurn === undefined
				? this.blocks
				: this.blocks.filter((b) => b.turnIndex <= upToTurn);
		return createHash("sha256")
			.update(slice.map((b) => `${b.turnIndex}:${b.kind}:${b.bytes}`).join("\n"))
			.digest("hex");
	}

	/** Compaction: append a summary block covering turns [0..upToTurn].
	 *  Historical blocks remain present and unchanged — compaction is an
	 *  append, never a rewrite. */
	compactTo(upToTurn: number, summaryBytes: string): HistoryBlock {
		if (this.blocks.length === 0) throw new Error("compact: empty history");
		const tail = this.blocks[this.blocks.length - 1].turnIndex;
		return this.append({
			kind: "summary",
			bytes: summaryBytes,
			turnIndex: tail + 1,
		});
	}
}

/** Throws if any block prior to `pivot` has changed between two snapshots. */
export function assertPrefixUnchanged(
	before: readonly HistoryBlock[],
	after: readonly HistoryBlock[],
	pivot: number,
): void {
	const beforePrefix = before.filter((b) => b.turnIndex < pivot);
	const afterPrefix = after.filter((b) => b.turnIndex < pivot);
	if (beforePrefix.length !== afterPrefix.length) {
		throw new Error(
			`append-only violation: prefix length ${beforePrefix.length} → ${afterPrefix.length}`,
		);
	}
	for (let i = 0; i < beforePrefix.length; i++) {
		const a = beforePrefix[i];
		const b = afterPrefix[i];
		if (a.turnIndex !== b.turnIndex || a.kind !== b.kind || a.bytes !== b.bytes) {
			throw new Error(
				`append-only violation at turn ${a.turnIndex}: historical block mutated`,
			);
		}
	}
}
