---
cavekit: startup-experience
version: 1.0.0
status: approved
created: 2026-04-08
updated: 2026-04-11
---

# Cavekit: Startup Experience

## Scope

Replace the current startup header and Earendil announcement banner with a new branded startup experience: ASCII art logo, version display, keybinding hints, and cave mode status line.

## Requirements

### R1: ASCII Art Logo

**Description:** A small ASCII art mark must appear at startup, rendered in the brand color.

**Acceptance Criteria:**
- [ ] The startup output includes an ASCII art block that is 3 to 5 lines tall
- [ ] The ASCII art is rendered using the theme's brand color (the key established in cavekit-visual-theme R3)
- [ ] The ASCII art or an adjacent wordmark contains the text "Caveman Code" (may be stylized but must be recognizable as those two words)

**Dependencies:** cavekit-visual-theme R3 (brand color slot must exist)

### R2: Version Display

**Description:** The application version must appear in muted text near the logo.

**Acceptance Criteria:**
- [ ] The startup output includes a version string matching the semver pattern `\d+\.\d+\.\d+`
- [ ] The version text uses a muted/dim style (not the accent or brand color)
- [ ] The version value matches the version from the package's `package.json`

**Dependencies:** None

### R3: Keybinding Hints

**Description:** Common keybinding hints must appear in muted gray below or beside the logo.

**Acceptance Criteria:**
- [ ] The startup output includes at least 3 keybinding hints (e.g., Escape, Enter, shortcuts)
- [ ] The hints use a muted/dim style (not accent or brand color)
- [ ] Each hint shows both the key name and its action

**Dependencies:** None

### R4: Cave Mode Status Line

**Description:** When cave mode is active, a subtle status line must appear below the logo area.

**Acceptance Criteria:**
- [ ] When cave mode is active, the startup output includes a line containing both "cave mode" (case-insensitive) and "compression" (case-insensitive)
- [ ] This status line uses muted cyan styling (the accent color or a dim variant of it)
- [ ] When cave mode is not active, this status line does not appear

**Dependencies:** cavekit-visual-theme R2 (accent color)

### R5: Earendil Announcement Removal

**Description:** The separate boxed Earendil announcement banner must be removed from the startup flow; its functionality is replaced by the new startup header.

**Acceptance Criteria:**
- [ ] The `EarendilAnnouncementComponent` is not rendered during startup in `interactive-mode.ts`
- [ ] The component file `packages/coding-agent/src/modes/interactive/components/earendil-announcement.ts` either no longer exists or is not imported by the interactive mode startup path
- [ ] No boxed/bordered announcement banner appears at startup

**Dependencies:** cavekit-brand-cleanup R9 (fallback text must be correct before removal)

### R6: Contextual Action Bar

**Description:** The interactive mode must display a contextual action bar (between the editor input and the footer) that renders state-appropriate keybinding/action chips — providing live feedback about streaming state, bash mode, cavekit active, and other runtime conditions without cluttering the main conversation area.

**Acceptance Criteria:**
- [ ] An `ActionBarComponent` exists at `packages/coding-agent/src/modes/interactive/components/action-bar.ts`
- [ ] The component renders a single line of chips separated by `│` delimiters, with leading whitespace
- [ ] Chips are truncated gracefully when terminal width is insufficient — no overflow or line wrapping
- [ ] Streaming state (active vs idle) is reflected in the chip set — at minimum, a streaming indicator appears during LLM generation
- [ ] Bash mode active state is reflected in the chip set
- [ ] Cavekit active state is reflected in the chip set
- [ ] All chip colors use values from the active theme (not hardcoded hex)
- [ ] The component is added to the interactive mode's UI children list and rendered between the input editor and footer

**Dependencies:** cavekit-visual-theme R2 (accent color for chip theming)

## Out of Scope

- Animated startup intros or typewriter effects
- Rotating or randomized ASCII art
- User-configurable startup messages or custom art
- Splash screen or loading spinner during initialization
- Changes to the startup logic beyond the header/banner rendering

## Cross-References

- [cavekit-visual-theme](cavekit-visual-theme.md): R3 (brand color) and R2 (accent color) provide the colors used in this domain
- [cavekit-brand-cleanup](cavekit-brand-cleanup.md): R9 ensures the Earendil component has correct fallback text before this domain removes it

## Changelog

| Date       | Version | Change         |
|------------|---------|----------------|
| 2026-04-08 | 1.0.0   | Initial draft  |

### 2026-04-11 — Revision
- **Affected:** R6 (new)
- **Summary:** Added R6 — Contextual Action Bar. Manual fix introduced `ActionBarComponent` rendering state-aware chips in the interactive mode's UI tree (streaming/bash/cavekit state). No kit covered ongoing interactive-mode status display; this requirement fills that gap.
- **Commits:** 19e1bc30
