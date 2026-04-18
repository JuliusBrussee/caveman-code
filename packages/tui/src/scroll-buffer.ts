/**
 * In-app scroll buffer.
 *
 * Covers cavekit-fullscreen-viewport R5 (buffer semantics), R6 (scroll controls).
 * The buffer owns the session transcript; the TUI renders whatever slice the
 * buffer exposes for the current viewport.
 */

import { visibleWidth, wrapTextWithAnsi } from "./utils.js";

export type ScrollMode = "tail" | "paused";

export interface ScrollBufferOptions {
	maxLines?: number;
	wrap?: boolean;
}

/**
 * Session transcript with viewport and follow-tail semantics.
 *
 * The buffer stores raw "logical" lines as appended. For rendering, lines are
 * soft-wrapped to the current viewport width producing "display" lines. The
 * viewport is defined in display lines, so the scroll math operates on the
 * post-wrap stream and stays consistent after resize.
 */
export class ScrollBuffer {
	private logical: string[] = [];
	private wrapEnabled: boolean;
	private readonly maxLines: number;

	// Cache of wrapped lines — invalidated on width change or append.
	private wrappedCache: string[] | null = null;
	private cachedWidth = 0;

	private viewportWidth = 80;
	private viewportHeight = 24;

	/** Offset from the top of the wrapped stream (display-line index of viewport top). */
	private topOffset = 0;

	private _mode: ScrollMode = "tail";
	private _unseen = 0;

	constructor(opts: ScrollBufferOptions = {}) {
		this.maxLines = opts.maxLines ?? Number.POSITIVE_INFINITY;
		this.wrapEnabled = opts.wrap !== false;
	}

	append(lines: string[]): void {
		if (lines.length === 0) return;
		this.logical.push(...lines);
		this.trimToMax();
		this.invalidateCache();

		if (this._mode === "tail") {
			this.snapToTail();
		} else {
			this._unseen += this.countDisplayLines(lines);
		}
	}

	/**
	 * Replace the last `count` logical lines with `lines`. Used for streaming
	 * updates to a single message that grows in-place. Tail/paused behavior
	 * mirrors append().
	 */
	replaceTail(count: number, lines: string[]): void {
		if (count > 0) {
			const removeCount = Math.min(count, this.logical.length);
			this.logical.splice(this.logical.length - removeCount, removeCount);
		}
		this.logical.push(...lines);
		this.trimToMax();
		this.invalidateCache();

		if (this._mode === "tail") {
			this.snapToTail();
		}
	}

	clear(): void {
		this.logical = [];
		this.invalidateCache();
		this.topOffset = 0;
		this._mode = "tail";
		this._unseen = 0;
	}

	setViewportHeight(rows: number): void {
		if (rows === this.viewportHeight) return;
		this.viewportHeight = Math.max(1, rows);
		if (this._mode === "tail") this.snapToTail();
		else this.clampTopOffset();
	}

	setViewportWidth(cols: number): void {
		if (cols === this.viewportWidth) return;
		this.viewportWidth = Math.max(1, cols);
		this.invalidateCache();
		if (this._mode === "tail") this.snapToTail();
		else this.clampTopOffset();
	}

	get totalLines(): number {
		return this.getWrapped().length;
	}

	get viewHeight(): number {
		return this.viewportHeight;
	}

	get viewWidth(): number {
		return this.viewportWidth;
	}

	scrollBy(delta: number): void {
		if (delta === 0) return;
		const next = this.topOffset + delta;
		const maxTop = Math.max(0, this.getWrapped().length - this.viewportHeight);
		const clamped = Math.max(0, Math.min(maxTop, next));
		if (clamped === this.topOffset) return;
		this.topOffset = clamped;
		if (this.topOffset >= maxTop) {
			this.setMode("tail");
		} else {
			this.setMode("paused");
		}
	}

	pageUp(): void {
		this.scrollBy(-Math.max(1, this.viewportHeight - 1));
	}

	pageDown(): void {
		this.scrollBy(Math.max(1, this.viewportHeight - 1));
	}

	halfPageUp(): void {
		this.scrollBy(-Math.max(1, Math.floor(this.viewportHeight / 2)));
	}

	halfPageDown(): void {
		this.scrollBy(Math.max(1, Math.floor(this.viewportHeight / 2)));
	}

	jumpToTop(): void {
		if (this.topOffset === 0) return;
		this.topOffset = 0;
		this.setMode(this.getWrapped().length <= this.viewportHeight ? "tail" : "paused");
	}

	jumpToTail(): void {
		this.setMode("tail");
		this.snapToTail();
	}

	get isAtTail(): boolean {
		const maxTop = Math.max(0, this.getWrapped().length - this.viewportHeight);
		return this.topOffset >= maxTop;
	}

	get mode(): ScrollMode {
		return this._mode;
	}

	unseenCount(): number {
		return this._unseen;
	}

	/** Returns exactly viewportHeight display lines (pads with "" when short). */
	render(): string[] {
		const wrapped = this.getWrapped();
		const start = Math.max(0, Math.min(wrapped.length, this.topOffset));
		const slice = wrapped.slice(start, start + this.viewportHeight);
		while (slice.length < this.viewportHeight) slice.push("");
		return slice;
	}

	// ------------------- internals -------------------

	private setMode(next: ScrollMode): void {
		if (this._mode === next) return;
		this._mode = next;
		if (next === "tail") {
			this._unseen = 0;
		}
	}

	private snapToTail(): void {
		const total = this.getWrapped().length;
		this.topOffset = Math.max(0, total - this.viewportHeight);
		this._unseen = 0;
	}

	private clampTopOffset(): void {
		const maxTop = Math.max(0, this.getWrapped().length - this.viewportHeight);
		if (this.topOffset > maxTop) this.topOffset = maxTop;
		if (this.topOffset < 0) this.topOffset = 0;
	}

	private trimToMax(): void {
		if (!Number.isFinite(this.maxLines)) return;
		const over = this.logical.length - this.maxLines;
		if (over > 0) this.logical.splice(0, over);
	}

	private invalidateCache(): void {
		this.wrappedCache = null;
	}

	private getWrapped(): string[] {
		if (this.wrappedCache && this.cachedWidth === this.viewportWidth) {
			return this.wrappedCache;
		}
		if (!this.wrapEnabled) {
			this.wrappedCache = [...this.logical];
		} else {
			const out: string[] = [];
			for (const line of this.logical) {
				if (visibleWidth(line) <= this.viewportWidth) {
					out.push(line);
				} else {
					out.push(...wrapTextWithAnsi(line, this.viewportWidth));
				}
			}
			this.wrappedCache = out;
		}
		this.cachedWidth = this.viewportWidth;
		return this.wrappedCache;
	}

	private countDisplayLines(lines: string[]): number {
		if (!this.wrapEnabled) return lines.length;
		let n = 0;
		for (const line of lines) {
			if (visibleWidth(line) <= this.viewportWidth) n += 1;
			else n += wrapTextWithAnsi(line, this.viewportWidth).length;
		}
		return n;
	}
}
