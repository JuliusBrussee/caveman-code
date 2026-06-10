/**
 * Format a millisecond duration as a compact human string.
 * `120ms` (sub-second) → `3s` → `1m20s`.
 */
export function formatElapsed(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	const rs = s % 60;
	return `${m}m${rs.toString().padStart(2, "0")}s`;
}
