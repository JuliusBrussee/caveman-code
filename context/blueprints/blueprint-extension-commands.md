---
created: 2026-04-08
last_edited: 2026-04-08
status: draft
domain: extension-commands
depends_on:
  - extension-core
---

# Blueprint: Extension Commands

## Scope

This blueprint covers all `/ck:*` slash commands that implement the CaveKit SDD workflow: draft, architect, build, inspect, research, design, config, progress, and help. It also covers the core execution machinery these commands depend on: kit and build-site parsing, wave-based parallel execution, tier gate adversarial review, convergence monitoring, and scoped context construction.

## Requirements

### R1: Draft Command (/ck:draft)

**Description:** Decomposes a natural language project description into domain kits. Each kit is a separate document with R-numbered requirements and testable acceptance criteria. After generation, kits are presented for user review.

**Acceptance Criteria:**
- [ ] AC-1: Running `/ck:draft <description>` produces one or more kit files in the project's context/kits/ directory.
- [ ] AC-2: Each generated kit file contains: a domain name, R-numbered requirements (R-001, R-002, etc.), and at least one acceptance criterion per requirement.
- [ ] AC-3: After generation, a summary is displayed showing the number of kits, total requirements, and total acceptance criteria.
- [ ] AC-4: Running `/ck:draft` without arguments displays a usage message.
- [ ] AC-5: The draft prompt incorporates CaveKit writing skill principles: implementation-agnostic requirements, testable criteria, explicit out-of-scope sections.

### R2: Architect Command (/ck:architect)

**Description:** Reads approved kits and generates a tiered build site: a task graph with dependency edges, tier assignments, and a coverage matrix ensuring every acceptance criterion maps to at least one task.

**Acceptance Criteria:**
- [ ] AC-1: Running `/ck:architect` reads all kit files from the project's context/kits/ directory.
- [ ] AC-2: The generated build site contains T-numbered tasks with tier assignments and dependency edges.
- [ ] AC-3: Every acceptance criterion from every kit maps to at least one task in the build site (complete coverage).
- [ ] AC-4: The build site is written to a file in the project's context directory.
- [ ] AC-5: Running `/ck:architect` when no kits exist displays an error message directing the user to run `/ck:draft` first.

### R3: Build Command (/ck:build)

**Description:** Executes the build site through wave-based parallel dispatch. Tasks within a wave have no mutual dependencies and execute concurrently. Each task dispatches a subagent with scoped context (only the relevant kit sections). Validation gates run after each task. Tier gates run at tier boundaries.

**Acceptance Criteria:**
- [ ] AC-1: Running `/ck:build` reads the build site and computes execution waves via topological sort of the task dependency graph.
- [ ] AC-2: Tasks within the same wave execute concurrently (not sequentially).
- [ ] AC-3: A task is not dispatched until all tasks it depends on have completed successfully.
- [ ] AC-4: Each dispatched subagent receives only the kit sections relevant to its assigned task (scoped context), not all kits.
- [ ] AC-5: After each task completes, its acceptance criteria are validated. Passing criteria are marked as complete; failing criteria cause the task to be marked as failed.
- [ ] AC-6: Failed tasks are retried up to the configured maximum retry count. After exhausting retries, the task is marked as blocked.
- [ ] AC-7: Running `/ck:build` when no build site exists displays an error directing the user to run `/ck:architect` first.

### R4: Tier Gate Review

**Description:** At the boundary between tiers in the build site, an adversarial review evaluates the work completed in that tier. The review identifies findings with severity levels (P0-P3). P0 and P1 findings trigger user intervention (approve, fix, or abort).

