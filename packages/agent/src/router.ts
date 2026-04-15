// T-011, T-012, T-013: ModelRouter interface + deterministic default impl.
//
// R2 design goals:
// - ModelRouter is an interface. The agent loop calls it for every
//   outbound request, and tests can swap it.
// - Default impl is config-backed and deterministic: no Date, no random,
//   no env reads inside the hot path.
// - R4: 1000 identical calls return the identical decision.
// - R5 (cost-aware downgrade) lands in T-131; this shape leaves room.

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
	/** Optional CaveKit phase id (e.g. "draft", "architect"). */
	cavekitPhase?: string;
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
	/** Optional CaveKit phase → role folding (R7). */
	cavekitPhaseRole?: Record<string, Role>;
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
		const effectiveRole = this.resolveRole(ctx);
		const tier = this.profile.roles[effectiveRole];
		if (!tier) {
			throw new Error(`router: profile ${this.profile.name} has no role ${effectiveRole}`);
		}
		// T-131 seed: 90% session cap → downgrade non-plan roles to cheap tier.
		if (
			effectiveRole !== "plan" &&
			ctx.sessionCapDollars &&
			ctx.sessionCostDollars &&
			ctx.sessionCostDollars >= ctx.sessionCapDollars * 0.9
		) {
			const cheap = this.profile.cheapTier?.[effectiveRole];
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

	private resolveRole(ctx: RouteContext): Role {
		if (ctx.cavekitPhase && this.profile.cavekitPhaseRole?.[ctx.cavekitPhase]) {
			return this.profile.cavekitPhaseRole[ctx.cavekitPhase];
		}
		return ctx.role;
	}
}

/** Test helper: in-memory router that always returns a fixed decision. */
export function fixedRouter(decision: RoutingDecision): ModelRouter {
	return {
		route: () => ({ ...decision }),
	};
}
