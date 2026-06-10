/**
 * Thrown by {@link withIdleTimeout} when a wrapped async iterable produces no
 * value within the configured idle window. Used to detect a stalled model
 * stream (provider opened the connection then stopped sending bytes) so the
 * agent loop can abort and surface a retryable error instead of hanging forever.
 */
export class StreamIdleTimeoutError extends Error {
	constructor(public readonly idleMs: number) {
		super(`Stream idle for ${idleMs}ms with no activity`);
		this.name = "StreamIdleTimeoutError";
	}
}

/**
 * Wrap an async iterable with an inactivity watchdog.
 *
 * Yields every value from `source` unchanged, but if no value arrives within
 * `idleMs` milliseconds the iteration throws {@link StreamIdleTimeoutError}.
 * The timer resets on every yielded value, so a steadily-streaming source never
 * trips. `idleMs <= 0` disables the watchdog (plain passthrough).
 *
 * `onTimeout` (if provided) fires exactly once, just before the throw — use it
 * to tear down the underlying source (e.g. abort the HTTP request) so the
 * orphaned `next()` promise and its socket are released.
 */
export async function* withIdleTimeout<T>(
	source: AsyncIterable<T>,
	idleMs: number,
	onTimeout?: () => void,
): AsyncGenerator<T> {
	if (!idleMs || idleMs <= 0) {
		yield* source;
		return;
	}

	const iterator = source[Symbol.asyncIterator]();
	while (true) {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const idle = new Promise<never>((_resolve, reject) => {
			timer = setTimeout(() => reject(new StreamIdleTimeoutError(idleMs)), idleMs);
		});

		let result: IteratorResult<T>;
		try {
			result = await Promise.race([iterator.next(), idle]);
		} catch (err) {
			if (err instanceof StreamIdleTimeoutError) {
				onTimeout?.();
			}
			throw err;
		} finally {
			if (timer) clearTimeout(timer);
		}

		if (result.done) return;
		yield result.value;
	}
	// NOTE: deliberately no `iterator.return()` cleanup — the underlying
	// EventStream generator is parked on a never-resolving promise during a
	// stall, and awaiting its return would deadlock. Teardown of the real
	// resource (the HTTP request) happens via the `onTimeout` abort instead.
}