**Acceptance Criteria:**
- [ ] AC-1: A tier gate review is triggered automatically when the last task in a tier completes.
- [ ] AC-2: The review examines the code changes produced during the tier against the relevant kit requirements.
- [ ] AC-3: Each finding has a severity classification: P0 (critical), P1 (major), P2 (minor), P3 (cosmetic).
- [ ] AC-4: When P0 or P1 findings exist, the build pauses and presents the user with options: approve (continue), fix (generate fix tasks), or abort (stop the build).
- [ ] AC-5: When "fix" is selected, new tasks are added to the current tier for each P0/P1 finding and the tier re-executes.
- [ ] AC-6: When tier gate mode is set to "off" in configuration, no tier gate review occurs.
- [ ] AC-7: The default review mechanism uses the current model for self-review. An alternative model can be configured for cross-model adversarial review.

### R5: Convergence Monitoring

**Description:** During iterative build execution, the system tracks convergence signals: lines changed per iteration, test pass rates, and whether changes are shrinking. Plateau detection identifies when iteration is no longer productive.

**Acceptance Criteria:**
- [ ] AC-1: Each build iteration records: iteration number, lines changed, test results (pass/fail counts), and files modified.
- [ ] AC-2: When lines changed per iteration are decreasing and test pass rates are increasing, the system reports healthy convergence.
- [ ] AC-3: When lines changed plateau (neither increasing nor decreasing) while test failures persist, the system reports a ceiling condition and recommends stopping iteration.
- [ ] AC-4: Iteration is capped at the configured maximum iteration count per task.
- [ ] AC-5: Convergence data is written to a loop log in the project's context directory for cross-session persistence.

### R6: Inspect Command (/ck:inspect)

