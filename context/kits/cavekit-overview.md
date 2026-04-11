---
cavekit: overview
version: 1.0.0
status: approved
created: 2026-04-08
updated: 2026-04-08
---

# Cavekit Overview: Caveman Code Rebrand

## Summary

This project rebrands the `caveman-cli` fork (formerly "Cave Pi", upstream `pi-mono`) to **Caveman Code**. The rebrand is cosmetic only -- no package names (`@cavepi/*`), import paths, or architectural changes. The binary remains `cave`.

## Kit Index

| Kit | File | Description | Requirements | Acceptance Criteria |
|-----|------|-------------|:------------:|:-------------------:|
| Brand Cleanup | [cavekit-brand-cleanup.md](cavekit-brand-cleanup.md) | Remove user-facing "Pi" references from code strings | 10 | 24 |
| Visual Theme | [cavekit-visual-theme.md](cavekit-visual-theme.md) | New navy-dark palette with cyan accent and amber brand color | 6 | 16 |
| Startup Experience | [cavekit-startup-experience.md](cavekit-startup-experience.md) | ASCII art logo, version, keybindings, cave mode status | 5 | 14 |
| Documentation | [cavekit-documentation.md](cavekit-documentation.md) | Rewrite READMEs, CONTRIBUTING, AGENTS, package.json URLs | 7 | 18 |
| **Totals** | | | **28** | **72** |

## Dependency Graph

```
brand-cleanup ─────────────┐
                           ├──> documentation
                           │
visual-theme ──────────────┤
                           ├──> startup-experience
brand-cleanup (R9) ────────┘
```

**Reading the graph:**
- `documentation` depends on `brand-cleanup` (naming conventions must be established first)
- `startup-experience` depends on `visual-theme` (brand/accent colors) and `brand-cleanup` R9 (fallback text)
- `brand-cleanup` and `visual-theme` are independent of each other and can be worked in parallel

**No circular dependencies exist.**

## Execution Order

1. **Wave 1 (parallel):** brand-cleanup, visual-theme
2. **Wave 2:** startup-experience (after both Wave 1 kits are complete)
3. **Wave 3:** documentation (after brand-cleanup is complete; can overlap with Wave 2)

## Cross-Cutting Rules

These rules apply across all kits:

- The `LICENSE` file is never modified -- upstream copyright must remain intact
- `@cavepi/*` package names and import paths are intentionally preserved
- The binary name remains `cave`
- "Pi" or "Cave Pi" becomes "Caveman Code" or "Cave" in all user-facing text
- CHANGELOG.md files are historical records -- upstream issue links are not altered

## Active Kits

| Kit | File | Description | Requirements | Acceptance Criteria |
|-----|------|-------------|:------------:|:-------------------:|
| RTK Integration | [cavekit-rtk-integration.md](cavekit-rtk-integration.md) | RTK binary integration for bash command output compression | 5 | 24 |
| Extension Workflow | [cavekit-extension-workflow.md](cavekit-extension-workflow.md) | CaveKit extension orchestration: tier gate overlay, build site discovery, wave commits, SDK executor, prompt constraints | 7 | 27 |

### RTK Integration Dependency Graph

```
R3 (Settings) ──┐
                 ├──> R4 (Hook Wiring) ──> bash tool execution
R1 (Detection) ──┤
                 └──> R2 (Rewriting) ──┘
```

R1 and R3 are independent. R2 depends on R1. R4 depends on R1, R2, and R3.

## Changelog

| Date       | Version | Change         |
|------------|---------|----------------|
| 2026-04-11 | 1.2.0   | Added Extension Workflow kit; RTK Integration updated to 5 reqs |
| 2026-04-09 | 1.1.0   | Added RTK Integration kit |
| 2026-04-08 | 1.0.0   | Initial draft  |
