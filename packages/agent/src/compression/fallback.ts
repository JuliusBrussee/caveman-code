// T-117: emit compression_fallback trace event on model load/inference failure.

import type { TraceEvent } from "../cost/types.js";

export interface CompressionFallbackReason {
	middleware: string;
	cause: "model_missing" | "model_load_failed" | "inference_error";
	error?: string;
}

export function compressionFallbackEvent(
	reason: CompressionFallbackReason,
	turn: number,
	seq: number,
	now: number,
): TraceEvent {
	return {
		type: "compression_fallback",
		turn,
		seq,
		ts: now,
		payload: reason,
	};
}

/** Wrap a compression call; on throw, emit a fallback event and return
 *  a passthrough result instead of propagating. */
export interface SafeCompressResult<T> {
	result: T;
	fallback?: CompressionFallbackReason;
}

export function safeCompress<T>(
	attempt: () => T,
	passthrough: T,
	middleware: string,
): SafeCompressResult<T> {
	try {
		return { result: attempt() };
	} catch (err) {
		return {
			result: passthrough,
			fallback: {
				middleware,
				cause: "inference_error",
				error: err instanceof Error ? err.message : String(err),
			},
		};
	}
}
