# Design System: DESIGN.md for AI Agents

## Quick Summary

DESIGN.md is a centralized visual specification document following the Google Stitch 9-section format. It defines colors, typography, spacing, components, and responsive behavior—allowing AI agents to build UIs consistently without scattering visual decisions across code.

## Key Takeaways

**Core Role:** DESIGN.md serves as a parallel constraint layer alongside kits and plans. While CLAUDE.md explains *how* to build and kits define *what must be true*, DESIGN.md specifies *what it looks like visually*.

**9-Section Structure:**
1. Visual Theme & Atmosphere (philosophy, mood)
2. Color Palette & Roles (semantic names, hex values, functional purpose)
3. Typography Rules (font stack, type scale with all properties)
4. Component Stylings (buttons, cards, inputs with all states)
5. Layout Principles (spacing scale, grid, border radius)
6. Depth & Elevation (shadow system, surface hierarchy)
7. Do's and Don'ts (concrete examples with code)
8. Responsive Behavior (breakpoints, mobile patterns)
9. Agent Prompt Guide (how AI agents should use this document)

**Design Token Convention:** Tokens use a consistent naming pattern (`--{category}-{name}[-{modifier}]`) that maps directly to CSS custom properties and Tailwind configurations.

**Integration Points:** DESIGN.md is referenced by kits (via acceptance criteria), plans (via design references in tasks), and the build phase (where agents read sections before implementing UI).

**Quality Standards:** Every value must be concrete (specific hex colors, pixel measurements, font weights). Generic descriptions like "clean and modern" don't qualify.
