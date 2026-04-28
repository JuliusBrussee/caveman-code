---
created: "2026-04-08"
last_edited: "2026-04-08"
---

# Implementation Tracking: extension-core

Build site: context/plans/build-site.md

| Task | Status | Notes |
|------|--------|-------|
| T-007 | DONE | types.ts with Kit, Requirement, AcceptanceCriterion, BuildSite, BuildTask, Finding |
| T-009 | DONE | Entry point with graceful Cave Pi / vanilla Pi detection |
| T-010 | DONE | Two-layer config (global+project), getConfigWithSources(), 5 new fields |
| T-011 | DONE | 15 skill stubs in skills/, discovery hook, package.json files field |
| T-018 | DONE | Compaction protection with isSddActive() guard, synchronous state serialization |
| T-019 | DONE | Already done in T-011 (skills-discovery.ts), verified |
| T-020 | DONE | Subagent context injection with DESIGN.md, scoped kit sections, config toggle |
| T-028 | DONE | Vanilla Pi compat verified, 14 tests with mock ExtensionAPI |
