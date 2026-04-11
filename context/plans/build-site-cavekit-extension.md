# Build Site: CaveKit Extension Delivery
**Generated:** 2026-04-12
**Status:** Ready for BUILD phase


## Tier 0 — Foundation (no dependencies)

### T-001: Fork identity naming, scope, config dir, and license baseline
**Kit Refs:** fork-identity/R1 (AC-1, AC-2, AC-3), fork-identity/R2 (AC-1, AC-2, AC-3), fork-identity/R3 (AC-1, AC-2, AC-3), fork-identity/R6 (AC-1, AC-2)
**Dependencies:** none
**Complexity:** M
**Status:** pending

Establish fork-facing identity primitives: binary naming, package scope rename, config directory, upstream license preservation. Creates single source-of-truth for all commands and config discovery.

---

### T-002: Upstream remote tracking and fork sync metadata
**Kit Refs:** fork-identity/R5 (AC-1, AC-2, AC-3)
**Dependencies:** none
**Complexity:** S
**Status:** pending

Define repository-level upstream tracking for explicit fork maintenance and auditable sync semantics without leaking ambiguity into user identity.

---

### T-003: Extension entry point, configuration system, and shared types
**Kit Refs:** extension-core/R1 (AC-1, AC-2, AC-3, AC-4), extension-core/R2 (AC-1, AC-2, AC-3, AC-4), extension-core/R3 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6)
**Dependencies:** none
**Complexity:** L
**Status:** pending

Create extension runtime foundation: loadable entry point, config resolution, strongly typed contracts. Prerequisites for all other extension features.

---

### T-004: Skill bundling, resource discovery, and vanilla Pi compatibility
**Kit Refs:** extension-core/R4 (AC-1, AC-2, AC-3), extension-core/R6 (AC-1, AC-2), extension-core/R8 (AC-1, AC-2, AC-3)
**Dependencies:** none
**Complexity:** M
**Status:** pending

Provide packaging layer for bundled CaveKit resources with clean degradation when running on vanilla Pi.

---

### T-006: Kit parser, build-site parser, and format/path consistency
**Kit Refs:** extension-commands/R12 (AC-1, AC-2, AC-3), extension-commands/R13 (AC-1, AC-2, AC-3), extension-commands/R18 (AC-1, AC-2), extension-commands/R19 (AC-1, AC-2)
**Dependencies:** none
**Complexity:** L
**Status:** pending

Implement canonical parsing for kit files and build sites with deterministic path resolution and output consistency.

---

### T-007: Subagent dispatch baseline, safe staging, and stderr handling
**Kit Refs:** extension-commands/R20 (AC-1, AC-2), extension-commands/R21 (AC-1, AC-2), extension-commands/R22 (AC-1, AC-2)
**Dependencies:** none
**Complexity:** M
**Status:** pending

Define subagent process invocation baseline with git-safe staging and robust stderr capture for all downstream execution.

---


## Tier 1

### T-005: Compaction protection and subagent context injection hooks
**Kit Refs:** extension-core/R5 (AC-1, AC-2, AC-3), extension-core/R7 (AC-1, AC-2, AC-3, AC-4)
**Dependencies:** T-003
**Complexity:** M
**Status:** pending

Add runtime hooks protecting CaveKit context from compaction loss and injecting scoped build context into subagent execution.

---

### T-008: Draft command workflow
**Kit Refs:** extension-commands/R1 (AC-1, AC-2, AC-3, AC-4, AC-5)
**Dependencies:** T-003, T-006
**Complexity:** M
**Status:** pending

Implement /ck:draft end-to-end: natural-language prompt to kit artifacts with canonical parser format and configured paths.

---

### T-009: Architect command and build-site generation workflow
**Kit Refs:** extension-commands/R2 (AC-1, AC-2, AC-3, AC-4, AC-5)
**Dependencies:** T-003, T-006
**Complexity:** L
**Status:** pending

Implement /ck:architect to transform approved kits into dependency-ordered build sites with stable plan format.

---

### T-010: Config, progress, and help command suite
**Kit Refs:** extension-commands/R9 (AC-1, AC-2, AC-3), extension-commands/R10 (AC-1, AC-2, AC-3), extension-commands/R11 (AC-1, AC-2)
**Dependencies:** T-003
**Complexity:** S
**Status:** pending

Deliver lightweight config inspection, progress reporting, and help commands for operator visibility.

---

### T-011: Research and design command surfaces
**Kit Refs:** extension-commands/R7 (AC-1, AC-2, AC-3), extension-commands/R8 (AC-1, AC-2, AC-3)
**Dependencies:** T-003, T-006
**Complexity:** M
**Status:** pending

Implement /ck:research and /ck:design as structured, parser-compatible discovery and design generators.

