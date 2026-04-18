---
cavekit: overview
version: 1.4.0
status: approved
created: 2026-04-08
updated: 2026-04-18
---

# Cavekit Overview: Caveman Code

## Summary

Domain index for all cavekit requirements in the `caveman-cli` monorepo. Originally scoped to the Caveman Code rebrand; now hosts multiple initiatives (rebrand, token efficiency, extension workflow, terminal integration). Each section below lists the kits in one initiative, their dependencies, and their execution order.

## Active Ship Run (2026-04-18) — Terminal Integration

Scope of the current `/ck:ship` run: make the `cave` TUI blend into whatever terminal the user is running (ghostty, iTerm2, Terminal.app, Kitty, WezTerm, Alacritty, tmux, screen, cmux, Linux console, ssh-over-any-of-the-above), run as a full-terminal scroll-locked app like Claude Code / Codex CLI, and keep the SDD (`/ck:*`) workflow UI fully compatible with the new viewport.

| Kit | File | Description | Reqs |
|-----|------|-------------|:----:|
| Terminal Blend | [cavekit-terminal-blend.md](cavekit-terminal-blend.md) | Host terminal bg/identity detection, ambient theme selection, transparent-bg policy, contrast-zone inventory, low-color degradation | 8 |
| Fullscreen Viewport | [cavekit-fullscreen-viewport.md](cavekit-fullscreen-viewport.md) | Alt-screen entry/exit, full-viewport render, resize, scroll-lock against host scrollback, in-app scroll buffer, SDD UI integration, clean exit | 9 |

### Dependency Graph

```
terminal-blend ──┐
                 ├── (independent: can land together)
fullscreen-viewport ──┘

Both layer on top of existing cavekit-visual-theme (palette tokens)
and integrate with cavekit-extension-workflow (review overlays).
```

### Execution Order

- **Wave 1 (parallel):** terminal-blend, fullscreen-viewport
  - No inter-kit requirement dependency; terminal-blend R5(d) and R5(f) reference fullscreen-viewport surfaces but only as contrast-zone inventory entries. Neither kit blocks the other.

## Kit Index — Rebrand Initiative

| Kit | File | Description | Requirements | Acceptance Criteria |
|-----|------|-------------|:------------:|:-------------------:|
| Brand Cleanup | [cavekit-brand-cleanup.md](cavekit-brand-cleanup.md) | Remove user-facing "Pi" references from code strings | 10 | 24 |
| Visual Theme | [cavekit-visual-theme.md](cavekit-visual-theme.md) | Navy-dark palette with cyan accent and amber brand color | 6 | 16 |
| Startup Experience | [cavekit-startup-experience.md](cavekit-startup-experience.md) | ASCII art logo, version, keybindings, cave mode status | 5 | 14 |
| Documentation | [cavekit-documentation.md](cavekit-documentation.md) | Rewrite READMEs, CONTRIBUTING, AGENTS, package.json URLs | 7 | 18 |

### Dependency Graph

```
brand-cleanup ─────────────┐
                           ├──> documentation
                           │
visual-theme ──────────────┤
                           ├──> startup-experience
brand-cleanup (R9) ────────┘
```

### Execution Order

1. **Wave 1 (parallel):** brand-cleanup, visual-theme
2. **Wave 2:** startup-experience
3. **Wave 3:** documentation

## Kit Index — Extension & RTK

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

## Kit Index — Token Efficiency Initiative

Initiative-scoped kits deriving from `context/refs/research-brief-token-efficiency.md`. Goal: stack prompt caching + repomap + architect/editor routing + executable verification + checkpoints + sandbox + MCP into a top-tier SWE-bench Verified harness at 30-40% of competitor token cost. Plugin-layer only (no self-hosted inference).

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
                └──> bench-research-distro (cost caps drive eval gate)

input-compression ─> cost-trace (activation logging)

session-checkpoints (independent of bench-research-distro)
sandbox-mcp ───────> cost-trace (sandbox events logged)

bench-research-distro depends on all 1-10 producing real numbers
```

### Execution Order (waves)

- **Wave 1 (parallel, no deps):** prompt-cache, model-routing, sandbox-mcp, session-checkpoints, input-compression
- **Wave 2 (deps on Wave 1):** tool-result-cache, repomap, cost-trace
- **Wave 3 (deps on Wave 2):** edit-tools
- **Wave 4:** localizer-verifier
- **Wave 5:** bench-research-distro

### Source

Research brief: [context/refs/research-brief-token-efficiency.md](../refs/research-brief-token-efficiency.md)

## Cross-Cutting Rules

- The `LICENSE` file is never modified — upstream copyright must remain intact
- `@cavepi/*` package names and import paths are intentionally preserved for backwards compat where present
- The binary name remains `cave`
- "Pi" or "Cave Pi" becomes "Caveman Code" or "Cave" in all user-facing text
- CHANGELOG.md files are historical records — upstream issue links are not altered

## Changelog

| Date       | Version | Change         |
|------------|---------|----------------|
| 2026-04-18 | 1.4.0   | Added Terminal Integration ship run — terminal-blend + fullscreen-viewport (2 kits, 17 reqs) |
| 2026-04-16 | 1.3.0   | Added Token Efficiency Initiative — 11 kits |
| 2026-04-11 | 1.2.0   | Added Extension Workflow kit; RTK Integration updated to 5 reqs |
| 2026-04-09 | 1.1.0   | Added RTK Integration kit |
| 2026-04-08 | 1.0.0   | Initial draft  |
