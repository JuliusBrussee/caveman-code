// T-009, T-010: Role tags for outbound agent LLM calls.
//
// Every outbound call must carry exactly one role. Missing or multi-role
// calls are test-visible failures.

export type Role = "plan" | "edit" | "explore" | "verify";

export const ROLES: readonly Role[] = ["plan", "edit", "explore", "verify"] as const;

export function isRole(value: unknown): value is Role {
	return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export interface RoleTagged<T = unknown> {
	role: Role;
	payload: T;
}

export function requireRole<T>(value: { role?: unknown; payload: T }): RoleTagged<T> {
	if (!isRole(value.role)) {
		throw new Error(
			`roles: outbound call missing or invalid role (got ${JSON.stringify(value.role)})`,
		);
	}
	return { role: value.role, payload: value.payload };
}
