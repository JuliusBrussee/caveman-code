# Build Site: CaveKit Extension Delivery
**Generated:** 2026-04-11
**Source:** /Users/julb/Desktop/GitHub/caveman-cli/context/blueprints
**Total Tasks:** 25
**Tiers:** 5
**Coverage:** 167/167 ACs mapped

## Tier 0 — Foundation (no dependencies)

### T-001: Fork identity naming, scope, config dir, and license baseline
**Kit Refs:** fork-identity/R1 (AC-1, AC-2, AC-3), fork-identity/R2 (AC-1, AC-2, AC-3), fork-identity/R3 (AC-1, AC-2, AC-3), fork-identity/R6 (AC-1, AC-2)
**Dependencies:** none
**Complexity:** M
**Status:** pending

Establish fork-facing identity primitives that every later feature assumes: binary naming, package scope rename, default configuration directory, and preservation of upstream license obligations. This task creates single source-of-truth identifiers so commands, config discovery, packaging, and startup surfaces all resolve to consistent fork identity semantics.

---

### T-002: Upstream remote tracking and fork sync metadata
**Kit Refs:** fork-identity/R5 (AC-1, AC-2, AC-3)
**Dependencies:** none
**Complexity:** S
**Status:** pending

Define repository-level upstream tracking expectations so fork maintenance remains explicit and auditable. This task covers remote naming, tracking references, and discoverable sync metadata needed to keep fork relationship intact without leaking ambiguity into user-facing identity.

---

### T-003: Extension entry point, configuration system, and shared types
**Kit Refs:** extension-core/R1 (AC-1, AC-2, AC-3, AC-4), extension-core/R2 (AC-1, AC-2, AC-3, AC-4), extension-core/R3 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6)
**Dependencies:** none
**Complexity:** L
**Status:** pending

Create extension runtime foundation: loadable entry point, configuration resolution, and strongly typed shared contracts used across commands, UI, and runtime hooks. This task is prerequisite for nearly every other extension capability because it defines how features register, how settings flow, and how data structures stay consistent across boundaries.

---

### T-004: Skill bundling, resource discovery, and vanilla Pi compatibility
**Kit Refs:** extension-core/R4 (AC-1, AC-2, AC-3), extension-core/R6 (AC-1, AC-2), extension-core/R8 (AC-1, AC-2, AC-3)
**Dependencies:** none
**Complexity:** M
**Status:** pending

Provide packaging and compatibility layer for bundled CaveKit resources while preserving operation in vanilla Pi-compatible environments. This task ensures skills and related assets can be discovered reliably, and that extension behavior degrades cleanly when host capability surface is narrower than full CaveKit mode.

---

### T-006: Kit parser, build-site parser, and format/path consistency
**Kit Refs:** extension-commands/R12 (AC-1, AC-2, AC-3), extension-commands/R13 (AC-1, AC-2, AC-3), extension-commands/R18 (AC-1, AC-2), extension-commands/R19 (AC-1, AC-2)
**Dependencies:** none
**Complexity:** L
**Status:** pending

Implement canonical parsing and path resolution for kit files and build sites, including consistency rules for draft output and generated plan locations. This task creates deterministic structured IO contracts that later commands rely on for reading kits, generating plans, and keeping file layout stable across phases.

---

### T-007: Subagent dispatch baseline, safe staging, and stderr handling
**Kit Refs:** extension-commands/R20 (AC-1, AC-2), extension-commands/R21 (AC-1, AC-2), extension-commands/R22 (AC-1, AC-2)
**Dependencies:** none
**Complexity:** M
**Status:** pending

Define subagent process invocation baseline, including binary name selection, git-safe staging constraints for build commits, and robust stderr capture behavior. This task is isolated early because build execution, retry, and tool-call workflows all depend on reliable subprocess semantics and non-destructive git operations.

---

## Tier 1 — Runtime hooks and parsing

### T-005: Compaction protection and subagent context injection hooks
**Kit Refs:** extension-core/R5 (AC-1, AC-2, AC-3), extension-core/R7 (AC-1, AC-2, AC-3, AC-4)
**Dependencies:** T-003
**Complexity:** M
**Status:** pending

Add runtime hooks that protect critical CaveKit context from compaction loss and inject scoped build context into subagent execution. This task closes core lifecycle gaps between static configuration and actual runtime behavior, enabling downstream command orchestration and cave-mode behavior to operate with correct contextual guarantees.

