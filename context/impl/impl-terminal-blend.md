---
created: "2026-04-18"
last_edited: "2026-04-18"
---
# Implementation Tracking: terminal-blend

Build site: context/plans/build-site.md

| Task | Status | Notes |
|------|--------|-------|
| T1 (identity probe) | DONE | `packages/tui/src/terminal-detect.ts` — `detectTerminalIdentity()` observes all R2 env vars; classifies ghostty/iterm2/apple-terminal/kitty/wezterm/alacritty/vte/tmux/screen/linux-console/cmux/windows-terminal/vscode/unknown; retains outer `hostProgram` under tmux/screen; exposes `raw` snapshot for debugging |
| T2 (background probe) | DONE | `queryTerminalBackground(terminal, timeoutMs=200)` in same file: `CAVE_TERM_BG` override → OSC 11 (via `ProcessTerminal.queryOsc`) → `COLORFGBG`. `probeTerminal()` wraps both and guarantees a "dark" fallback per R1 |
| T5 (color depth emitter) | DONE | `packages/tui/src/color-depth.ts` — `detectColorDepth()` returns truecolor/256/16 following R7 rules (tmux downgrade to 256 without truecolor, linux-console → 16). `hexToSgr(hex, depth, kind)` emits correct SGR at each depth; empty hex → empty string |
| T7 (CAVE_DEBUG_TERM) | DONE | `packages/coding-agent/src/main.ts` emits `[cave-term] {JSON}` to stderr before UI boot. Verified: `CAVE_DEBUG_TERM=1 cave --version` emits identity JSON line. Background best-effort (needs TTY for OSC 11 which isn't available pre-TUI) |
| T11, T16–T20 | PENDING | Tier 1/2 tasks — depend on probe output being wired into theme loader |
