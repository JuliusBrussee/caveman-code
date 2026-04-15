# RFC 0001: Token Efficiency Initiative

- Start Date: 2026-04-16
- Status: accepted
- Author: cave-cli team
- Tracking Issue: context/plans/build-site-token-efficiency.md

## Summary

Cave adopts a layered cache policy, deterministic model routing, a repomap
with PageRank, shadow-git checkpoints, and an executable verifier loop to
cut SWE-bench token spend while holding (or improving) resolved rates.

## Motivation

Existing agent loops re-send the same tools/system/project/messages bytes
on every turn and pay full input-token price. Cache breakpoints, routing
cheap models at edit/verify tiers, and avoiding redundant tool-result
fetches unlock large token savings without sacrificing correctness.

## Design

See `context/kits/cavekit-overview.md` and the 11 cavekits it references.
Each cavekit declares a narrow domain (prompt cache, router, sandbox,
etc.) with testable acceptance criteria; this RFC is the umbrella and
records the decision to adopt all of them as one initiative.

Build site: `context/plans/build-site-token-efficiency.md` — 143 tasks
across 6 tiers.

## Drawbacks

- Large surface area — many files across multiple packages
- ONNX compression (LLMLingua-2, Provence) adds optional runtime deps
- Shadow-git adds disk usage per session

## Alternatives

- Do nothing — token spend dominates total cost
- Single-file hot cache — far less effective than layered breakpoints

## Unresolved Questions

- Final shape of live tool-surface wiring for the MCP server mode
- Bun single-binary size budget (80MB target)
