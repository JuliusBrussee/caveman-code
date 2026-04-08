import { Type } from "@sinclair/typebox";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolCall } from "../src/types.js";
import { validateToolArguments } from "../src/utils/validation.js";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("validateToolArguments", () => {
	it("falls back to raw arguments without writing to stderr when runtime code generation is blocked", () => {
		const originalFunction = globalThis.Function;
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const tool = {
			name: "echo",
			description: "Echo tool",
			parameters: Type.Object({
				count: Type.Number(),
			}),
		};
		const toolCall: ToolCall = {
			type: "toolCall",
			id: "tool-1",
			name: "echo",
			arguments: { count: "42" as unknown as number },
		};

		globalThis.Function = (() => {
			throw new EvalError("Code generation from strings disallowed for this context");
		}) as unknown as FunctionConstructor;

		try {
			expect(validateToolArguments(tool, toolCall)).toEqual(toolCall.arguments);
			expect(errorSpy).not.toHaveBeenCalled();
		} finally {
			globalThis.Function = originalFunction;
		}
	});
});
