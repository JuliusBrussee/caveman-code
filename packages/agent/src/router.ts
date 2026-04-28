// ModelRouter interface + deterministic default impl.
//
// Design goals:
// - ModelRouter is an interface. The agent loop calls it for every
//   outbound request, and tests can swap it.
// - Default impl is config-backed and deterministic: no Date, no random,
//   no env reads inside the hot path.
// - 1000 identical calls return the identical decision.
// - Cost-aware downgrade: at 90% of session cap, non-plan roles fall to cheapTier.

import type { Role } from "./roles.js";

export type CacheRetention = "long" | "short" | "none";

export interface RoutingDecision {
	model: string;
	retention: CacheRetention;
	/** Opaque profile id that produced the decision. Used for tracing. */
	profile: string;
}

export interface RouteContext {
	role: Role;
	/** Running session cost in dollars. Used by cost-aware downgrade (T-131). */
	sessionCostDollars?: number;
	/** Running session cap in dollars if configured. */
	sessionCapDollars?: number;
}

export interface ModelRouter {
	route(ctx: RouteContext): RoutingDecision;
}

export interface RoleProfile {
	model: string;
	retention: CacheRetention;
}

export interface RoutingProfile {
	name: string;
	roles: Record<Role, RoleProfile>;
	/** Optional cheap-tier per role for cost-aware downgrade (T-131). */
	cheapTier?: Partial<Record<Role, string>>;
}

export const DEFAULT_PROFILE: RoutingProfile = {
	name: "default",
	roles: {
		plan: { model: "claude-opus-4-6", retention: "long" },
		edit: { model: "claude-sonnet-4-6", retention: "short" },
		explore: { model: "claude-sonnet-4-6", retention: "short" },
		verify: { model: "claude-haiku-4-5", retention: "short" },
	},
	cheapTier: {
		plan: "claude-sonnet-4-6",
		edit: "claude-haiku-4-5",
		explore: "claude-haiku-4-5",
		verify: "claude-haiku-4-5",
	},
};

export class DefaultModelRouter implements ModelRouter {
	constructor(private readonly profile: RoutingProfile = DEFAULT_PROFILE) {}

	route(ctx: RouteContext): RoutingDecision {
		const tier = this.profile.roles[ctx.role];
		if (!tier) {
			throw new Error(`router: profile ${this.profile.name} has no role ${ctx.role}`);
		}
		// T-131 seed: 90% session cap → downgrade non-plan roles to cheap tier.
		if (
			ctx.role !== "plan" &&
			ctx.sessionCapDollars &&
			ctx.sessionCostDollars &&
			ctx.sessionCostDollars >= ctx.sessionCapDollars * 0.9
		) {
			const cheap = this.profile.cheapTier?.[ctx.role];
			if (cheap) {
				return {
					model: cheap,
					retention: tier.retention,
					profile: `${this.profile.name}:downgrade`,
				};
			}
		}
		return {
			model: tier.model,
			retention: tier.retention,
			profile: this.profile.name,
		};
	}
}

/** Test helper: in-memory router that always returns a fixed decision. */
export function fixedRouter(decision: RoutingDecision): ModelRouter {
	return {
		route: () => ({ ...decision }),
	};
}
