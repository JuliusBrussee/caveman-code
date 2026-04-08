---
created: "2026-04-08"
last_edited: "2026-04-08"
---

# Review Findings

| Finding | Severity | File | Status |
|---------|----------|------|--------|
| F-001: Failed tasks never retried — retry loop broken | P0 | packages/cavekit-extension/src/wave/executor.ts | FIXED |
| F-002: Kit parser rejects kits from /ck:draft (R-001 vs R1) | P0 | packages/cavekit-extension/src/parsers/kit-parser.ts, commands/draft.ts | FIXED |
| F-003: Progress/hooks read from wrong directory (context/sites/) | P0 | packages/cavekit-extension/src/commands/progress.ts, hooks/compaction.ts, hooks/context-injection.ts | FIXED |
| F-004: Subagent binary hardcoded to `pi` instead of `cave` | P1 | packages/cavekit-extension/src/wave/executor.ts:263 | FIXED |
| F-005: stderr not consumed — potential deadlock | P1 | packages/cavekit-extension/src/wave/executor.ts:263-287 | FIXED |
| F-006: `git add -A` stages all files including secrets | P1 | packages/cavekit-extension/src/commands/build.ts:98 | FIXED |
| F-007: Config key validation does not reject unknown keys | P2 | packages/cavekit-extension/src/config/index.ts:41-68 | FIXED |
| F-008: Tool compression collapses 3+ blank lines, not 2+ | P2 | packages/coding-agent/src/core/cave-tool-compression.ts:51 | FIXED |
| F-009: Tier gate uses heuristic keywords, not LLM analysis | P2 | packages/cavekit-extension/src/wave/tier-gate.ts:142-165 | FIXED |
| F-010: Severity derivation is position-based, not content-based | P2 | packages/cavekit-extension/src/wave/tier-gate.ts:220-227 | FIXED |
| F-011: DESIGN.md 9-section format differs from blueprint | P2 | packages/cavekit-extension/src/commands/design.ts:138-149 | FIXED |
| F-012: Scoped context injection domain prefix mismatch | P2 | packages/cavekit-extension/src/hooks/context-injection.ts:85-96 | FIXED |
| F-013: Convergence monitor hook is a complete stub | P2 | packages/cavekit-extension/src/hooks/convergence-monitor.ts:15-25 | FIXED |
| F-014: commandGate implemented but blueprint says deferred | P3 | packages/cavekit-extension/src/hooks/command-safety-gate.ts | FIXED |
| F-015: worktree.ts never used by executor, default misleading | P3 | packages/cavekit-extension/src/wave/worktree.ts | FIXED |
