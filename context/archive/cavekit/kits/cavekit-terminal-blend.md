---
cavekit: terminal-blend
version: 1.0.0
status: draft
created: 2026-04-18
updated: 2026-04-18
related:
  - cavekit-visual-theme
  - cavekit-fullscreen-viewport
---

# Cavekit: Terminal Blend

## Scope

Make the `cave` TUI (and every surface it hosts, including the /ck:* SDD workflow output) blend visually into the host terminal regardless of terminal emulator, color scheme, or multiplexer. Covers: detection of the host terminal's background luminance and identity, ambient-aware theme selection, and the rules governing which UI surfaces may paint a background fill and which must remain transparent so the native terminal background shows through.

This kit layers on top of `cavekit-visual-theme`: that kit defines the palette tokens; this kit defines when and how they are actually emitted so the UI harmonizes with the surrounding terminal.

## Requirements

### R1: Host Terminal Background Detection

**Description:** On startup, before the first frame is rendered, the app must determine whether the host terminal background is "dark" or "light" using a layered detection strategy. Detection must work both locally and over SSH.

**Acceptance Criteria:**
- [ ] When the TTY supports OSC 11 queries, the app emits `ESC ] 11 ; ? BEL` (or `ESC ] 11 ; ? ESC \`) on stdout and parses the response `ESC ] 11 ; rgb:RRRR/GGGG/BBBB ESC \` within a 150ms timeout
- [ ] The parsed RGB is converted to relative luminance per WCAG 2.x; luminance >= 0.5 classifies the background as `light`, otherwise `dark`
- [ ] When OSC 11 is unavailable, times out, or returns no parseable payload, the app falls back to `COLORFGBG` env parsing: the trailing segment `0..6` or `8` classifies as `dark`, `7` or `9..15` classifies as `light`
- [ ] When neither OSC 11 nor `COLORFGBG` yields a result, the app falls back to `dark`
- [ ] Detection never blocks the UI more than 200ms total
- [ ] The final classification is exposed to the theme layer as one of `"dark" | "light"`
- [ ] Setting env `CAVE_TERM_BG=dark` or `CAVE_TERM_BG=light` overrides all detection unconditionally

**Dependencies:** None

### R2: Host Terminal Identity Detection

**Description:** The app must identify the host terminal/multiplexer family so capability-dependent behavior (OSC 11, truecolor, mouse wheel passthrough) can be gated correctly.

**Acceptance Criteria:**
- [ ] Detection observes, in order: `TERM_PROGRAM`, `TERM_PROGRAM_VERSION`, `GHOSTTY_RESOURCES_DIR`, `KITTY_WINDOW_ID`, `WEZTERM_EXECUTABLE`, `ALACRITTY_LOG`, `ITERM_SESSION_ID`, `VTE_VERSION`, `TMUX`, `STY` (GNU screen), `TERM`
- [ ] The detected identity is classified as one of: `ghostty`, `iterm2`, `apple-terminal`, `kitty`, `wezterm`, `alacritty`, `vte` (gnome-terminal family), `tmux`, `screen`, `linux-console`, `cmux`, `unknown`
- [ ] When `TMUX` is set and also a host-terminal indicator is set, the identity is reported as `tmux` and the outer host is retained as a secondary field
- [ ] When `STY` is set, the identity is reported as `screen`
- [ ] When `TERM=linux` and no graphical emulator indicator is present, the identity is `linux-console`
- [ ] Inside SSH (`SSH_TTY` set), identity is still detected from the above env vars; no SSH-specific branch disables blend behavior
- [ ] The identity value is observable for test via `CAVE_DEBUG_TERM=1` causing the app to print the detected identity and bg classification as the first line of stderr before entering the UI

**Dependencies:** None

### R3: Ambient Theme Selection

**Description:** Theme selection at startup is driven by the detected background classification from R1, not hardcoded to `dark`. The user's explicit configured theme (when set) still wins.

**Acceptance Criteria:**
- [ ] When no theme is configured by the user, R1's classification selects `dark.json` for `dark` and `light.json` for `light`
- [ ] When a theme is explicitly set in user config, that theme is loaded regardless of R1
- [ ] When `CAVE_TERM_BG` override is present (R1), the selected theme matches the override
- [ ] The selection decision is made once at process start; the theme does not swap mid-session based on any dynamic terminal signal

**Dependencies:** R1

### R4: Transparent Background Policy

**Description:** Surfaces that previously painted a bulk background fill must instead emit no background color so the terminal's native background shows through. Only surfaces defined as "contrast zones" (R5) are allowed to paint a background.

**Acceptance Criteria:**
- [ ] The root TUI frame emits no SGR background color for the bulk viewport area — the host terminal background is visible everywhere a contrast zone is not active
- [ ] Chat message rows (assistant, user, tool-call summaries that are not boxed) emit no SGR background color
- [ ] Status bar / hint bar text emits no SGR background color unless it is a contrast zone per R5
- [ ] Running `cave` under a terminal configured with a solid non-black, non-white background (for manual verification: a blue or purple terminal theme) shows that terminal color filling all non-contrast-zone areas of the app — verified by screenshot
- [ ] No chalk `bgRgb`, `bgHex`, `bgGray`, or equivalent SGR `48;…` code is emitted for surfaces outside contrast zones

**Dependencies:** R3

### R5: Contrast Zone Inventory

**Description:** A small, enumerated set of UI surfaces are allowed — and required — to paint a background, because they carry semantic contrast (selection, input focus, errors, code blocks). All other surfaces must remain transparent per R4.

**Acceptance Criteria:**
- [ ] The following surfaces, and only these, paint a background fill: (a) the active prompt input line, (b) the currently selected item in any list/menu/picker, (c) code blocks and diff hunks inside assistant messages, (d) modal/overlay panels (including the two-pane review overlay from cavekit-extension-workflow R1/R2), (e) error/warning toast banners, (f) the scroll-position indicator defined in cavekit-fullscreen-viewport R6
- [ ] Every contrast-zone background uses a color whose luminance differs from the host terminal background by at least 0.08 (WCAG relative luminance delta) under both `dark` and `light` classifications
- [ ] Under `light` classification, contrast-zone backgrounds are drawn from the light palette (never dark-palette values)
- [ ] Under `dark` classification, contrast-zone backgrounds are drawn from the dark palette (never light-palette values)
- [ ] Adding a new surface to the contrast-zone set requires an explicit entry in this requirement — no implicit expansion

**Dependencies:** R3, R4

### R6: Foreground Legibility Against Host Background

**Description:** Since the host terminal background is now visible through the app, foreground (text) colors must remain legible on whatever the terminal paints.

**Acceptance Criteria:**
- [ ] Under `dark` classification, every text foreground emitted by the app (excluding dimmed/comment variants) has WCAG contrast ratio >= 4.5:1 against `#000000`
- [ ] Under `light` classification, every text foreground emitted by the app (excluding dimmed/comment variants) has WCAG contrast ratio >= 4.5:1 against `#ffffff`
- [ ] Dimmed/secondary text has contrast ratio >= 3:1 against the same reference
- [ ] Accent colors (brand, accent cyan, semantic error/warning/success) meet >= 3:1 against both `#000000` and `#ffffff` so they remain visible regardless of the actual host background shade

