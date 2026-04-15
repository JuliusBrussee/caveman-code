---
created: "2026-04-16"
last_edited: "2026-04-16"
initiative: token-efficiency
status: draft
---

# Cavekit: Model Routing

## Scope

First-class architect/editor model split inside the core agent loop in `packages/agent`, not confined to the CaveKit extension's `PRESET_MODELS` table. Every LLM call is tagged with a role and a `ModelRouter` maps `(role, context, options)` to the concrete model and cache retention. CaveKit phase presets become one routing profile that feeds into the same router — no double-routing.

## Requirements

### R1: Role-tagged call surface
**Description:** Every LLM call from the agent loop carries a role tag from the set `plan | edit | explore | verify`. The role is chosen by the loop based on turn type, not by the model itself.
**Acceptance Criteria:**
- [ ] Every call through the agent loop carries exactly one of the four role tags.
- [ ] A planning turn emits role=`plan`; an edit turn emits role=`edit`.
- [ ] Attempting to emit a call without a role tag is a test-visible failure.
**Dependencies:** none

### R2: ModelRouter abstraction
**Description:** A `ModelRouter` interface in `packages/agent` accepts `(role, context, options)` and returns the model ID plus cache retention to use. The default implementation reads from `~/.cave/config.yaml` `routing:` block.
**Acceptance Criteria:**
- [ ] The agent loop calls the router for every outbound LLM request.
- [ ] Swapping the router implementation at test time redirects all calls.
- [ ] The default router reads from `~/.cave/config.yaml` on session start.
**Dependencies:** R1

### R3: Default routing profile
**Description:** Out-of-box defaults: `plan` → highest-capability available model with cache=`long`; `edit` → mid/cheap model with cache=`short`; `explore` → mid model cache=`short`; `verify` → cheap model cache=`short`. Each is overridable per role.
**Acceptance Criteria:**
- [ ] With no user config, a `plan` call resolves to the configured highest-capability model and cache=`long`.
- [ ] A `verify` call resolves to the configured cheap tier and cache=`short`.
- [ ] Overriding `edit` model in config is honored while leaving other roles at their defaults.
**Dependencies:** R2, cavekit-prompt-cache R3

### R4: Determinism of routing decisions
**Description:** Given the same role and configuration, the router returns the same model. Routing decisions never depend on wall clock or randomness.
**Acceptance Criteria:**
- [ ] 1,000 consecutive calls with the same `(role, config)` return the same model ID.
- [ ] No system time, random, or environment-noise source is read inside the router's decision path (test-enforced).
- [ ] Cache prefixes do not drift between turns due to routing.
**Dependencies:** R2

### R5: Cost-aware downgrade
**Description:** When a per-turn or per-session cost cap is approached, the router downgrades non-`plan` roles to the cheapest available tier. `plan` role calls are never silently downgraded; the user is notified.
**Acceptance Criteria:**
- [ ] At 90% of session cost cap, the next `edit` call resolves to the cheap tier.
- [ ] At 90% of session cost cap, a `plan` call either proceeds with the configured model and surfaces a user-visible warning or refuses with a confirmation prompt — never silent downgrade.
- [ ] Below 90%, routing is unaffected by cost state.
**Dependencies:** R2, cavekit-cost-trace R3

### R6: Plain CLI exposure
**Description:** Plain `cave` users (not CaveKit) get the architect/editor split by default. CLI flags: `--router-profile=<name>`, `--plan-model=<id>`, `--edit-model=<id>`.
**Acceptance Criteria:**
- [ ] A fresh install of `cave` routes a plan turn and an edit turn to different models by default.
- [ ] `--plan-model=<id>` overrides the plan model for the session.
- [ ] `--router-profile=<name>` selects a named profile from config.
**Dependencies:** R2, R3

### R7: CaveKit preset compatibility
**Description:** CaveKit's `PRESET_MODELS` becomes one routing profile that feeds into the `ModelRouter`. No double-routing. No regressions in existing CaveKit phase behavior.
**Acceptance Criteria:**
- [ ] A CaveKit phase call passes through exactly one router lookup, not two.
- [ ] The existing CaveKit phase→model mappings produce identical results under the new router.
- [ ] Disabling the CaveKit extension does not disable role-based routing for plain `cave`.
**Dependencies:** R2

## Out of Scope

- Auto-selecting models by content quality (no LLM-as-judge to pick a model).
- Cross-provider failover.
- Bandit-style adaptive routing.
- Runtime model fine-tuning.

## Cross-References

- See also: cavekit-prompt-cache.md (R1 role tags drive R3 per-task cache retention).
- See also: cavekit-cost-trace.md (R5 downgrade depends on cap state; R3 caps consume this kit's routing decisions).
- See also: cavekit-localizer-verifier.md (uses the `verify` role for executable verifier passes).

## Source

- `context/refs/research-brief-token-efficiency.md` — Architect/editor split section; Q2 locked decision (split lives in core agent loop, not just CaveKit).

## Changelog

| Date | Change |
|------|--------|
| 2026-04-16 | Initial draft |