---

### T-008: Draft command workflow
**Kit Refs:** extension-commands/R1 (AC-1, AC-2, AC-3, AC-4, AC-5)
**Dependencies:** T-003, T-006
**Complexity:** M
**Status:** pending

Implement `/ck:draft` end-to-end flow from natural-language prompt to generated kit artifacts, using canonical parser-facing output format and configured project paths. This task owns user-visible draft lifecycle behavior, including input handling, kit generation contract, write targets, and command-level completion semantics.

---

### T-009: Architect command and build-site generation workflow
**Kit Refs:** extension-commands/R2 (AC-1, AC-2, AC-3, AC-4, AC-5)
**Dependencies:** T-003, T-006
**Complexity:** L
**Status:** pending

Implement `/ck:architect` so approved kits can be transformed into dependency-ordered build sites using parser-backed plan format and stable output paths. This task turns specification artifacts into execution-ready plans and creates data consumed later by build execution, graph visualization, and inspection.

---

### T-010: Config, progress, and help command suite
**Kit Refs:** extension-commands/R9 (AC-1, AC-2, AC-3), extension-commands/R10 (AC-1, AC-2, AC-3), extension-commands/R11 (AC-1, AC-2)
**Dependencies:** T-003
**Complexity:** S
**Status:** pending

Deliver lightweight command surfaces for configuration inspection, build/session progress reporting, and user help. This task provides operator visibility and discoverability around extension state without depending on full build orchestration, making it safe to parallelize after shared config/types exist.

---

### T-011: Research and design command surfaces
**Kit Refs:** extension-commands/R7 (AC-1, AC-2, AC-3), extension-commands/R8 (AC-1, AC-2, AC-3)
**Dependencies:** T-003, T-006
**Complexity:** M
**Status:** pending

Implement `/ck:research` and `/ck:design` command workflows as structured, parser-compatible generators for discovery and design artifacts. This task expands non-build authoring capabilities while reusing common command foundation, path resolution, and structured output contracts.

---

### T-012: Scoped context builder and LLM-callable tool surface
**Kit Refs:** extension-commands/R14 (AC-1, AC-2, AC-3), extension-commands/R16 (AC-1, AC-2, AC-3, AC-4)
**Dependencies:** T-003, T-006, T-007
**Complexity:** L
**Status:** pending

Build scoped-context assembly and expose LLM-callable tools that let agents inspect kit/build state through bounded, deterministic interfaces. This task is central integration glue between specs, build execution, subagents, and UI because it defines what context is handed to automation and how programmatic access remains structured.

---

### T-013: Cave-mode runtime injection and graceful degradation
**Kit Refs:** cave-mode/R1 (AC-1, AC-2, AC-3, AC-4), cave-mode/R6 (AC-1, AC-2)
**Dependencies:** T-003, T-005
**Complexity:** M
**Status:** pending

Implement cave-mode runtime behavior for system prompt injection while ensuring fail-open degradation when cave-specific facilities are unavailable. This task defines baseline cave-mode semantics and fallback behavior so later controls, compaction features, and tool compression can layer on top without threatening host stability.

---

### T-014: Cave-mode intensity toggle and settings manager integration
**Kit Refs:** cave-mode/R2 (AC-1, AC-2, AC-3, AC-4, AC-5), cave-mode/R3 (AC-1, AC-2, AC-3)
**Dependencies:** T-003, T-013
**Complexity:** M
**Status:** pending

Add user-facing controls for cave-mode intensity and settings management so mode selection is discoverable, persistent, and command-accessible. This task covers command/UI-adjacent control flow, setting persistence, and state exposure needed for practical adoption of cave-mode beyond hardcoded defaults.

---

### T-025: Startup banner and branded launch surface
**Kit Refs:** fork-identity/R4 (AC-1, AC-2, AC-3)
**Dependencies:** T-001
**Complexity:** S
**Status:** pending

Implement startup banner and branded launch presentation aligned with fork identity primitives established earlier. This task is isolated from deeper command/runtime behavior because it only needs finalized naming and should be able to ship independently of full extension feature completion.

---

## Tier 2 — Execution and UI base

### T-015: Caveman compaction and tool-result compression pipeline
**Kit Refs:** cave-mode/R4 (AC-1, AC-2, AC-3, AC-4), cave-mode/R5 (AC-1, AC-2, AC-3, AC-4, AC-5)
**Dependencies:** T-012, T-013
**Complexity:** L
**Status:** pending

