---
created: "2026-04-18"
last_edited: "2026-04-18"
---
# Implementation Tracking: fullscreen-viewport

Build site: context/plans/build-site.md

| Task | Status | Notes |
|------|--------|-------|
| T3 (alt-screen enter/exit) | DONE | `packages/tui/src/terminal.ts`: `enterAltScreen()` writes `\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l`, guards non-TTY. `leaveAltScreen()` writes `\x1b[?25h\x1b[?1049l`, idempotent. `TUI.start()` enters, `TUI.stop()` via `terminal.stop()` leaves. R1 ACs satisfied |
| T4 (signal + uncaught teardown) | DONE | `ProcessTerminal.installSignalHandlers()` handles SIGINT/SIGTERM/SIGHUP + uncaughtException + unhandledRejection; runs `stop()` then exits with signal-appropriate code (130/143/129) or 1 for exceptions. `removeSignalHandlers()` in `stop()`. `main.ts` adds `process.on("exit")` safety net for alt-screen+mouse+cursor restore |
| T6 (in-app scroll buffer) | DONE | `packages/tui/src/scroll-buffer.ts` — `ScrollBuffer` class: append/replaceTail/clear, setViewport, scrollBy/page/halfPage/jumpTop/Tail, tail vs paused mode, unseenCount, visibleWidth-aware soft-wrap via `wrapTextWithAnsi`. 11 unit tests in `packages/tui/test/scroll-buffer.test.ts` — all passing |
| T8 (mouse tracking enable/disable) | DONE (primitive) | `ProcessTerminal.enableMouseTracking` emits `\x1b[?1000h\x1b[?1006h` on TUI.start(); `disableMouseTracking` in stop(). Wheel event routing is T14 (pending) |
| T12 (unified teardown) | DONE (primitive) | `ProcessTerminal.stop()` now: cancel OSC listeners → disable mouse → disable bracketed paste → disable kitty proto → stdin pause → restore raw mode → leave alt screen → SGR reset → remove signal handlers. `TUI.stop()` guards re-entry with `stopped` flag |
| T9, T10, T13–T15, T21 | PENDING | Tier 1 tasks |
| T22–T26 | PENDING | Tier 2/3 tasks |
