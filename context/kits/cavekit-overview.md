---
cavekit: overview
version: 1.3.0
status: approved
created: 2026-04-08
updated: 2026-04-16
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

## Token Efficiency Initiative (2026-04-16)

Initiative-scoped kits deriving from `context/refs/research-brief-token-efficiency.md`. Goal: stack prompt caching + repomap + architect/editor routing + executable verification + checkpoints + sandbox + MCP into a top-tier SWE-bench Verified harness at 30-40% of competitor token cost. Plugin-layer only (no self-hosted inference).

### Kit Index

| Kit | File | Description | Reqs |
|-----|------|-------------|:----:|
| Prompt Cache | [cavekit-prompt-cache.md](cavekit-prompt-cache.md) | 4-breakpoint layered cache, deterministic schemas, per-task retention | 8 |
| Tool Result Cache | [cavekit-tool-result-cache.md](cavekit-tool-result-cache.md) | Semantic tool-result cache + output normalization | 6 |
| Repomap | [cavekit-repomap.md](cavekit-repomap.md) | Tree-sitter top-8 PageRank repomap, caveman-rendered | 8 |
| Edit Tools | [cavekit-edit-tools.md](cavekit-edit-tools.md) | Aider S/R diff + AST `edit_symbol` | 7 |
| Model Routing | [cavekit-model-routing.md](cavekit-model-routing.md) | Architect/editor `ModelRouter` in core agent loop | 7 |
| Localizer & Verifier | [cavekit-localizer-verifier.md](cavekit-localizer-verifier.md) | Agentless localizer + best-of-N + executable verifier + Reflexion | 8 |
| Input Compression | [cavekit-input-compression.md](cavekit-input-compression.md) | LLMLingua-2 + Provence ONNX middleware | 7 |
| Cost & Trace | [cavekit-cost-trace.md](cavekit-cost-trace.md) | Hard mid-turn caps, `cave trace`, replay | 8 |
| Session Checkpoints | [cavekit-session-checkpoints.md](cavekit-session-checkpoints.md) | Shadow-git checkpoints, Esc-Esc rewind, hunk review, plan mode | 8 |
| Sandbox & MCP | [cavekit-sandbox-mcp.md](cavekit-sandbox-mcp.md) | Seatbelt/Landlock sandbox + MCP client/server + ACP | 8 |
| Bench, Research, Distro | [cavekit-bench-research-distro.md](cavekit-bench-research-distro.md) | SWE-bench harness, `research/`, Bun binary, docs, RFC, community | 11 |

### Dependency Graph

```
prompt-cache ──┬──> repomap (cache-stable rendering)
               ├──> tool-result-cache (normalization)
               ├──> edit-tools (deterministic schemas)
               ├──> model-routing (per-task retention)
               └──> sandbox-mcp (MCP tool schema determinism)

repomap ────────┬──> edit-tools (shared tree-sitter parse)
                └──> localizer-verifier (localizer input)

edit-tools ────────> session-checkpoints (hunk diff payload)

model-routing ─────> localizer-verifier (verify role)
                ├──> cost-trace (downgrade signals)
                └─<─ cost-trace (cap-aware downgrade)

cost-trace ────────> localizer-verifier (subagent budgets)
                └──> session-checkpoints (no, independent)
                └──> bench-research-distro (cost caps drive eval gate)

input-compression ─> cost-trace (activation logging)

session-checkpoints (independent of bench-research-distro)
sandbox-mcp ───────> cost-trace (sandbox events logged)

bench-research-distro depends on all 1-10 producing real numbers
```

### Execution Order (waves)

- **Wave 1 (parallel, no deps):** prompt-cache, model-routing, sandbox-mcp, session-checkpoints, input-compression
- **Wave 2 (deps on Wave 1):** tool-result-cache (after prompt-cache), repomap (after prompt-cache), cost-trace (after prompt-cache + model-routing)
- **Wave 3 (deps on Wave 2):** edit-tools (after repomap + prompt-cache)
- **Wave 4:** localizer-verifier (after repomap + edit-tools + model-routing + cost-trace)
- **Wave 5:** bench-research-distro (after all)

### Source

Research brief: [context/refs/research-brief-token-efficiency.md](../refs/research-brief-token-efficiency.md)

## Changelog

| Date       | Version | Change         |
|------------|---------|----------------|
| 2026-04-16 | 1.3.0   | Added Token Efficiency Initiative — 11 kits |
| 2026-04-11 | 1.2.0   | Added Extension Workflow kit; RTK Integration updated to 5 reqs |
| 2026-04-09 | 1.1.0   | Added RTK Integration kit |
| 2026-04-08 | 1.0.0   | Initial draft  |
