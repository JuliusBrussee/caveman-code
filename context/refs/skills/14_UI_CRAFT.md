# UI Craft: Implementation Guide

This is Anthropic's comprehensive reference for building exceptional user interfaces. Here are the key takeaways:

## Core Philosophy
The guide emphasizes that "unseen details compound" — small decisions around spacing, timing, and shadows collectively create interfaces that feel polished rather than generic. It explicitly warns against "AI slop aesthetics" like gratuitous gradients and cookie-cutter layouts.

## Priority Stack
Implementation follows a hierarchy:
1. **Accessibility** (non-negotiable)
2. **Performance** (high priority)
3. **Typography** (high priority)
4. **Layout & spatial design** (high priority)
5. **Color & theme** (medium)
6. **Motion & interaction** (medium)
7. **Polish & details** (low)

Never chase lower priorities while skipping critical items.

## Aesthetic Direction
Commit to one clear tone—brutalist, maximalist, retro, organic, luxury, editorial, or playful—and execute with precision. The guide cautions against converging on safe defaults like Inter font, purple gradients, or generic hero sections.

## Technical Essentials
- **Typography**: Use `text-wrap: balance` for headings, `tabular-nums` for dynamic numbers, maintain 65-character line length
- **Color**: Employ HSL custom properties with semantic tokens; test dark mode separately
- **Spacing**: Follow 4/8px incremental scale consistently
- **Motion**: Match animation duration to usage frequency; respect `prefers-reduced-motion`
- **Accessibility**: Prioritize semantic HTML, visible focus rings, and keyboard navigation

The guide includes detailed implementation patterns for components, form handling, modals, and comprehensive accessibility requirements.
