import assert from "node:assert";
import { describe, it, mock } from "node:test";
import { Loader } from "../src/components/loader.js";
import type { TUI } from "../src/tui.js";

const fakeUi = { requestRender() {} } as unknown as TUI;
const id = (s: string) => s;

describe("Loader elapsed timer", () => {
	it("appends elapsed token when showElapsed is true", () => {
		mock.timers.enable({ apis: ["Date", "setInterval"] });
		try {
			const loader = new Loader(fakeUi, id, id, "Working...", undefined, true);
			mock.timers.setTime(12_000);
			loader.setMessage("Working..."); // force a redraw at the new clock
			const out = loader.render(80).join("\n");
			assert.match(out, /\(12s\)/);
			loader.stop();
		} finally {
			mock.timers.reset();
		}
	});

	it("omits elapsed token by default", () => {
		mock.timers.enable({ apis: ["Date", "setInterval"] });
		try {
			const loader = new Loader(fakeUi, id, id, "Working...");
			mock.timers.setTime(12_000);
			loader.setMessage("Working...");
			const out = loader.render(80).join("\n");
			assert.doesNotMatch(out, /\(\d/);
			loader.stop();
		} finally {
			mock.timers.reset();
		}
	});

	it("keeps counting across variant change (no reset)", () => {
		mock.timers.enable({ apis: ["Date", "setInterval"] });
		try {
			const loader = new Loader(fakeUi, id, id, "Working...", undefined, true);
			mock.timers.setTime(5_000);
			loader.setVariant("scan");
			mock.timers.setTime(8_000);
			loader.setMessage("Working...");
			const out = loader.render(80).join("\n");
			assert.match(out, /\(8s\)/);
			loader.stop();
		} finally {
			mock.timers.reset();
		}
	});
});