Implement caveman-aware compaction and tool-result compression pipeline so prompt budget savings apply both to model context and tool output flows. This task depends on runtime cave-mode semantics and callable tool/context plumbing because compression must integrate safely with actual agent execution surfaces rather than operate as isolated text transforms.

---

### T-016: Build command orchestration engine
**Kit Refs:** extension-commands/R3 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7)
**Dependencies:** T-008, T-009, T-012, T-007
**Complexity:** L
**Status:** pending

Implement `/ck:build` as orchestration engine that reads build sites, dispatches wave/tier execution, coordinates subagents, and persists progress/status. This task is main execution backbone for CaveKit and is intentionally separated from review, convergence, and retry so core run loop can stabilize before adjacent control logic is added.

---

### T-021: Build dashboard widget and keyboard shortcuts
**Kit Refs:** extension-ui/R1 (AC-1, AC-2, AC-3, AC-4), extension-ui/R5 (AC-1, AC-2, AC-3)
**Dependencies:** T-003, T-016
**Complexity:** M
**Status:** pending

Deliver persistent build dashboard widget plus shortcut registration so active build state is visible and quickly accessible during sessions. This task depends on build orchestration because dashboard content and toggle behavior need live execution data rather than placeholder wiring.

---

### T-022: Kit reviewer overlay and draft/architect integration
**Kit Refs:** extension-ui/R2 (AC-1, AC-2, AC-3, AC-4), extension-ui/R6 (AC-1, AC-2)
**Dependencies:** T-003, T-008, T-009
**Complexity:** M
**Status:** pending

Implement interactive kit review overlay and wire it into draft-to-architect handoff so approval decisions directly determine which kits proceed to planning. This task sits after both draft and architect workflows exist because it mediates real artifacts between those phases rather than mocking either side.

---

### T-024: Dependency graph visualization
**Kit Refs:** extension-ui/R4 (AC-1, AC-2, AC-3)
**Dependencies:** T-003, T-009
**Complexity:** M
**Status:** pending

Implement dependency graph visualization for architected build sites, showing task grouping by tier and directional dependency edges. This task depends on build-site generation and shared UI contracts because graph structure must reflect real plan data rather than inferred placeholders.

---

## Tier 3 — Execution control and review

### T-017: Tier gate review engine
**Kit Refs:** extension-commands/R4 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7)
**Dependencies:** T-016, T-012
**Complexity:** L
**Status:** pending

Add tier gate review process that evaluates completed build tiers, produces severity-ranked findings, and returns machine-actionable outcomes for continue, fix, or abort paths. This task sits after base build orchestration because gate reviews consume build artifacts and scoped evidence produced during actual execution.

---

### T-018: Convergence monitoring and convergence command
**Kit Refs:** extension-commands/R5 (AC-1, AC-2, AC-3, AC-4, AC-5), extension-commands/R15 (AC-1, AC-2, AC-3, AC-4)
**Dependencies:** T-016
**Complexity:** M
**Status:** pending

Implement convergence analysis over build iterations and expose it through dedicated monitoring and command surfaces. This task turns raw build history into actionable signal about progress vs. plateau, supporting operator decisions and automation loops without being coupled to individual task implementation details.

---

### T-019: Failed task retry workflow
**Kit Refs:** extension-commands/R17 (AC-1, AC-2, AC-3)
**Dependencies:** T-016, T-007
**Complexity:** M
**Status:** pending

Implement retry handling for failed build tasks with correct dependency checks, subprocess semantics, and safe git behavior. This task extends base build engine with recovery capability once failure states and dispatch contracts are already established.

---

### T-023: Tier gate findings overlay
**Kit Refs:** extension-ui/R3 (AC-1, AC-2, AC-3, AC-4)
**Dependencies:** T-003, T-017
**Complexity:** M
**Status:** pending

Build UI overlay for tier gate findings so users can inspect severity-ranked review output and explicitly choose continue, fix, or abort. This task depends on review engine completion because overlay semantics and actions are driven by actual gate outcomes.

---

## Tier 4 — Inspection and verification

### T-020: Inspect command and spec-to-build gap analysis
**Kit Refs:** extension-commands/R6 (AC-1, AC-2, AC-3, AC-4, AC-5)
**Dependencies:** T-009, T-016, T-017, T-018
**Complexity:** L
**Status:** pending

