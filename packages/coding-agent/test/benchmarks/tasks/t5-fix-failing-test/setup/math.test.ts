import { describe, expect, it } from "vitest";
import { add, average, divide, multiply } from "./math";

describe("math", () => {
	it("adds numbers", () => {
		expect(add(2, 3)).toBe(5);
		expect(add(-1, 1)).toBe(0);
	});

	it("multiplies numbers", () => {
		expect(multiply(3, 4)).toBe(12);
		expect(multiply(0, 100)).toBe(0);
	});

	it("divides numbers", () => {
		expect(divide(10, 2)).toBe(5);
		expect(divide(7, 2)).toBe(3.5);
	});

	it("throws on division by zero", () => {
		expect(() => divide(10, 0)).toThrow();
	});

	it("calculates average", () => {
		expect(average([1, 2, 3, 4, 5])).toBe(3);
		expect(average([])).toBe(0);
	});
});
