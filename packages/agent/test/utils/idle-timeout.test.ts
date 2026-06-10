import { describe, expect, it, vi } from "vitest";
import { StreamIdleTimeoutError, withIdleTimeout } from "../../src/utils/idle-timeout.js";

/** Async iterable that yields `values` then completes normally. */
function finite<T>(values: T[]): AsyncIterable<T> {
	return {
		async *[Symbol.asyncIterator]() {
			yield* values;
		},
	};
}

/** Async iterable that yields `values` then stalls forever (next() never resolves). */
function stalls<T>(values: T[]): AsyncIterable<T> {
	return {
		[Symbol.asyncIterator](): AsyncIterator<T> {
			let i = 0;
			return {
				next(): Promise<IteratorResult<T>> {
					if (i < values.length) return Promise.resolve({ value: values[i++], done: false });
					return new Promise<IteratorResult<T>>(() => {}); // never resolves (stall)
				},
			};
		},
	};
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
	const out: T[] = [];
	for await (const v of it) out.push(v);
	return out;
}

describe("withIdleTimeout", () => {
	it("passes through all values when the source stays active", async () => {
		const out = await collect(withIdleTimeout(finite([1, 2, 3]), 1000));
		expect(out).toEqual([1, 2, 3]);
	});

	it("throws StreamIdleTimeoutError when the source stalls", async () => {
		await expect(collect(withIdleTimeout(stalls([1]), 50))).rejects.toBeInstanceOf(StreamIdleTimeoutError);
	});

	it("invokes onTimeout exactly once when it trips", async () => {
		const onTimeout = vi.fn();
		await expect(collect(withIdleTimeout(stalls([1]), 50, onTimeout))).rejects.toBeInstanceOf(StreamIdleTimeoutError);
		expect(onTimeout).toHaveBeenCalledTimes(1);
	});

	it("disables the watchdog when idleMs <= 0 (passthrough)", async () => {
		const out = await collect(withIdleTimeout(finite([1, 2]), 0));
		expect(out).toEqual([1, 2]);
	});

	it("does not trip when each value arrives within the idle window", async () => {
		async function* slowButSteady(): AsyncGenerator<number> {
			for (const n of [1, 2, 3]) {
				await new Promise((r) => setTimeout(r, 30));
				yield n;
			}
		}
		const out = await collect(withIdleTimeout(slowButSteady(), 100));
		expect(out).toEqual([1, 2, 3]);
	});
});