Implement `/ck:inspect` to compare specification artifacts against build output, synthesize findings, and report implementation gaps with traceability. This task intentionally lands last because meaningful inspection requires stable plan generation, completed build evidence, gate review output, and convergence history.

---

## Coverage Matrix
| Req | AC | Task |
|-----|----|------|
| cave-mode/R1 | AC-1 | T-013 |
| cave-mode/R1 | AC-2 | T-013 |
| cave-mode/R1 | AC-3 | T-013 |
| cave-mode/R1 | AC-4 | T-013 |
| cave-mode/R2 | AC-1 | T-014 |
| cave-mode/R2 | AC-2 | T-014 |
| cave-mode/R2 | AC-3 | T-014 |
| cave-mode/R2 | AC-4 | T-014 |
| cave-mode/R2 | AC-5 | T-014 |
| cave-mode/R3 | AC-1 | T-014 |
| cave-mode/R3 | AC-2 | T-014 |
| cave-mode/R3 | AC-3 | T-014 |
| cave-mode/R4 | AC-1 | T-015 |
| cave-mode/R4 | AC-2 | T-015 |
| cave-mode/R4 | AC-3 | T-015 |
| cave-mode/R4 | AC-4 | T-015 |
| cave-mode/R5 | AC-1 | T-015 |
| cave-mode/R5 | AC-2 | T-015 |
| cave-mode/R5 | AC-3 | T-015 |
| cave-mode/R5 | AC-4 | T-015 |
| cave-mode/R5 | AC-5 | T-015 |
| cave-mode/R6 | AC-1 | T-013 |
| cave-mode/R6 | AC-2 | T-013 |
| extension-commands/R1 | AC-1 | T-008 |
| extension-commands/R1 | AC-2 | T-008 |
| extension-commands/R1 | AC-3 | T-008 |
| extension-commands/R1 | AC-4 | T-008 |
| extension-commands/R1 | AC-5 | T-008 |
| extension-commands/R2 | AC-1 | T-009 |
| extension-commands/R2 | AC-2 | T-009 |
| extension-commands/R2 | AC-3 | T-009 |
| extension-commands/R2 | AC-4 | T-009 |
| extension-commands/R2 | AC-5 | T-009 |
| extension-commands/R3 | AC-1 | T-016 |
| extension-commands/R3 | AC-2 | T-016 |
| extension-commands/R3 | AC-3 | T-016 |
| extension-commands/R3 | AC-4 | T-016 |
| extension-commands/R3 | AC-5 | T-016 |
| extension-commands/R3 | AC-6 | T-016 |
| extension-commands/R3 | AC-7 | T-016 |
| extension-commands/R4 | AC-1 | T-017 |
| extension-commands/R4 | AC-2 | T-017 |
| extension-commands/R4 | AC-3 | T-017 |
| extension-commands/R4 | AC-4 | T-017 |
| extension-commands/R4 | AC-5 | T-017 |
| extension-commands/R4 | AC-6 | T-017 |
| extension-commands/R4 | AC-7 | T-017 |
| extension-commands/R5 | AC-1 | T-018 |
| extension-commands/R5 | AC-2 | T-018 |
| extension-commands/R5 | AC-3 | T-018 |
| extension-commands/R5 | AC-4 | T-018 |
| extension-commands/R5 | AC-5 | T-018 |
| extension-commands/R6 | AC-1 | T-020 |
| extension-commands/R6 | AC-2 | T-020 |
| extension-commands/R6 | AC-3 | T-020 |
| extension-commands/R6 | AC-4 | T-020 |
| extension-commands/R6 | AC-5 | T-020 |
| extension-commands/R7 | AC-1 | T-011 |
| extension-commands/R7 | AC-2 | T-011 |
| extension-commands/R7 | AC-3 | T-011 |
| extension-commands/R8 | AC-1 | T-011 |
| extension-commands/R8 | AC-2 | T-011 |
| extension-commands/R8 | AC-3 | T-011 |
| extension-commands/R9 | AC-1 | T-010 |
| extension-commands/R9 | AC-2 | T-010 |
| extension-commands/R9 | AC-3 | T-010 |
| extension-commands/R10 | AC-1 | T-010 |
| extension-commands/R10 | AC-2 | T-010 |
| extension-commands/R10 | AC-3 | T-010 |
| extension-commands/R11 | AC-1 | T-010 |
| extension-commands/R11 | AC-2 | T-010 |
| extension-commands/R12 | AC-1 | T-006 |
| extension-commands/R12 | AC-2 | T-006 |
| extension-commands/R12 | AC-3 | T-006 |
| extension-commands/R13 | AC-1 | T-006 |
| extension-commands/R13 | AC-2 | T-006 |
| extension-commands/R13 | AC-3 | T-006 |
| extension-commands/R14 | AC-1 | T-012 |
| extension-commands/R14 | AC-2 | T-012 |
| extension-commands/R14 | AC-3 | T-012 |
| extension-commands/R15 | AC-1 | T-018 |
| extension-commands/R15 | AC-2 | T-018 |
| extension-commands/R15 | AC-3 | T-018 |
| extension-commands/R15 | AC-4 | T-018 |
| extension-commands/R16 | AC-1 | T-012 |
| extension-commands/R16 | AC-2 | T-012 |
| extension-commands/R16 | AC-3 | T-012 |
| extension-commands/R16 | AC-4 | T-012 |
| extension-commands/R17 | AC-1 | T-019 |
| extension-commands/R17 | AC-2 | T-019 |
| extension-commands/R17 | AC-3 | T-019 |
| extension-commands/R18 | AC-1 | T-006 |
| extension-commands/R18 | AC-2 | T-006 |
| extension-commands/R19 | AC-1 | T-006 |
| extension-commands/R19 | AC-2 | T-006 |
| extension-commands/R20 | AC-1 | T-007 |
| extension-commands/R20 | AC-2 | T-007 |
| extension-commands/R21 | AC-1 | T-007 |
| extension-commands/R21 | AC-2 | T-007 |
| extension-commands/R22 | AC-1 | T-007 |
| extension-commands/R22 | AC-2 | T-007 |
| extension-core/R1 | AC-1 | T-003 |
| extension-core/R1 | AC-2 | T-003 |
| extension-core/R1 | AC-3 | T-003 |
| extension-core/R1 | AC-4 | T-003 |
| extension-core/R2 | AC-1 | T-003 |
| extension-core/R2 | AC-2 | T-003 |
| extension-core/R2 | AC-3 | T-003 |
| extension-core/R2 | AC-4 | T-003 |
| extension-core/R3 | AC-1 | T-003 |
| extension-core/R3 | AC-2 | T-003 |
| extension-core/R3 | AC-3 | T-003 |
| extension-core/R3 | AC-4 | T-003 |
| extension-core/R3 | AC-5 | T-003 |
| extension-core/R3 | AC-6 | T-003 |
| extension-core/R4 | AC-1 | T-004 |
| extension-core/R4 | AC-2 | T-004 |
| extension-core/R4 | AC-3 | T-004 |
| extension-core/R5 | AC-1 | T-005 |
| extension-core/R5 | AC-2 | T-005 |
| extension-core/R5 | AC-3 | T-005 |
| extension-core/R6 | AC-1 | T-004 |
| extension-core/R6 | AC-2 | T-004 |
| extension-core/R7 | AC-1 | T-005 |
| extension-core/R7 | AC-2 | T-005 |
| extension-core/R7 | AC-3 | T-005 |
| extension-core/R7 | AC-4 | T-005 |
| extension-core/R8 | AC-1 | T-004 |
| extension-core/R8 | AC-2 | T-004 |
| extension-core/R8 | AC-3 | T-004 |
| extension-ui/R1 | AC-1 | T-021 |
| extension-ui/R1 | AC-2 | T-021 |
| extension-ui/R1 | AC-3 | T-021 |
| extension-ui/R1 | AC-4 | T-021 |
| extension-ui/R2 | AC-1 | T-022 |
| extension-ui/R2 | AC-2 | T-022 |
| extension-ui/R2 | AC-3 | T-022 |
| extension-ui/R2 | AC-4 | T-022 |
| extension-ui/R3 | AC-1 | T-023 |
| extension-ui/R3 | AC-2 | T-023 |
| extension-ui/R3 | AC-3 | T-023 |
| extension-ui/R3 | AC-4 | T-023 |
| extension-ui/R4 | AC-1 | T-024 |
| extension-ui/R4 | AC-2 | T-024 |
| extension-ui/R4 | AC-3 | T-024 |
| extension-ui/R5 | AC-1 | T-021 |
| extension-ui/R5 | AC-2 | T-021 |
| extension-ui/R5 | AC-3 | T-021 |
| extension-ui/R6 | AC-1 | T-022 |
| extension-ui/R6 | AC-2 | T-022 |
| fork-identity/R1 | AC-1 | T-001 |
| fork-identity/R1 | AC-2 | T-001 |
| fork-identity/R1 | AC-3 | T-001 |
| fork-identity/R2 | AC-1 | T-001 |
| fork-identity/R2 | AC-2 | T-001 |
| fork-identity/R2 | AC-3 | T-001 |
| fork-identity/R3 | AC-1 | T-001 |
| fork-identity/R3 | AC-2 | T-001 |
| fork-identity/R3 | AC-3 | T-001 |
| fork-identity/R4 | AC-1 | T-025 |
| fork-identity/R4 | AC-2 | T-025 |
| fork-identity/R4 | AC-3 | T-025 |
| fork-identity/R5 | AC-1 | T-002 |
| fork-identity/R5 | AC-2 | T-002 |
| fork-identity/R5 | AC-3 | T-002 |
| fork-identity/R6 | AC-1 | T-001 |
| fork-identity/R6 | AC-2 | T-001 |