---

### T-012: Scoped context builder and LLM-callable tool surface
**Kit Refs:** extension-commands/R14 (AC-1, AC-2, AC-3), extension-commands/R16 (AC-1, AC-2, AC-3, AC-4)
**Dependencies:** T-003, T-006, T-007
**Complexity:** L
**Status:** pending

Build scoped-context assembly and expose LLM-callable tools for bounded programmatic kit/build state inspection.

---

### T-013: Cave-mode runtime injection and graceful degradation
**Kit Refs:** cave-mode/R1 (AC-1, AC-2, AC-3, AC-4), cave-mode/R6 (AC-1, AC-2)
**Dependencies:** T-003, T-005
**Complexity:** M
**Status:** pending

Implement cave-mode system prompt injection with fail-open degradation for safety and compatibility.

---

### T-014: Cave-mode intensity toggle and settings manager integration
**Kit Refs:** cave-mode/R2 (AC-1, AC-2, AC-3, AC-4, AC-5), cave-mode/R3 (AC-1, AC-2, AC-3)
**Dependencies:** T-003, T-013
**Complexity:** M
**Status:** pending

Add user-facing controls for cave-mode intensity with persistent settings and command-line discoverability.

---

### T-025: Startup banner and branded launch surface
**Kit Refs:** fork-identity/R4 (AC-1, AC-2, AC-3)
**Dependencies:** T-001
**Complexity:** S
**Status:** pending

Implement startup banner aligned with fork identity, shipped independently of full extension feature completion.

---


## Tier 2

### T-015: Caveman compaction and tool-result compression pipeline
**Kit Refs:** cave-mode/R4 (AC-1, AC-2, AC-3, AC-4), cave-mode/R5 (AC-1, AC-2, AC-3, AC-4, AC-5)
**Dependencies:** T-012, T-013
**Complexity:** L
**Status:** pending

Implement caveman-aware compaction and tool-result compression integrated with actual agent execution surfaces.

---

### T-016: Build command orchestration engine
**Kit Refs:** extension-commands/R3 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7)
**Dependencies:** T-008, T-009, T-012, T-007
**Complexity:** L
**Status:** pending

Implement /ck:build as main execution backbone: reads build sites, dispatches tiers, coordinates subagents, persists progress.

---

### T-021: Build dashboard widget and keyboard shortcuts
**Kit Refs:** extension-ui/R1 (AC-1, AC-2, AC-3, AC-4), extension-ui/R5 (AC-1, AC-2, AC-3)
**Dependencies:** T-003, T-016
**Complexity:** M
**Status:** pending

Deliver persistent build dashboard widget and keyboard shortcut registration for session visibility.

---

### T-022: Kit reviewer overlay and draft/architect integration
**Kit Refs:** extension-ui/R2 (AC-1, AC-2, AC-3, AC-4), extension-ui/R6 (AC-1, AC-2)
**Dependencies:** T-003, T-008, T-009
**Complexity:** M
**Status:** pending

Implement interactive kit review overlay wired into draft-to-architect handoff for approval-based kit filtering.

---

### T-024: Dependency graph visualization
**Kit Refs:** extension-ui/R4 (AC-1, AC-2, AC-3)
**Dependencies:** T-003, T-009
**Complexity:** M
**Status:** pending

Implement dependency graph visualization for architected build sites showing task tiers and directional edges.

---


## Tier 3

### T-017: Tier gate review engine
**Kit Refs:** extension-commands/R4 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7)
**Dependencies:** T-016, T-012
**Complexity:** L
**Status:** pending

Add tier gate review process producing severity-ranked findings with machine-actionable continue/fix/abort outcomes.

---

### T-018: Convergence monitoring and convergence command
**Kit Refs:** extension-commands/R5 (AC-1, AC-2, AC-3, AC-4, AC-5), extension-commands/R15 (AC-1, AC-2, AC-3, AC-4)
**Dependencies:** T-016
**Complexity:** M
**Status:** pending

Implement convergence analysis over build iterations with dedicated monitoring and command surfaces.

---

### T-019: Failed task retry workflow
**Kit Refs:** extension-commands/R17 (AC-1, AC-2, AC-3)
**Dependencies:** T-016, T-007
**Complexity:** M
**Status:** pending

Implement retry handling for failed build tasks with correct dependency checks and safe git behavior.

---

### T-023: Tier gate findings overlay
**Kit Refs:** extension-ui/R3 (AC-1, AC-2, AC-3, AC-4)
**Dependencies:** T-003, T-017
**Complexity:** M
**Status:** pending

Build UI overlay for tier gate findings with severity ranking and explicit continue/fix/abort selection.

---


## Tier 4