**Dependencies:** R3

### R7: Multiplexer and Low-Color Degradation

**Description:** Terminals without truecolor support (tmux without `Tc`/`RGB`, GNU screen, Linux console, some SSH setups) must receive a palette that degrades cleanly rather than garbled 24-bit sequences.

**Acceptance Criteria:**
- [ ] When `COLORTERM` is `truecolor` or `24bit`, the app emits 24-bit SGR sequences (`38;2;R;G;B`)
- [ ] When `COLORTERM` is unset and `TERM` contains `256color`, the app emits 256-color SGR sequences (`38;5;N`) by nearest-match quantization of palette hex values
- [ ] When `TERM` is `linux` or any value not indicating 256+ colors, the app emits 16-color SGR sequences (`30-37`, `90-97`) by nearest-match quantization
- [ ] Under `tmux` identity (R2) without a truecolor indicator, the app emits at most 256-color sequences
- [ ] No unsupported SGR code is ever emitted that would leave visible literal escape characters in any of the four modes above — verified by running the app under each and observing no stray `[38;2;` text in the rendered frame

**Dependencies:** R2, R3

### R8: Theme Harmonization With Detected Background

**Description:** Beyond choosing dark vs light (R3), the selected theme's contrast-zone backgrounds (R5) must visibly harmonize with the detected host background, not fight it. This requirement holds the palette definitions from cavekit-visual-theme to a blend constraint.

**Acceptance Criteria:**
- [ ] Under `dark` classification, no contrast-zone background in use has luminance greater than 0.35 (WCAG relative luminance)
- [ ] Under `light` classification, no contrast-zone background in use has luminance less than 0.65
- [ ] Border/rule colors used around contrast zones are within 0.15 luminance of the contrast-zone background so panels read as panels rather than cutouts
- [ ] Brand and accent colors used for icons/headings are identical under both classifications (the same brand amber and accent cyan tokens from cavekit-visual-theme R2/R3 are emitted regardless of R1 classification)

**Dependencies:** R3, R5

## Out of Scope

- Theme authoring UI, theme marketplace, or user-facing theme-picker commands (cavekit-visual-theme owns the palette files themselves)
- Dynamic mid-session theme switching based on host terminal changes
- Per-component user overrides of contrast-zone backgrounds
- Animated color transitions or fade-ins
- Restyling the existing dark/light palette hex values — this kit constrains their use, not their definition; palette changes are cavekit-visual-theme's job
- Alternate-screen entry/exit and scroll-lock behavior — that is cavekit-fullscreen-viewport
- Mouse click, selection, or copy behavior beyond what R7 requires for escape-sequence safety

## Cross-References

- [cavekit-visual-theme](cavekit-visual-theme.md): defines the `dark.json` / `light.json` palette tokens that R3–R8 draw from; brand/accent tokens in R8 come from visual-theme R2/R3
- [cavekit-fullscreen-viewport](cavekit-fullscreen-viewport.md): the alt-screen viewport this kit's blending applies to; R5 references its scroll-indicator contrast zone
- [cavekit-extension-workflow](cavekit-extension-workflow.md): R5(d) lists the two-pane review overlay (extension-workflow R1/R2) as a contrast zone — its background fill is permitted by this kit

## Changelog

| Date       | Version | Change        |
|------------|---------|---------------|
| 2026-04-18 | 1.0.0   | Initial draft |