## Tier 0

- T-001: Fork identity naming, scope, config dir, and license baseline --> fork-identity/R1, fork-identity/R2, fork-identity/R3, fork-identity/R6
- T-002: Upstream remote tracking and fork sync metadata --> fork-identity/R5
- T-003: Extension entry point, configuration system, and shared types --> extension-core/R1, extension-core/R2, extension-core/R3
- T-004: Skill bundling, resource discovery, and vanilla Pi compatibility --> extension-core/R4, extension-core/R6, extension-core/R8
- T-006: Kit parser, build-site parser, and format/path consistency --> extension-commands/R12, extension-commands/R13, extension-commands/R18, extension-commands/R19
- T-007: Subagent dispatch baseline, safe staging, and stderr handling --> extension-commands/R20, extension-commands/R21, extension-commands/R22

## Tier 1

- T-005: Compaction protection and subagent context injection hooks (blockedBy: T-003) --> extension-core/R5, extension-core/R7
- T-008: Draft command workflow (blockedBy: T-003, T-006) --> extension-commands/R1
- T-009: Architect command and build-site generation workflow (blockedBy: T-003, T-006) --> extension-commands/R2
- T-010: Config, progress, and help command suite (blockedBy: T-003) --> extension-commands/R9, extension-commands/R10, extension-commands/R11
- T-011: Research and design command surfaces (blockedBy: T-003, T-006) --> extension-commands/R7, extension-commands/R8
- T-012: Scoped context builder and LLM-callable tool surface (blockedBy: T-003, T-006, T-007) --> extension-commands/R14, extension-commands/R16
- T-013: Cave-mode runtime injection and graceful degradation (blockedBy: T-003, T-005) --> cave-mode/R1, cave-mode/R6
- T-014: Cave-mode intensity toggle and settings manager integration (blockedBy: T-003, T-013) --> cave-mode/R2, cave-mode/R3
- T-025: Startup banner and branded launch surface (blockedBy: T-001) --> fork-identity/R4

