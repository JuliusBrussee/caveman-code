---
name: ck-impl-tracking
description: Track build tasks, wave state, and persisted execution progress for CaveKit.
---

# CaveKit Implementation Tracking

Track build task progress in a machine-readable format so the orchestrator and the agent can always know the current state of the build.

## State Model

- Tasks are in one of: `pending | in_progress | done | blocked`
- Wave assignment determines which tasks can run in parallel
- `build_site_status` tool exposes current wave and task states
- Status is persisted in `.cavekit/kit.json` alongside the spec
