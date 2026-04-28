import { describe, expect, it } from "vitest";
import { DefaultModelRouter, fixedRouter } from "../router.js";

describe("DefaultModelRouter", () => {
	it("resolves plan to long retention, verify to short", () => {
		const r = new DefaultModelRouter();
		expect(r.route({ role: "plan" }).retention).toBe("long");
		expect(r.route({ role: "verify" }).retention).toBe("short");
	});

	it("is deterministic across 1000 identical calls", () => {
		const r = new DefaultModelRouter();
		const first = r.route({ role: "edit" });
		for (let i = 0; i < 1000; i++) {
			const d = r.route({ role: "edit" });
			expect(d.model).toBe(first.model);
			expect(d.retention).toBe(first.retention);
			expect(d.profile).toBe(first.profile);
		}
	});

	it("downgrades non-plan role at 90% cost cap", () => {
		const r = new DefaultModelRouter();
		const atCap = r.route({
			role: "edit",
			sessionCapDollars: 1.0,
			sessionCostDollars: 0.95,
		});
		const belowCap = r.route({
			role: "edit",
			sessionCapDollars: 1.0,
			sessionCostDollars: 0.5,
		});
		expect(atCap.model).not.toBe(belowCap.model);
		expect(atCap.profile).toMatch(/downgrade/);
	});

	it("never silently downgrades plan role (R5 safeguard)", () => {
		const r = new DefaultModelRouter();
		const atCap = r.route({
			role: "plan",
			sessionCapDollars: 1.0,
			sessionCostDollars: 0.99,
		});
		const normal = r.route({ role: "plan" });
		expect(atCap.model).toBe(normal.model);
	});

	it("swappable: tests can inject a fixed router", () => {
		const swap = fixedRouter({
			model: "test-model",
			retention: "none",
			profile: "test",
		});
		expect(swap.route({ role: "plan" }).model).toBe("test-model");
	});
});