## Tier 2

- T-015: Caveman compaction and tool-result compression pipeline (blockedBy: T-012, T-013) --> cave-mode/R4, cave-mode/R5
- T-016: Build command orchestration engine (blockedBy: T-008, T-009, T-012, T-007) --> extension-commands/R3
- T-021: Build dashboard widget and keyboard shortcuts (blockedBy: T-003, T-016) --> extension-ui/R1, extension-ui/R5
- T-022: Kit reviewer overlay and draft/architect integration (blockedBy: T-003, T-008, T-009) --> extension-ui/R2, extension-ui/R6
- T-024: Dependency graph visualization (blockedBy: T-003, T-009) --> extension-ui/R4

## Tier 3

- T-017: Tier gate review engine (blockedBy: T-016, T-012) --> extension-commands/R4
- T-018: Convergence monitoring and convergence command (blockedBy: T-016) --> extension-commands/R5, extension-commands/R15
- T-019: Failed task retry workflow (blockedBy: T-016, T-007) --> extension-commands/R17
- T-023: Tier gate findings overlay (blockedBy: T-003, T-017) --> extension-ui/R3

## Tier 4

- T-020: Inspect command and spec-to-build gap analysis (blockedBy: T-009, T-016, T-017, T-018) --> extension-commands/R6
