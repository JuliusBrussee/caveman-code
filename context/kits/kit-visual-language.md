# Kit: Visual Language
**Domain:** visual-language
**Version:** 1.0.0
**Status:** draft

## Requirements

### R-001: Terminal-native visual identity
Interface must present a distinct terminal-native visual style rather than a generic application chrome. Visual treatment must read as deliberate, opinionated, and cohesive across primary screens.

**Acceptance Criteria:**
- AC-1: Primary screens use a consistent visual vocabulary for spacing, borders, density, and emphasis, with no screen appearing to follow a conflicting design style.
- AC-2: At least 3 persistent UI elements visibly reinforce terminal character through text-first styling, grid alignment, framing, or command-line idioms.
- AC-3: Visual hierarchy can be identified without color alone, using layout, typography, weight, framing, or position.

### R-002: Focused information density
UI must feel efficient and high-signal, favoring dense but readable presentation over spacious consumer-app styling. Users must be able to see meaningful state and context without excessive scrolling or mode switching.

**Acceptance Criteria:**
- AC-1: Main workspace view shows current context, active output, and available next actions within one standard terminal viewport.
- AC-2: No primary workflow requires decorative empty regions that occupy more space than the content they surround.
- AC-3: Repeated information is minimized so the same status or label is not redundantly shown in multiple prominent locations on one screen.

### R-003: Deliberate contrast and restraint
Color, decoration, and visual emphasis must be used sparingly and intentionally so that important state changes stand out. Default presentation must feel restrained rather than ornamental.

**Acceptance Criteria:**
- AC-1: Semantic emphasis states for success, warning, error, and active focus are visually distinguishable from neutral state.
- AC-2: Accent styling is reserved for interactive focus, key status, or brand moments and is not applied uniformly to all sections.
- AC-3: Interface remains understandable and navigable when viewed in monochrome or low-color terminal conditions.

## Out of Scope
- New rendering engine or terminal framework changes
- User-selectable theme marketplace or theme editor
- Marketing website or non-terminal brand design
