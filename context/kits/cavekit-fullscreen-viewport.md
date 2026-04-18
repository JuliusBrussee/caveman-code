---
cavekit: fullscreen-viewport
version: 1.0.0
status: draft
created: 2026-04-18
updated: 2026-04-18
related:
  - cavekit-terminal-blend
  - cavekit-extension-workflow
  - cavekit-visual-theme
---

# Cavekit: Fullscreen Viewport

## Scope

The `cave` coding agent and every surface it hosts — including the SDD workflow output from `/ck:sketch`, `/ck:map`, `/ck:make`, and `/ck:check` — must run as a full-terminal, scroll-locked application. The host terminal's scrollback must not be accessible while the app is running; a dedicated in-app scroll buffer replaces it with its own keybindings and follow-tail behavior. On exit, the terminal is restored to exactly the state it was in before launch.

This kit owns: alt-screen entry/exit, viewport sizing and resize handling, in-app scroll buffer semantics, keybindings, follow-tail behavior, and the SDD-UI integration contract.

## Requirements

### R1: Alternate Screen Buffer

**Description:** On startup, the app must enter the terminal's alternate screen buffer so the prior terminal contents are preserved and the app occupies the full viewport. On exit, the alternate buffer must be left cleanly.

**Acceptance Criteria:**
- [ ] On process start, before the first frame, stdout emits `ESC [ ? 1049 h` (CSI `?1049h`) to enter the alt screen
- [ ] On process start, after entering alt screen, stdout emits `ESC [ ? 25 l` (hide cursor) and `ESC [ 2 J` (clear viewport)
- [ ] On graceful exit, stdout emits `ESC [ ? 25 h` (show cursor) and `ESC [ ? 1049 l` (leave alt screen) before the process terminates
- [ ] On `SIGINT`, `SIGTERM`, `SIGHUP`, and uncaught exception the same exit sequence is emitted before the process exits
- [ ] After exit, the user's pre-launch terminal contents and cursor position are visible again — verified by running `echo before && cave && echo after` and observing that `before` text is still present on screen with no UI residue between the two echoes
- [ ] When stdout is not a TTY (piped, redirected, non-interactive), alt-screen sequences are not emitted and the app runs in non-interactive mode

**Dependencies:** None

### R2: Viewport Occupies Full Terminal

**Description:** While running, the app renders to exactly the full width and height of the terminal. It never leaves a gap above or below itself, and it never extends beyond the viewport into scrollback.

**Acceptance Criteria:**
- [ ] The rendered frame's top row is terminal row 1 and the frame's bottom row is the terminal's last row (rows = `process.stdout.rows`, cols = `process.stdout.columns`)
- [ ] No frame written by the app emits a line ending that causes the alt-screen cursor to advance past the last row (no trailing `\n` past the final row)
- [ ] The app writes no content to any row or column outside the viewport bounds
- [ ] Reducing the terminal to a degenerate size (rows < 4 or cols < 20) still renders without crashing and without writing outside bounds; a minimal placeholder frame is acceptable

**Dependencies:** R1

### R3: Resize Handling

**Description:** When the host terminal resizes, the app must re-measure and re-render into the new dimensions without corruption, without ever writing outside the new bounds, and without losing scroll-buffer content.

**Acceptance Criteria:**
- [ ] A `SIGWINCH` signal triggers a full re-measure of `process.stdout.rows` / `process.stdout.columns` and a full re-render within one animation tick (<= 100ms)
- [ ] After resize, R2's bounds requirement still holds with the new dimensions
- [ ] After resize, the scroll buffer retains its content and its scroll position either follows the tail (when in tail mode per R5) or clamps to the nearest valid offset (when scrolled up)
- [ ] Shrinking the terminal below the minimum usable size (rows < 4 or cols < 20) falls back to R2's minimal placeholder without crash

**Dependencies:** R2

### R4: Scroll-Lock Against Host Terminal Scrollback

**Description:** While the app is running, the user must not be able to use the host terminal's native scrollback (Shift+PageUp, mouse wheel in terminals that would otherwise pass it to scrollback, `tmux` copy-mode scroll, etc.) to reveal content above the app. All scrolling is mediated by the app's in-app buffer (R5).

