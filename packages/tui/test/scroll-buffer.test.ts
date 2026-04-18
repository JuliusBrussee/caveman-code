import { describe, expect, it } from "vitest";
import { ScrollBuffer } from "../src/scroll-buffer.js";

function range(n: number, prefix = "line"): string[] {
	return Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`);
}

describe("ScrollBuffer", () => {
	it("append in tail mode keeps viewport stuck to bottom", () => {
		const buf = new ScrollBuffer();
		buf.setViewportHeight(5);
		buf.setViewportWidth(80);
		buf.append(range(10));
		expect(buf.mode).toBe("tail");
		expect(buf.isAtTail).toBe(true);
		const view = buf.render();
		expect(view).toEqual(["line 6", "line 7", "line 8", "line 9", "line 10"]);
	});

	it("scrollBy transitions tail -> paused", () => {
		const buf = new ScrollBuffer();
		buf.setViewportHeight(5);
		buf.setViewportWidth(80);
		buf.append(range(20));
		buf.scrollBy(-3);
		expect(buf.mode).toBe("paused");
		expect(buf.isAtTail).toBe(false);
	});

	it("append in paused mode retains position and counts unseen", () => {
		const buf = new ScrollBuffer();
		buf.setViewportHeight(5);
		buf.setViewportWidth(80);
		buf.append(range(20));
		buf.scrollBy(-5); // pause
		const topBefore = buf.render()[0];
		buf.append(range(4, "new"));
		expect(buf.mode).toBe("paused");
		expect(buf.render()[0]).toBe(topBefore);
		expect(buf.unseenCount()).toBe(4);
	});

	it("scrollBy clamps at both ends", () => {
		const buf = new ScrollBuffer();
		buf.setViewportHeight(5);
		buf.setViewportWidth(80);
		buf.append(range(10));
		buf.scrollBy(-100);
		expect(buf.render()[0]).toBe("line 1");
		buf.scrollBy(100);
		expect(buf.render()[4]).toBe("line 10");
	});

	it("pageUp / pageDown moves by viewportHeight - 1", () => {
		const buf = new ScrollBuffer();
		buf.setViewportHeight(5); // page = 4
		buf.setViewportWidth(80);
		buf.append(range(20));
		buf.pageUp();
		expect(buf.render()[0]).toBe("line 12"); // 20-5=15 then -4 = 11 (0-indexed top = 11, so "line 12")
		buf.pageDown();
		expect(buf.render()[4]).toBe("line 20");
	});

	it("halfPageUp / halfPageDown moves by half viewport", () => {
		const buf = new ScrollBuffer();
		buf.setViewportHeight(6); // half = 3
		buf.setViewportWidth(80);
		buf.append(range(20));
		buf.halfPageUp();
		expect(buf.render()[0]).toBe("line 12"); // 20-6=14 then -3 = 11 -> "line 12"
	});

	it("jumpToTail returns to tail mode and scrolls to newest", () => {
		const buf = new ScrollBuffer();
		buf.setViewportHeight(5);
		buf.setViewportWidth(80);
		buf.append(range(20));
		buf.scrollBy(-10);
		buf.append(range(3, "new"));
		expect(buf.mode).toBe("paused");
		buf.jumpToTail();
		expect(buf.mode).toBe("tail");
		expect(buf.render()[4]).toBe("new 3");
		expect(buf.unseenCount()).toBe(0);
	});

	it("scrolling all the way down re-enters tail mode", () => {
		const buf = new ScrollBuffer();
		buf.setViewportHeight(5);
		buf.setViewportWidth(80);
		buf.append(range(20));
		buf.scrollBy(-5);
		buf.scrollBy(100);
		expect(buf.mode).toBe("tail");
		expect(buf.isAtTail).toBe(true);
	});

	it("width change reflows wrapped lines and preserves tail mode", () => {
		const buf = new ScrollBuffer();
		buf.setViewportHeight(4);
		buf.setViewportWidth(20);
		const longLine = "word ".repeat(10).trim(); // 49 chars
		buf.append(["short", longLine]);
		expect(buf.mode).toBe("tail");
		const narrowTotal = buf.totalLines;
		expect(narrowTotal).toBeGreaterThan(2);
		buf.setViewportWidth(80);
		// At width 80 the long line fits on one line — total display lines drops back to 2
		expect(buf.totalLines).toBe(2);
		expect(buf.mode).toBe("tail");
		expect(buf.isAtTail).toBe(true);
	});

	it("respects visibleWidth when wrapping ANSI-styled lines", () => {
		const buf = new ScrollBuffer();
		buf.setViewportHeight(3);
		buf.setViewportWidth(10);
		// 10 visible chars worth of text but with ANSI color
		buf.append(["\x1b[31mhellohello\x1b[0m world here"]);
		const rows = buf.render();
		// Wrapped at 10 visible cols — first row should contain the red-styled text
		expect(rows[0]).toContain("\x1b[31m");
	});

	it("replaceTail edits the last N lines without double-appending", () => {
		const buf = new ScrollBuffer();
		buf.setViewportHeight(5);
		buf.setViewportWidth(80);
		buf.append(["a", "b", "c", "d"]);
		buf.replaceTail(2, ["C2", "D2", "E2"]);
		const view = buf.render();
		expect(view.slice(0, 5)).toEqual(["a", "b", "C2", "D2", "E2"]);
	});
});
