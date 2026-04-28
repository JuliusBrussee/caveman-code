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
| T11 (ambient theme selection) | DONE | `theme.ts` `detectTerminalBackground()` checks (1) cached probe result, (2) CAVE_TERM_BG override, (3) COLORFGBG, (4) dark fallback — matches R1 chain. `setDetectedBackground()` exported for main.ts to push probe result; one-shot cache, no mid-session swap per R3 AC4. `main.ts` runs `probeTerminal({timeoutMs:150})` before `initTheme()` when user hasn't set a theme — standalone OSC 11 query + COLORFGBG fallback. User's explicit theme wins (R3 AC2) |
| T16 (strip bulk bg fills) | DONE | `dark.json` + `light.json`: `export.pageBg`, `userMsgBg`, `toolPendingBg`, `toolSuccessBg`, `customMsgBg` set to `""`. Existing `bgAnsi("")` emits `\x1b[49m` (reset to default bg) so host terminal bg shows through. Retained bgs (contrast zones per R5): `selectedBg`, `toolErrorBg`, `cardBg`, `infoBg`, code-block styling |
| T17–T20 | PENDING | T17 contrast-zone registry, T18 fg legibility audit, T19 luminance harmonization, T20 scroll indicator |
