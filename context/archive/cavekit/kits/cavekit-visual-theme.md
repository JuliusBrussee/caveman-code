---
cavekit: visual-theme
version: 1.0.0
status: approved
created: 2026-04-08
updated: 2026-04-08
---

# Cavekit: Visual Theme

## Scope

Overhaul the default dark theme palette to a cool navy-dark aesthetic with electric cyan accent and amber brand color. Apply a complementary update to the light theme. Extend the theme schema if needed to support the new brand color slot.

## Requirements

### R1: Dark Theme Background Palette

**Description:** The dark theme must shift from warm dark tones to a cool navy-dark family.

**Acceptance Criteria:**
- [ ] `packages/coding-agent/src/modes/interactive/theme/dark.json` has its primary background color in the `#1a1b2e` to `#1e1f35` range (hue 230-250, saturation 15-40%, lightness 10-15%)
- [ ] Card background, tool background, and export page background values in `dark.json` are in the same cool navy hue family (hue 230-250)
- [ ] No background color in `dark.json` has a warm hue (hue 0-60 or 300-360) unless it is a semantic color (error, warning)

**Dependencies:** None

### R2: Dark Theme Accent Color

**Description:** The primary accent color must shift from muted teal to electric cyan.

**Acceptance Criteria:**
- [ ] `dark.json` defines the accent color as `#00d7ff` (or a hex value within deltaE < 5 of `#00d7ff` in CIELAB space)
- [ ] The previous muted teal value `#8abeb7` does not appear anywhere in `dark.json`

**Dependencies:** None

### R3: Brand Color Slot

**Description:** The theme must include a dedicated brand color slot for identity/logo moments, set to amber.

**Acceptance Criteria:**
- [ ] `dark.json` contains a key whose name includes `brand` (e.g., `brand`, `brandColor`, `brand-color`)
- [ ] That key's value is `#E8A840` (or within deltaE < 5 of `#E8A840`)
- [ ] `packages/coding-agent/src/modes/interactive/theme/theme-schema.json` defines the brand color slot if a schema validation file exists
- [ ] `light.json` also contains the same brand color key

**Dependencies:** None

### R4: Dark Theme Border Colors

**Description:** Border colors must be subtler and darker than the current values, consistent with the navy palette.

**Acceptance Criteria:**
- [ ] Every border color value in `dark.json` has a lightness value (HSL L) no greater than 25%
- [ ] Border colors are in the cool hue family (hue 200-270) or are achromatic (saturation < 5%)

**Dependencies:** R1

### R5: Dark Theme Interactive State Colors

**Description:** User message backgrounds and selected-item backgrounds must shift to navy tones.

**Acceptance Criteria:**
- [ ] The user message background color in `dark.json` has hue in the 220-260 range
- [ ] The selected/highlighted background color in `dark.json` has hue in the 220-260 range
- [ ] Neither value has a warm hue (0-60 or 300-360)

**Dependencies:** R1

### R6: Light Theme Complementary Update

**Description:** The light theme must receive a complementary palette update that pairs with the dark theme.

**Acceptance Criteria:**
- [ ] `light.json` defines the same accent color key as `dark.json`, with a value that has the same hue (within +/- 15 degrees) as the dark accent
- [ ] `light.json` contains the brand color key with the amber value (same as R3)
- [ ] `light.json` primary background remains light (HSL L > 90%)

**Dependencies:** R2, R3

## Out of Scope

- New theme engine or theme switching mechanism
- Theme marketplace or user-created theme tooling
- Animated color transitions
- Per-component theme overrides beyond what the existing schema supports
- Changes to the theme loading/resolution code (only JSON data files and schema change)

## Cross-References

- [cavekit-startup-experience](cavekit-startup-experience.md): Startup domain uses the brand color (R3) for the ASCII art logo
- [cavekit-brand-cleanup](cavekit-brand-cleanup.md): Brand cleanup is independent but both contribute to the rebrand

## Changelog

| Date       | Version | Change         |
|------------|---------|----------------|
| 2026-04-08 | 1.0.0   | Initial draft  |
