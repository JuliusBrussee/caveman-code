// T-036, T-037: Append-only trace JSONL writer + size-threshold rotation.
//
// Emits one JSON object per line. Never rewrites the file in place.
// When the file exceeds `rotateBytes`, the existing file is renamed to
// `<name>.<seq>` and writing continues on a fresh file. Rotation
// preserves the existing bytes.

import type { TraceEvent } from "./types.js";

export interface TraceSink {
	write(event: TraceEvent): void;
	bytesWritten(): number;
	rotations(): number;
	/** Return accumulated lines for tests. */
	snapshot(): string[];
}

export interface InMemoryTraceSink extends TraceSink {
	files(): Record<string, string[]>;
}

/**
 * In-memory trace sink. Rotation is modeled by sealing the active file
 * under a new key and opening a fresh one. Real impl will shell out to
 * `fs.appendFileSync`.
 */
export function createInMemoryTraceSink(
	basename: string,
	rotateBytes = 1024 * 1024,
): InMemoryTraceSink {
	const sealed: Record<string, string[]> = {};
	let active: string[] = [];
	let activeBytes = 0;
	let rotations = 0;
	let totalBytes = 0;

	function activeName(): string {
		return rotations === 0 ? basename : `${basename}.${rotations}`;
	}

	return {
		write(event: TraceEvent): void {
			const line = JSON.stringify(event);
			const lineBytes = Buffer.byteLength(line) + 1; // +1 for \n
			if (activeBytes + lineBytes > rotateBytes && active.length > 0) {
				sealed[activeName()] = active;
				active = [];
				activeBytes = 0;
				rotations++;
			}
			active.push(line);
			activeBytes += lineBytes;
			totalBytes += lineBytes;
		},
		bytesWritten(): number {
			return totalBytes;
		},
		rotations(): number {
			return rotations;
		},
		snapshot(): string[] {
			const out: string[] = [];
			for (const key of Object.keys(sealed).sort()) out.push(...sealed[key]);
			out.push(...active);
			return out;
		},
		files(): Record<string, string[]> {
			return { ...sealed, [activeName()]: [...active] };
		},
	};
}

/** Helper to build a well-formed TraceEvent with monotonic seq. */
export class TraceEmitter {
	private seq = 0;
	constructor(private readonly sink: TraceSink) {}
	emit(type: TraceEvent["type"], turn: number, payload: unknown, now: () => number = Date.now): TraceEvent {
		const event: TraceEvent = {
			type,
			turn,
			seq: this.seq++,
			ts: now(),
			payload,
		};
		this.sink.write(event);
		return event;
	}
}
