---
created: 2026-04-08
last_edited: 2026-04-08
status: draft
---

# Blueprint Overview: Cave Pi

Cave Pi is a thin fork of Pi (badlogic/pi-mono) with native caveman token compression, plus a CaveKit extension implementing the full specification-driven development (SDD) workflow.

## Domain Index

| Blueprint | Domain | Description | Dependencies |
|-----------|--------|-------------|--------------|
| blueprint-fork-identity.md | fork-identity | Package renaming, CLI binary (cave), config dir, startup banner, upstream tracking | None |
| blueprint-cave-mode.md | cave-mode | System prompt injection, caveman rules, /cave command, settings, compaction mods, tool result compression | fork-identity |
| blueprint-extension-core.md | extension-core | Extension entry point, config system, types, skill bundling, command registration, hooks | fork-identity |
| blueprint-extension-commands.md | extension-commands | All /ck:* commands, kit/build-site parsers, wave executor, tier gate, convergence, scoped context | extension-core |
| blueprint-extension-ui.md | extension-ui | Build dashboard widget, kit reviewer overlay, tier gate overlay, dep graph, keyboard shortcuts | extension-core, extension-commands |

## Dependency Graph

```
fork-identity
  |
  +---> cave-mode
  |
  +---> extension-core
            |
            +---> extension-commands
            |         |
            +----+----+
                 |
                 v
            extension-ui
```

## Coverage Summary

| Blueprint | Requirements | Acceptance Criteria |
|-----------|-------------|-------------------|
| fork-identity | 6 | 17 |
| cave-mode | 6 | 23 |
| extension-core | 8 | 29 |
| extension-commands | 14 | 57 |
| extension-ui | 5 | 18 |
| **Total** | **39** | **144** |

## Key Cross-Cutting Concerns

**Vanilla Pi Compatibility:** The extension (extension-core R8) must work on vanilla Pi. Cave mode features (cave-mode R6) degrade gracefully when disabled.

**No MCP:** Per PRD Decision 2, no MCP servers are used. Tool integrations use direct CLI invocation.

**Print Mode First:** Per PRD Decision 1, subagent dispatch uses print mode (`cave -p`), not SDK embedding.

**Scoped Context:** Subagents receive only relevant kit sections (extension-commands R14), not full kit trees, to minimize token usage.

## Navigation

- Start with fork-identity and cave-mode for the thin fork requirements
- Start with extension-core, then extension-commands, then extension-ui for the CaveKit extension requirements
- Each blueprint's Cross-References section links to related blueprints and PRD sections

## Changelog

| Date | Change |
|------|--------|
| 2026-04-08 | Initial draft -- 5 domain decomposition |
