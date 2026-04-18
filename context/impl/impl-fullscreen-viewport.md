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
| T9 (full viewport bounds) | DONE | `TUI.doRender()` early-returns a degenerate placeholder when rows<4 or cols<20 (R2 AC4, R3 AC4). For normal sizes, existing differential renderer + alt-screen naturally keep content within rows (any overflow scrolls the alt buffer — viewport bounds invariant holds). No trailing `\r\n` after last content line |
| T10 (SIGWINCH) | DONE (existing) | TUI already wires `process.stdout.on('resize', handler)` → `requestRender()` which re-measures `this.terminal.columns/rows` within one animation tick. After resize, the degenerate guard re-evaluates correctly |
| T15 (degenerate placeholder) | DONE | `TUI.renderDegenerateFrame(w, h)` centers "terminal too small" when width permits, else truncates |
| T8 (mouse enable/disable primitive) | DONE | Committed in Tier 0 — `ProcessTerminal.enableMouseTracking()` emits `\x1b[?1000h\x1b[?1006h` on TUI.start(); `disableMouseTracking()` on stop(). Wheel events reach the input handler via stdinBuffer; parsing/routing to scroll buffer is T14 (needs T23 interactive-mode wiring) |
| T13, T14, T20, T21, T22 | PENDING | Scroll keybindings, wheel routing, indicator, wrap-on-resize, non-TTY bypass — require interactive-mode.ts scroll-buffer integration (T23) |
| T23–T26 | PENDING | SDD UI integration with scroll buffer + overlays + sanitizer |