### T-020: Inspect command and spec-to-build gap analysis
**Kit Refs:** extension-commands/R6 (AC-1, AC-2, AC-3, AC-4, AC-5)
**Dependencies:** T-009, T-016, T-017, T-018
**Complexity:** L
**Status:** pending

Implement /ck:inspect to compare specs against build output with implementation gap synthesis and traceability.

---


## Coverage Matrix

| Requirement | AC | Task |
|---|---|---|
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

## Machine-Readable Task List

### Tier 0

- T-001: Fork identity naming, scope, config dir, and license baseline
  **Kits:** fork-identity/R1, fork-identity/R2, fork-identity/R3, fork-identity/R6
  **Complexity:** M

- T-002: Upstream remote tracking and fork sync metadata
  **Kits:** fork-identity/R5
  **Complexity:** S

- T-003: Extension entry point, configuration system, and shared types
  **Kits:** extension-core/R1, extension-core/R2, extension-core/R3
  **Complexity:** L

- T-004: Skill bundling, resource discovery, and vanilla Pi compatibility
  **Kits:** extension-core/R4, extension-core/R6, extension-core/R8
  **Complexity:** M

- T-006: Kit parser, build-site parser, and format/path consistency
  **Kits:** extension-commands/R12, extension-commands/R13, extension-commands/R18, extension-commands/R19
  **Complexity:** L

- T-007: Subagent dispatch baseline, safe staging, and stderr handling
  **Kits:** extension-commands/R20, extension-commands/R21, extension-commands/R22
  **Complexity:** M

### Tier 1

- T-005: Compaction protection and subagent context injection hooks (blockedBy: T-003)
  **Kits:** extension-core/R5, extension-core/R7
  **Complexity:** M

- T-008: Draft command workflow (blockedBy: T-003, T-006)
  **Kits:** extension-commands/R1
  **Complexity:** M

- T-009: Architect command and build-site generation workflow (blockedBy: T-003, T-006)
  **Kits:** extension-commands/R2
  **Complexity:** L

- T-010: Config, progress, and help command suite (blockedBy: T-003)
  **Kits:** extension-commands/R9, extension-commands/R10, extension-commands/R11
  **Complexity:** S

- T-011: Research and design command surfaces (blockedBy: T-003, T-006)
  **Kits:** extension-commands/R7, extension-commands/R8
  **Complexity:** M

- T-012: Scoped context builder and LLM-callable tool surface (blockedBy: T-003, T-006, T-007)
  **Kits:** extension-commands/R14, extension-commands/R16
  **Complexity:** L

- T-013: Cave-mode runtime injection and graceful degradation (blockedBy: T-003, T-005)
  **Kits:** cave-mode/R1, cave-mode/R6
  **Complexity:** M

- T-014: Cave-mode intensity toggle and settings manager integration (blockedBy: T-003, T-013)
  **Kits:** cave-mode/R2, cave-mode/R3
  **Complexity:** M

- T-025: Startup banner and branded launch surface (blockedBy: T-001)
  **Kits:** fork-identity/R4
  **Complexity:** S

### Tier 2

- T-015: Caveman compaction and tool-result compression pipeline (blockedBy: T-012, T-013)
  **Kits:** cave-mode/R4, cave-mode/R5
  **Complexity:** L

- T-016: Build command orchestration engine (blockedBy: T-008, T-009, T-012, T-007)
  **Kits:** extension-commands/R3
  **Complexity:** L

- T-021: Build dashboard widget and keyboard shortcuts (blockedBy: T-003, T-016)
  **Kits:** extension-ui/R1, extension-ui/R5
  **Complexity:** M

- T-022: Kit reviewer overlay and draft/architect integration (blockedBy: T-003, T-008, T-009)
  **Kits:** extension-ui/R2, extension-ui/R6
  **Complexity:** M

- T-024: Dependency graph visualization (blockedBy: T-003, T-009)
  **Kits:** extension-ui/R4
  **Complexity:** M

### Tier 3

- T-017: Tier gate review engine (blockedBy: T-016, T-012)
  **Kits:** extension-commands/R4
  **Complexity:** L

- T-018: Convergence monitoring and convergence command (blockedBy: T-016)
  **Kits:** extension-commands/R5, extension-commands/R15
  **Complexity:** M

- T-019: Failed task retry workflow (blockedBy: T-016, T-007)
  **Kits:** extension-commands/R17
  **Complexity:** M

- T-023: Tier gate findings overlay (blockedBy: T-003, T-017)
  **Kits:** extension-ui/R3
  **Complexity:** M

### Tier 4

- T-020: Inspect command and spec-to-build gap analysis (blockedBy: T-009, T-016, T-017, T-018)
  **Kits:** extension-commands/R6
  **Complexity:** L
