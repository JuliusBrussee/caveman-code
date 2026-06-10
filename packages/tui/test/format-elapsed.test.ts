import assert from "node:assert";
import { describe, it } from "node:test";
import { formatElapsed } from "../src/format-elapsed.js";

describe("formatElapsed", () => {
	it("renders sub-second as ms", () => {
		assert.strictEqual(formatElapsed(0), "0ms");
		assert.strictEqual(formatElapsed(999), "999ms");
	});
	it("renders whole seconds at and above 1s", () => {
		assert.strictEqual(formatElapsed(1000), "1s");
		assert.strictEqual(formatElapsed(59_000), "59s");
	});
	it("renders minutes+seconds at and above 60s", () => {
		assert.strictEqual(formatElapsed(60_000), "1m00s");
		assert.strictEqual(formatElapsed(80_000), "1m20s");
		assert.strictEqual(formatElapsed(125_000), "2m05s");
	});
});
