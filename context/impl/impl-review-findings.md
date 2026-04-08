---
created: "2026-04-08"
last_edited: "2026-04-08"
---

# Review Findings

| Finding | Severity | File | Status |
|---------|----------|------|--------|
| F-001: Failed tasks never retried — retry loop broken | P0 | packages/cavekit-extension/src/wave/executor.ts | NEW |
| F-002: Kit parser rejects kits from /ck:draft (R-001 vs R1) | P0 | packages/cavekit-extension/src/parsers/kit-parser.ts, commands/draft.ts | NEW |
| F-003: Progress/hooks read from wrong directory (context/sites/) | P0 | packages/cavekit-extension/src/commands/progress.ts, hooks/compaction.ts, hooks/context-injection.ts | NEW |
| F-004: Subagent binary hardcoded to `pi` instead of `cave` | P1 | packages/cavekit-extension/src/wave/executor.ts:263 | NEW |
| F-005: stderr not consumed — potential deadlock | P1 | packages/cavekit-extension/src/wave/executor.ts:263-287 | NEW |
| F-006: `git add -A` stages all files including secrets | P1 | packages/cavekit-extension/src/commands/build.ts:98 | NEW |
| F-007: Config key validation does not reject unknown keys | P2 | packages/cavekit-extension/src/config/index.ts:41-68 | NEW |
| F-008: Tool compression collapses 3+ blank lines, not 2+ | P2 | packages/coding-agent/src/core/cave-tool-compression.ts:51 | NEW |
| F-009: Tier gate uses heuristic keywords, not LLM analysis | P2 | packages/cavekit-extension/src/wave/tier-gate.ts:142-165 | NEW |
| F-010: Severity derivation is position-based, not content-based | P2 | packages/cavekit-extension/src/wave/tier-gate.ts:220-227 | NEW |
| F-011: DESIGN.md 9-section format differs from blueprint | P2 | packages/cavekit-extension/src/commands/design.ts:138-149 | NEW |
| F-012: Scoped context injection domain prefix mismatch | P2 | packages/cavekit-extension/src/hooks/context-injection.ts:85-96 | NEW |
| F-013: Convergence monitor hook is a complete stub | P2 | packages/cavekit-extension/src/hooks/convergence-monitor.ts:15-25 | NEW |
| F-014: commandGate implemented but blueprint says deferred | P3 | packages/cavekit-extension/src/hooks/command-safety-gate.ts | NEW |
| F-015: worktree.ts never used by executor, default misleading | P3 | packages/cavekit-extension/src/wave/worktree.ts | NEW |
