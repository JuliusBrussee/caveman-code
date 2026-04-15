// T-050, T-051, T-052: cache-aware middle-drop trimming with N-recent-turn floor
// + deterministic stable summary block.

export interface Turn {
	index: number;
	bytes: string;
}

export interface TrimConfig {
	/** Keep the most recent N turns untouched. */
	recentFloor: number;
}

export interface TrimResult {
	kept: Turn[];
	summary: Turn;
	droppedCount: number;
}

/** Deterministic summary bytes derived from dropped turns. */
export function summarize(dropped: Turn[]): string {
	const indices = dropped.map((t) => t.index).join(",");
	const totalBytes = dropped.reduce((acc, t) => acc + t.bytes.length, 0);
	return `<compact ${dropped.length} turns [${indices}], ${totalBytes} bytes>`;
}

/** Middle-drop: keep [0..pivot] as a placeholder floor and [tail - recentFloor..tail];
 *  drop the middle span and replace with a stable summary. */
export function trimMiddle(turns: Turn[], config: TrimConfig): TrimResult {
	if (turns.length <= config.recentFloor + 1) {
		return {
			kept: turns,
			summary: { index: -1, bytes: "" },
			droppedCount: 0,
		};
	}
	const tail = turns.slice(turns.length - config.recentFloor);
	const middle = turns.slice(0, turns.length - config.recentFloor);
	const summary: Turn = {
		index: middle[middle.length - 1].index + 0.5,
		bytes: summarize(middle),
	};
	return {
		kept: [summary, ...tail],
		summary,
		droppedCount: middle.length,
	};
}

// T-053, T-054: opt-in keepalive pings with idle shutoff.
export interface KeepaliveConfig {
	intervalMs: number;
	retention: "long" | "short" | "none";
	enabled: boolean;
}

export class KeepaliveScheduler {
	private lastPingMs = 0;
	private lastActivityMs = 0;

	tick(now: number, config: KeepaliveConfig): "ping" | "shutoff" | "skip" {
		if (!config.enabled || config.retention === "none") return "skip";
		if (now - this.lastActivityMs > config.intervalMs * 2) return "shutoff";
		if (now - this.lastPingMs >= config.intervalMs) {
			this.lastPingMs = now;
			return "ping";
		}
		return "skip";
	}

	markActivity(now: number): void {
		this.lastActivityMs = now;
		this.lastPingMs = now;
	}
}
