import { describe, it, expect } from "vitest";
import { truncate, titleCase, countOccurrences } from "./string-utils";

describe("truncate", () => {
  it("returns the string unchanged if shorter than maxLen", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("returns the string unchanged if exactly maxLen", () => {
    // This test catches the off-by-one bug: length === maxLen should NOT truncate
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates and appends ... if longer than maxLen", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
  });
});

describe("titleCase", () => {
  it("capitalizes each word", () => {
    expect(titleCase("hello world")).toBe("Hello World");
  });

  it("handles single word", () => {
    expect(titleCase("hello")).toBe("Hello");
  });
});

describe("countOccurrences", () => {
  it("counts non-overlapping occurrences", () => {
    expect(countOccurrences("abcabc", "abc")).toBe(2);
  });

  it("returns 0 for empty substring", () => {
    expect(countOccurrences("hello", "")).toBe(0);
  });
});