**Description:** Performs gap analysis by comparing built code against kit requirements. Identifies missing implementations, partial implementations, and over-builds (code that doesn't trace to any requirement).

**Acceptance Criteria:**
- [ ] AC-1: Running `/ck:inspect` reads all kits and examines the current codebase.
- [ ] AC-2: The output classifies each acceptance criterion as: met, partially met, or not met.
- [ ] AC-3: Code that does not trace to any kit requirement is flagged as a potential over-build.
- [ ] AC-4: Findings are presented with severity levels (P0-P3) consistent with the tier gate severity scale.
- [ ] AC-5: Running `/ck:inspect` when no kits exist displays an error.

### R7: Research Command (/ck:research)

**Description:** Dispatches parallel subagents to explore topics, gather information, or prototype approaches. Results are collected and summarized for the user.

**Acceptance Criteria:**
- [ ] AC-1: Running `/ck:research <topic>` dispatches one or more subagents to investigate the topic.
- [ ] AC-2: Research results are collected and presented as a consolidated summary.
- [ ] AC-3: Running `/ck:research` without arguments displays a usage message.

### R8: Design Command (/ck:design)

**Description:** Creates or audits a DESIGN.md file following the structured design system format. The create subcommand guides the user through a Q&A flow; the audit subcommand validates an existing DESIGN.md for completeness.

**Acceptance Criteria:**
- [ ] AC-1: Running `/ck:design create` initiates a guided flow that produces a DESIGN.md file with the structured 9-section format (visual theme, color palette, typography, components, layout, depth, dos/don'ts, responsive, agent guide).
- [ ] AC-2: Running `/ck:design audit` reads an existing DESIGN.md and reports which of the 9 sections are present, incomplete, or missing.
- [ ] AC-3: Running `/ck:design` without a subcommand displays usage showing available subcommands.

### R9: Config Command (/ck:config)

**Description:** Displays and modifies CaveKit configuration values.

**Acceptance Criteria:**
- [ ] AC-1: Running `/ck:config` with no arguments displays all current configuration values and their sources (default, global, project).
- [ ] AC-2: Running `/ck:config <key> <value>` updates the specified configuration key in the project-local configuration file.
- [ ] AC-3: Invalid configuration keys or values produce a descriptive error message.

### R10: Progress Command (/ck:progress)

**Description:** Displays the current state of an active or completed build: task statuses, wave progress, tier gate results, convergence metrics, and blocked items.

**Acceptance Criteria:**
- [ ] AC-1: Running `/ck:progress` displays: total tasks, completed tasks, failed tasks, blocked tasks, and current wave number.
- [ ] AC-2: When convergence data exists, the output includes the latest convergence metrics (lines changed trend, test pass rate trend).
- [ ] AC-3: When no build has been started, the command displays a message indicating no build data exists.

### R11: Help Command (/ck:help)

**Description:** Displays an overview of all available `/ck:*` commands with brief descriptions.

**Acceptance Criteria:**
- [ ] AC-1: Running `/ck:help` lists all registered `/ck:*` commands with a one-line description for each.
- [ ] AC-2: Running `/ck:help <command>` displays detailed usage information for the specified command.

### R12: Kit Parser

**Description:** Parses kit markdown files into structured data (Kit, Requirement, AcceptanceCriterion types defined in blueprint-extension-core R3).

**Acceptance Criteria:**
- [ ] AC-1: Given a well-formed kit markdown file, the parser extracts all requirements and their acceptance criteria into the structured Kit type.
- [ ] AC-2: Given a malformed kit file (missing R-numbers, missing AC lines), the parser reports specific parse errors with line references.
- [ ] AC-3: The parser handles multiple kit files in a directory, returning a list of parsed Kit objects.

### R13: Build Site Parser

**Description:** Parses build site markdown into structured data (BuildSite, BuildTask types defined in blueprint-extension-core R3).

**Acceptance Criteria:**
- [ ] AC-1: Given a well-formed build site file, the parser extracts all tasks, tier assignments, dependency edges, and the coverage matrix.
- [ ] AC-2: The parser validates that all dependency references point to existing tasks (no dangling references).
- [ ] AC-3: The parser detects circular dependencies and reports them as errors.

### R14: Scoped Context Builder

**Description:** Given a task and the full set of kits, extracts only the kit sections (requirements, acceptance criteria) that are relevant to that task, producing a minimal context payload for subagent dispatch.

**Acceptance Criteria:**
- [ ] AC-1: The scoped context for a task contains only the requirements and acceptance criteria mapped to that task via the build site's coverage matrix.
- [ ] AC-2: The scoped context includes cross-references from included requirements to other kits when those cross-references exist.
- [ ] AC-3: When scoped context is disabled in configuration, the builder returns the full content of all kits.

## Out of Scope

- Widget rendering for build dashboard, kit reviewer, tier gate overlay -- see blueprint-extension-ui
- Git worktree isolation for parallel subagents (per PRD Decision 3: Phase 4+ only)
- SDK-embedded subagents (per PRD Decision 1: print mode first)
- MCP integration (per PRD Decision 2: no MCP)
- The `/ck:init` bootstrapping command (not specified in PRD)

## Cross-References

- blueprint-extension-core: Provides config system (R2), types (R3), hooks (R5-R7), and command registration (R1)
- blueprint-extension-ui: Consumes build state for dashboard (R1), kit data for reviewer (R2), findings for tier gate overlay (R3)
- blueprint-cave-mode: Build subagents can optionally apply caveman compression via the cavemanSubagents config setting
- PRD reference: Part 2 sections 2.3-2.6; Part 4 Decisions 1-4
- Methodology skill: Source of truth for the Hunt lifecycle (draft/architect/build/inspect/monitor)
- Validation-First skill: Source of truth for the 6-gate pipeline and phase gate enforcement
- Convergence Monitoring skill: Source of truth for convergence vs. ceiling detection
- Peer Review skill: Source of truth for adversarial review modes used in tier gates
- CaveKit Writing skill: Source of truth for kit structure and acceptance criteria standards
- Brownfield Adoption skill: Source of truth for reverse-engineering kits from existing code
- Design System skill: Source of truth for DESIGN.md 9-section format

## Changelog

| Date | Change |
|------|--------|
| 2026-04-08 | Initial draft |
