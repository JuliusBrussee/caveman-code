# Cavekit: RTK Integration

## Scope

Integration of [RTK (Rust Token Killer)](https://github.com/rtk-ai/rtk) into the Caveman CLI coding agent. RTK is an external Rust binary that compresses CLI command outputs by 60-90% through smart filtering, grouping, truncation, and deduplication. This kit covers detecting RTK availability, rewriting bash tool commands through RTK, and exposing configuration to enable/disable the integration.

## Requirements

### R1: RTK Binary Detection

**Description:** The system must detect whether the `rtk` binary is installed and available on the user's PATH at startup, and cache this result for the session lifetime.

**Acceptance Criteria:**
- [ ] When `rtk` is on PATH and `rtk --version` exits 0, detection reports RTK as available
- [ ] When `rtk` is not on PATH, detection reports RTK as unavailable without throwing an error
- [ ] When `rtk` is on PATH but `rtk --version` fails (wrong binary / name collision), detection reports RTK as unavailable
- [ ] Detection result is cached after first check — subsequent queries within the same session do not spawn a subprocess
- [ ] The detected RTK version string is stored alongside the availability flag

**Dependencies:** None

### R2: Bash Command Rewriting via RTK

**Description:** When RTK is available and enabled, bash tool commands must be rewritten through `rtk rewrite` before execution. The `rtk rewrite` command classifies a shell command and returns the RTK-prefixed equivalent (e.g., `git status` -> `rtk git status`). Commands that RTK does not recognize pass through unchanged.

**Acceptance Criteria:**
- [ ] Before executing a bash command, the system calls `rtk rewrite "<command>"` to obtain a rewritten command
- [ ] If `rtk rewrite` exits 0 with stdout output, the rewritten command replaces the original
- [ ] If `rtk rewrite` exits with code 1, 2, or any non-zero code, the original command is used unchanged
- [ ] If calling `rtk rewrite` fails (process error, timeout), the original command is used unchanged (fail-open)
- [ ] Commands already prefixed with `rtk` are not double-rewritten
- [ ] Compound commands with `&&`, `||`, `;` operators are passed to `rtk rewrite` as-is (RTK handles compound parsing internally)
- [ ] The rewrite step adds less than 50ms latency to command execution in the common case
- [ ] Rewriting is skipped entirely when RTK integration is disabled or RTK is unavailable

**Dependencies:** R1 (RTK detection), R4 (configuration)

### R3: RTK Integration Settings

**Description:** Users must be able to enable or disable RTK integration through the settings system, and the setting must persist across sessions.

**Acceptance Criteria:**
- [ ] A boolean setting `rtk.enabled` exists in the settings manager, defaulting to `true`
- [ ] When `rtk.enabled` is `true` and RTK is available (R1), bash command rewriting (R2) is active
- [ ] When `rtk.enabled` is `false`, no RTK rewriting occurs regardless of binary availability
- [ ] The setting is readable and writable through the existing settings manager API (`getRtkEnabled()` / `setRtkEnabled()`)
- [ ] The setting persists in the global settings file across sessions

**Dependencies:** None

### R4: RTK Rewrite Hook Wiring

**Description:** The RTK rewrite logic must be wired into the bash tool execution path using the existing `BashSpawnHook` mechanism, so that every bash tool invocation passes through RTK rewriting when enabled.

**Acceptance Criteria:**
- [ ] When RTK integration is active, a `BashSpawnHook` is configured on the bash tool that rewrites `context.command` via `rtk rewrite`
- [ ] The hook is applied during tool initialization in the agent session setup (`_initToolsAndExtensions`)
- [ ] When the RTK setting or availability changes (e.g., after settings reload), the tool set is refreshed to reflect the new state
- [ ] The existing `commandPrefix` (shell command prefix setting) continues to work alongside RTK rewriting — prefix is applied first, then RTK rewriting
- [ ] The existing cave mode tool compression (`compressCaveToolContentBlocks`) still runs on RTK-rewritten command output (defense in depth)

**Dependencies:** R1, R2, R3

### R5: Extension Shell Command Rewriting

**Description:** All shell commands executed by the cavekit-extension (e.g. git operations in wave worktrees, build commands) must route through RTK rewriting via a dedicated `rtkExec` helper so that extension subprocess calls follow the same RTK pipeline as the main agent's bash tool.

**Acceptance Criteria:**
- [ ] A module `rtk-exec.ts` in `packages/cavekit-extension/src/` exports `rtkExec(command, options)` and `initRtkExec()`
- [ ] `rtkExec` dynamically imports RTK utilities from `cave` and applies `rewriteCommand()` before calling `execSync`
- [ ] When RTK is unavailable or disabled, `rtkExec` falls back to direct `execSync` with the original command (fail-open)
- [ ] `initRtkExec()` is called during extension initialization to warm the dynamic import cache
- [ ] All `execSync` calls in `cavekit-extension/src/commands/build.ts` and `cavekit-extension/src/wave/worktree.ts` use `rtkExec`

**Dependencies:** R1 (RTK detection), R3 (settings), R4 (hook wiring)

## Out of Scope

- Installing RTK automatically — users must install RTK themselves (`brew install rtk` or other methods)
- Rewriting non-bash tools (Read, Grep, Find, Ls) through RTK — these use native file operations, not shell commands
- RTK configuration file management (`~/.config/rtk/config.toml`) — RTK manages its own config
- RTK telemetry settings — managed by RTK itself
- RTK `init` hook installation — Caveman CLI integrates at the application level, not through shell hooks
- Slash commands for RTK (e.g., `/rtk gain`) — can be added later if needed
- UI indicators showing RTK status or token savings — can be added later

## Cross-References

- `cave-tool-compression.ts` — existing naive compression that runs post-RTK as defense in depth
- `bash.ts` — bash tool definition with `BashSpawnHook` and `BashToolOptions` interfaces
- `settings-manager.ts` — settings persistence layer
- `agent-session.ts` — tool initialization in `_initToolsAndExtensions`
- `tools/index.ts` — tool factory functions accepting `ToolsOptions`

## Changelog

### 2026-04-09 — Revision
- **Affected:** R3/AC-1
- **Summary:** Changed `rtk.enabled` default from `false` to `true`. RTK is now opt-out: users with rtk on PATH get compression automatically; users without rtk are unaffected (detection fails gracefully, no hook wired).
- **Commits:** c87c6303

### 2026-04-11 — Revision
- **Affected:** R5 (new)
- **Summary:** Added R5 — Extension Shell Command Rewriting. Extension's direct `execSync` calls bypassed RTK entirely; manual fix introduced `rtk-exec.ts` to centralize all extension shell commands through the same RTK rewrite pipeline as the main agent. Also re-exported RTK utilities (`getRtkStatus`, `rewriteCommand`, etc.) from `coding-agent/src/index.ts` so extension can import them via the `cave` peer dep.
- **Commits:** 1fc0c735