**Acceptance Criteria:**
- [ ] Alt-screen mode per R1 inherently disables host scrollback for the app's lifetime (the alt buffer has no scrollback) — verified in ghostty, iTerm2, Apple Terminal, Kitty, WezTerm, Alacritty, gnome-terminal, tmux, and screen by attempting Shift+PageUp/Shift+PageDown and observing no change to the on-screen contents
- [ ] Mouse wheel events received on stdin are consumed by the app (R5) and never forwarded to the host terminal's scrollback — verified by wheel-scrolling and observing the in-app buffer scroll, not the terminal
- [ ] No frame emitted by the app writes to a line that would push earlier content into the host terminal's main-buffer scrollback
- [ ] Closing the app (graceful or signal-driven) restores host scrollback to its pre-launch state per R1

**Dependencies:** R1, R5

### R5: In-App Scroll Buffer

**Description:** The chat/transcript surface maintains its own in-memory scroll buffer with a user-controlled viewport and follow-tail behavior. Streaming output appends to the tail of the buffer; the user can scroll back through the buffer without losing position when new content streams in.

**Acceptance Criteria:**
- [ ] The scroll buffer stores all rendered chat content for the current session — every assistant message, user message, tool-call summary, and SDD workflow line is retained and reachable by scrolling up
- [ ] The buffer has two modes: `tail` (auto-sticks to the bottom as new content arrives) and `paused` (viewport stays fixed at the user's chosen offset as new content arrives)
- [ ] The buffer transitions from `tail` to `paused` the moment the user scrolls up by any amount
- [ ] The buffer transitions from `paused` back to `tail` when (a) the user scrolls all the way to the bottom, or (b) the user presses the explicit "jump to latest" keybinding (R6)
- [ ] In `paused` mode, new content is appended to the buffer but the visible viewport is not scrolled; scroll offset from the bottom is preserved within 1 line on every append
- [ ] Buffer content persists for the life of the process; no session-level retention limit is imposed by this kit (memory bounds are an implementation concern)

**Dependencies:** R2

### R6: Scroll Keybindings and Indicator

**Description:** The in-app scroll buffer is driven by a fixed, documented keybinding set. When the user is not at the tail, a visible indicator shows that there is newer content below the viewport.

**Acceptance Criteria:**
- [ ] `PageUp` scrolls the buffer up by one viewport height minus 1 line; `PageDown` scrolls down by the same amount
- [ ] `Shift+Up` scrolls the buffer up by 1 line; `Shift+Down` scrolls the buffer down by 1 line
- [ ] `Ctrl+U` scrolls up by half a viewport height; `Ctrl+D` scrolls down by half a viewport height
- [ ] Mouse wheel up scrolls up by 3 lines per wheel tick; wheel down scrolls down by 3 lines per tick — only active when the host terminal delivers mouse events (R7)
- [ ] `End` (or the dedicated "jump to latest" key) returns the buffer to tail mode and scrolls to the newest line
- [ ] When the buffer is in `paused` mode and new content has arrived since the pause, an indicator is rendered in a fixed screen location (for example, a status strip above the input) showing either a count of new lines/messages or an unambiguous "new" marker
- [ ] The indicator disappears within one render tick after the user returns to tail mode
- [ ] None of the above keybindings conflict with the existing input line's text-editing bindings (plain `Up`/`Down` and plain letters are reserved for the input line and history per existing agent behavior)

**Dependencies:** R5

### R7: Mouse Wheel Event Capture

**Description:** To make wheel-scrolling route to the in-app buffer rather than the host terminal, the app enables mouse-event reporting on entry and disables it on exit.

**Acceptance Criteria:**
- [ ] On startup (after R1's alt-screen entry), stdout emits `ESC [ ? 1000 h` and `ESC [ ? 1006 h` to enable SGR-encoded mouse event reporting
- [ ] On exit (all paths from R1), stdout emits `ESC [ ? 1006 l` and `ESC [ ? 1000 l` to disable mouse reporting before leaving alt screen
- [ ] Incoming mouse wheel events (SGR code 64/65) are routed to the in-app scroll buffer per R6 and are not echoed or re-emitted
- [ ] When the host terminal does not support mouse reporting (no response, or `TERM=linux`), wheel scrolling is simply unavailable — the keyboard bindings in R6 still work and no error is shown
- [ ] Non-wheel mouse events (clicks, drags) are swallowed without side effects — this kit does not define click behavior

**Dependencies:** R1, R6

### R8: SDD Workflow Integration

**Description:** Output from `/ck:sketch`, `/ck:map`, `/ck:make`, and `/ck:check` streams into the same in-app scroll buffer as normal chat output. Long kits, plans, and reports must be scrollable, must not be clipped, and must not break the viewport layout. Interactive gates (approval overlays from cavekit-extension-workflow R1/R2) must remain usable.

**Acceptance Criteria:**
- [ ] Streamed SDD output is appended to the scroll buffer line-by-line and obeys R5's tail/paused modes exactly like normal assistant output
- [ ] Lines from SDD output that exceed the viewport width are wrapped (not truncated) at the current viewport width; after resize (R3) the wrap is recomputed
- [ ] A kit file of at least 300 rendered lines can be scrolled through top-to-bottom using the R6 keybindings with every line reachable
- [ ] While SDD output is actively streaming, the two-pane review overlay from cavekit-extension-workflow R1/R2, when triggered, renders on top of the viewport as a modal contrast zone (per cavekit-terminal-blend R5(d)) and its approve/abort interaction is unaffected by the scroll buffer state
- [ ] Dismissing the review overlay returns control to the scroll buffer with its prior scroll position intact (tail mode stays tail; paused mode stays at the prior offset)
- [ ] SDD output does not emit any control sequence that would bypass R2 bounds or R4 scroll-lock (no raw cursor-home to row 1 outside the app's renderer, no direct writes to stdout that skip the in-app buffer)

**Dependencies:** R2, R5, R6

### R9: Clean Exit Under All Paths

**Description:** Every exit path must restore the terminal. This is a hard invariant because the app leaves the terminal in an unusable state (alt-screen, hidden cursor, mouse reporting on) if any of these are skipped.

**Acceptance Criteria:**
- [ ] Normal exit (user types quit command or EOF) emits the full teardown sequence from R1 and R7 before the process returns
- [ ] `SIGINT` (Ctrl+C at OS level when not captured as agent-cancel), `SIGTERM`, and `SIGHUP` all emit the full teardown sequence before exit
- [ ] An uncaught exception in the render loop emits the teardown sequence before the process exits with a non-zero code
- [ ] After any of the above, a subsequent shell prompt in the same terminal session has: cursor visible, alt screen exited, mouse reporting off, SGR reset — verified by launching `cave`, triggering the exit path, and confirming the next prompt behaves normally (typed characters echo, mouse wheel scrolls terminal scrollback)

**Dependencies:** R1, R7

## Out of Scope

- Background detection and theme selection — see cavekit-terminal-blend
- Palette/token definitions — see cavekit-visual-theme
- Text selection and clipboard copy from within the viewport (users can rely on the terminal's native selection mechanism over the alt buffer; this kit does not define in-app selection)
- Mouse click, drag, or right-click menus
- Multi-pane split layouts within the viewport beyond what is already rendered (prompt line + chat + any status strip)
- Persisting scroll buffer contents across sessions
- A dedicated search/find-in-buffer feature
- Configurable keybindings — R6 bindings are fixed by this kit
- Modifying the `/ck:*` command prompts or approval logic (owned by cavekit-extension-workflow)

## Cross-References

- [cavekit-terminal-blend](cavekit-terminal-blend.md): R4/R5 transparent/contrast-zone rules govern how this viewport paints; R5(d) explicitly covers the overlay used in R8; R5(f) covers the scroll indicator in R6
- [cavekit-extension-workflow](cavekit-extension-workflow.md): R1/R2 review overlays are the modal surfaces integrated in R8; their interaction contract is unchanged
- [cavekit-visual-theme](cavekit-visual-theme.md): provides the palette tokens used by the scroll indicator and any contrast-zone fills inside this viewport

## Changelog

| Date       | Version | Change        |
|------------|---------|---------------|
| 2026-04-18 | 1.0.0   | Initial draft |
