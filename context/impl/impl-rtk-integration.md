---
created: "2026-04-09"
last_edited: "2026-04-09"
---
# Implementation Tracking: RTK Integration

Build site: context/plans/build-site.md

| Task | Status | Notes |
|------|--------|-------|
| T-017 | DONE | Created `rtk.ts` with `detectRtk()`, `getRtkStatus()`, `resetRtkCache()`. Caches after first call. |
| T-018 | DONE | Added `RtkSettings` interface, `rtk?: RtkSettings` to `Settings`, `getRtkEnabled()`/`setRtkEnabled()` to `SettingsManager`. Defaults to `false`. |
| T-019 | DONE | Added `rewriteCommand()` in `rtk.ts`. Fail-open with 200ms timeout, double-rewrite guard, compound passthrough. |
| T-020 | DONE | Added `createRtkSpawnHook()` returning a sync `BashSpawnHook`. Uses `execFileSync` for rewrite. |
| T-021 | DONE | Wired RTK hook into `_buildRuntime` in `agent-session.ts`. Conditionally creates `spawnHook` when `rtk.enabled=true` AND `getRtkStatus().available`. |
| T-022 | DONE | Created `rtk.test.ts` with 17 tests covering all 19 ACs. All pass. |
