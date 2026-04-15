// T-009, T-010
import { describe, expect, it } from "vitest";
import { isRole, requireRole, ROLES } from "../roles.js";

describe("roles", () => {
	it("defines exactly plan|edit|explore|verify", () => {
		expect(ROLES).toEqual(["plan", "edit", "explore", "verify"]);
	});

	it("isRole accepts valid values, rejects others", () => {
		expect(isRole("plan")).toBe(true);
		expect(isRole("verify")).toBe(true);
		expect(isRole("chat")).toBe(false);
		expect(isRole(undefined)).toBe(false);
		expect(isRole(42)).toBe(false);
	});

	it("requireRole passes through for valid role", () => {
		const r = requireRole({ role: "edit", payload: { foo: 1 } });
		expect(r.role).toBe("edit");
		expect(r.payload).toEqual({ foo: 1 });
	});

	it("requireRole throws with diagnostic for missing role", () => {
		expect(() => requireRole({ payload: {} } as unknown as { role: string; payload: unknown })).toThrow(
			/missing or invalid role/,
		);
	});

	it("requireRole throws for invalid role string", () => {
		expect(() => requireRole({ role: "chat", payload: {} })).toThrow(/missing or invalid/);
	});
});
