# CaveKit Design System

Integrate a design system into the CaveKit workflow so that every UI component is built on a consistent foundation of tokens, primitives, and patterns.

## Workflow

1. Document the design system's token set in DESIGN.md (colors, spacing, typography, radii)
2. Every AC that touches UI references specific design system tokens by name
3. The `ck:design` command scaffolds component specs pre-populated with the correct tokens
4. Deviations from the design system require an explicit waiver documented in the kit
5. Design system upgrades are treated as brownfield migrations with a dedicated kit
