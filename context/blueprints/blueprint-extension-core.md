---
created: 2026-04-08
last_edited: 2026-04-08
status: draft
domain: extension-core
depends_on:
  - fork-identity
---

# Blueprint: Extension Core

## Scope

This blueprint covers the foundational infrastructure of the CaveKit extension (`@cavekit/pi-sdd`): the extension entry point, configuration system, type definitions, skill bundling, command registration mechanism, and lifecycle hooks (compaction protection, resource discovery, subagent context injection). It defines the skeleton that all commands (blueprint-extension-commands) and UI surfaces (blueprint-extension-ui) build upon.

The extension MUST be installable on both Cave Pi and vanilla Pi, degrading gracefully when the thin fork's native features are absent.

## Requirements

### R1: Extension Entry Point

**Description:** The extension exports a default function that receives the host agent's extension API and bootstraps all CaveKit functionality: config loading, command registration, hook registration, and resource discovery.

**Acceptance Criteria:**
- [ ] AC-1: The extension loads successfully when installed on the host agent (both Cave Pi and vanilla Pi) without errors at startup.
- [ ] AC-2: All registered commands (defined in blueprint-extension-commands) are available after extension initialization.
- [ ] AC-3: All registered hooks (R5, R6, R7) are active after extension initialization.
- [ ] AC-4: The extension emits no errors or warnings when the host agent is vanilla Pi (thin fork features absent).

### R2: Configuration System

**Description:** CaveKit loads configuration from a project-local location and a global user-level location. Project-local values override global values. Sensible defaults apply when no configuration file exists.

**Acceptance Criteria:**
- [ ] AC-1: When no configuration file exists at either location, all settings use documented default values.
- [ ] AC-2: A project-local configuration file overrides values from the global configuration file for any keys present in both.
- [ ] AC-3: The configuration exposes at minimum these settings: model preset (with at least 4 named presets), tier gate mode, tier gate model identifier, maximum retries, task timeout, maximum iterations, caveman-for-subagents toggle, scoped context toggle.
- [ ] AC-4: Running the config command (defined in blueprint-extension-commands R9) displays the resolved configuration including which values came from which source.

### R3: Type Definitions

**Description:** The extension defines shared types used across commands, core modules, and widgets. These types represent kits, requirements, acceptance criteria, build sites, tasks, waves, tiers, findings, and configuration.

**Acceptance Criteria:**
- [ ] AC-1: A Kit type exists with fields for: domain name, a list of requirements, and an out-of-scope section.
- [ ] AC-2: A Requirement type exists with fields for: unique identifier, name, description, and a list of acceptance criteria.
- [ ] AC-3: An AcceptanceCriterion type exists with fields for: unique identifier, description, and pass/fail status.
- [ ] AC-4: A BuildSite type exists with fields for: name, a list of tasks, tier assignments, and dependency edges.
- [ ] AC-5: A BuildTask type exists with fields for: unique identifier, name, associated acceptance criteria, tier number, status (pending/in-progress/complete/failed/blocked), and retry count.
- [ ] AC-6: A Finding type exists with fields for: description, severity level (P0/P1/P2/P3), and associated requirement reference.

### R4: Skill Bundling

**Description:** The extension bundles all CaveKit methodology skills so they are discoverable by the host agent's resource loader without requiring separate installation.

**Acceptance Criteria:**
- [ ] AC-1: The extension package includes all CaveKit skill files (core methodology, validation-first, writing, context architecture, peer review, prompt pipeline, convergence monitoring, revision, documentation inversion, implementation tracking, brownfield adoption, speculative pipeline, peer review loop, UI craft, and CaveKit writing).
- [ ] AC-2: Bundled skills are discoverable by the host agent's resource/skill discovery mechanism after extension initialization.
- [ ] AC-3: Skill content is read-only at runtime (the extension does not modify bundled skill files).

### R5: Compaction Protection Hook

**Description:** A hook fires before session compaction to ensure that SDD-critical state (active kit references, current build phase, build progress, loop log entries) survives compaction and is available in the post-compaction context.

**Acceptance Criteria:**
- [ ] AC-1: When a compaction event occurs during an active SDD workflow, the post-compaction context contains: the current Hunt phase, references to active kits, and build progress status.
- [ ] AC-2: When no SDD workflow is active, the hook does not inject any additional compaction content.
- [ ] AC-3: The hook does not prevent or delay the compaction process.

### R6: Resource Discovery Hook

**Description:** A hook responds to resource discovery events by registering the extension's bundled skill directory paths with the host agent.

**Acceptance Criteria:**
- [ ] AC-1: After extension initialization, the host agent's resource loader includes the extension's skill directory in its search paths.
- [ ] AC-2: Skills bundled with the extension appear in any skill listing or discovery mechanism the host agent provides.

### R7: Subagent Context Injection Hook

**Description:** A hook fires before subagent dispatch to inject relevant context (design constraints from DESIGN.md, relevant kit sections, build state) into the subagent's prompt.

**Acceptance Criteria:**
- [ ] AC-1: When a DESIGN.md file exists in the project and a subagent is being dispatched, the subagent's initial context includes design constraint information from that file.
- [ ] AC-2: When a build is in progress and a subagent is dispatched for a specific task, only the kit sections relevant to that task are injected (scoped context), not all kits.
- [ ] AC-3: When scoped context is disabled in configuration, the full kit content is injected rather than scoped subsets.
- [ ] AC-4: When no SDD workflow is active, the hook does not inject any additional context.

### R8: Vanilla Pi Compatibility

**Description:** The extension operates correctly on vanilla Pi (without the thin fork), degrading gracefully when fork-specific features are absent.

**Acceptance Criteria:**
- [ ] AC-1: The extension loads and initializes without error on vanilla Pi.
- [ ] AC-2: All slash commands are functional on vanilla Pi.
- [ ] AC-3: Features that depend on the thin fork (native cave mode settings) degrade silently rather than producing errors.

## Out of Scope

- Individual command implementations (draft, architect, build, etc.) -- see blueprint-extension-commands
- Widget rendering and TUI surfaces -- see blueprint-extension-ui
- npm package publishing mechanics
- MCP server integration (per PRD Decision 2: no MCP)
- Command safety gating (`commandGate` setting) — deferred to a future iteration

## Cross-References

- blueprint-fork-identity: Provides the host agent infrastructure and package scope
- blueprint-cave-mode: The compaction hook (R5) must be aware of cave mode's compaction modifications to avoid conflicts
- blueprint-extension-commands: Depends on extension-core for config, types, hooks, and command registration
- blueprint-extension-ui: Depends on extension-core for types and the extension API surface
- PRD reference: Part 2 sections 2.1, 2.2, 2.9; Part 4 Decision 2 (no MCP), Decision 5 (vanilla Pi compatibility)
- Context Architecture skill: Source of truth for the 4-tier information hierarchy used by scoped context
- Documentation Inversion skill: Source of truth for CLAUDE.md and skill discovery patterns

## Changelog

| Date | Change |
|------|--------|
| 2026-04-08 | Initial draft |
