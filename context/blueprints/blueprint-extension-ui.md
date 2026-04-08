---
created: 2026-04-08
last_edited: 2026-04-08
status: draft
domain: extension-ui
depends_on:
  - extension-core
  - extension-commands
---

# Blueprint: Extension UI

## Scope

This blueprint covers the terminal UI surfaces of the CaveKit extension: the build dashboard widget, kit reviewer overlay, tier gate overlay, dependency graph visualization, and keyboard shortcuts. These surfaces present data produced by extension-commands and use the host agent's widget and overlay APIs.

## Requirements

### R1: Build Dashboard Widget

**Description:** A persistent widget that displays real-time progress during a `/ck:build` execution. It shows the current wave, task statuses within that wave, and overall build progress.

**Acceptance Criteria:**
- [ ] AC-1: During an active build, the widget is visible in the host agent's TUI and updates as tasks change status.
- [ ] AC-2: The widget displays: current wave number out of total waves, and for each task in the current wave: task identifier, task name, and status (pending, in-progress, complete, failed, blocked).
- [ ] AC-3: The widget displays aggregate progress: total completed tasks out of total tasks, and count of blocked tasks.
- [ ] AC-4: The widget can be toggled on/off without interrupting the build.

### R2: Kit Reviewer Overlay

**Description:** An interactive overlay presented after `/ck:draft` that lets the user review generated kits. The user can navigate through kits, requirements, and acceptance criteria, and approve or reject individual kits.

**Acceptance Criteria:**
- [ ] AC-1: After kit generation, the overlay displays a navigable tree of: kits > requirements > acceptance criteria.
- [ ] AC-2: The user can approve or reject individual kits through the overlay.
- [ ] AC-3: The overlay blocks further workflow progression until the user confirms their review decisions.
- [ ] AC-4: Rejected kits are not included when `/ck:architect` reads approved kits.

### R3: Tier Gate Overlay

**Description:** An overlay presented when a tier gate review produces P0 or P1 findings. It displays findings with severity levels and allows the user to choose: approve (continue), fix (generate fix tasks), or abort (stop build).

**Acceptance Criteria:**
- [ ] AC-1: The overlay displays all findings from the tier gate review, each with its severity level (P0-P3) and description.
- [ ] AC-2: The overlay presents three action options: approve, fix, abort.
- [ ] AC-3: Selecting an action dismisses the overlay and the build proceeds according to the selected action (as defined in blueprint-extension-commands R4).
- [ ] AC-4: The overlay blocks build progression until the user selects an action.

### R4: Dependency Graph Visualization

**Description:** A visual representation of the build site's task dependency graph, showing tiers, tasks, and dependency edges. Displayed after `/ck:architect` generates a build site.

**Acceptance Criteria:**
- [ ] AC-1: After build site generation, a visualization is displayed showing tasks grouped by tier with dependency edges between them.
- [ ] AC-2: Each task node displays: task identifier and task name.
- [ ] AC-3: Dependency edges are visually distinguishable (directional indication from dependency to dependent).

### R5: Keyboard Shortcuts

**Description:** Registered keyboard shortcuts provide quick access to CaveKit UI features during a session.

**Acceptance Criteria:**
- [ ] AC-1: A keyboard shortcut toggles the build dashboard widget visibility.
- [ ] AC-2: Keyboard shortcuts are registered using the host agent's shortcut registration mechanism.
- [ ] AC-3: Keyboard shortcuts do not conflict with the host agent's built-in shortcuts.

## Out of Scope

- Command logic and data computation -- see blueprint-extension-commands
- Custom theming or color configuration for widgets
- Session tree label integration (informational; not a separate UI surface)
- Mouse interaction (terminal UI is keyboard-driven)

## Cross-References

- blueprint-extension-core: Provides the extension API surface for widget and overlay registration
- blueprint-extension-commands: Provides all data consumed by UI surfaces (build state for R1, kit data for R2, findings for R3, build site for R4)
- PRD reference: Part 2 sections 2.7, 2.8

## Changelog

| Date | Change |
|------|--------|
| 2026-04-08 | Initial draft |
