
# UI Craft: Implementation Guide for Exceptional Interfaces

> If a DESIGN.md exists at the project root, its tokens and specifications override all defaults in this skill. This skill provides sensible defaults for when no design system exists, and implementation guidance that applies regardless.

> For deep dives on any section, see the reference files in this skill's `references/` directory.

---

## 1. Core Philosophy

Taste is trained, not innate. Study why great interfaces feel right. Deconstruct apps you admire — the spacing, the timing, the weight of a shadow. The gap between "fine" and "exceptional" is built from hundreds of micro-decisions that users feel but never consciously notice.

**Unseen details compound.** A single rounded corner, a single eased transition, a single well-chosen shadow — none of these matter alone. Together they become "a thousand barely audible voices singing in tune." The cumulative effect is what separates craft from output.

**Beauty is leverage.** Polish is not vanity. Good defaults, considered typography, and intentional motion are real differentiators. Users trust interfaces that feel cared for. Investors notice. Competitors can't easily replicate taste.

**Intentionality over intensity.** Both bold maximalism and refined minimalism work — what fails is the absence of a clear point of view. Every visual decision should trace back to a deliberate conceptual direction. If you can't articulate WHY a choice was made, reconsider it.

**Choose a direction and execute with precision.** Don't hedge between styles. A brutalist page committed fully will always outperform a page that's "a little bit of everything." Commit, then refine.

**NEVER produce generic "AI slop" aesthetics.** No gratuitous gradients on white backgrounds. No cookie-cutter hero sections with stock illustrations. No safe, forgettable layouts that could belong to any product. Every interface should have a point of view that makes it recognizable.

---

## 2. The Priority Stack

When implementing UI, work through these priorities in order. Higher priorities are non-negotiable; lower priorities are polish that compounds quality.

| Priority | Level | What It Means |
|----------|-------|---------------|
| **Accessibility** | CRITICAL | Contrast 4.5:1, keyboard nav, ARIA semantics, visible focus rings. Ship nothing that excludes users. |
| **Performance** | HIGH | WebP/AVIF images, lazy loading below fold, CLS < 0.1, transform-only animations on the compositor thread. |
| **Typography** | HIGH | Font smoothing, text-wrap balance/pretty, tabular-nums for data, 65ch max line length. |
| **Layout & Spatial** | HIGH | 4/8px grid, concentric border radius, optical alignment over geometric. |
| **Color & Theme** | MEDIUM | HSL custom properties, semantic tokens, dark mode pairs tested separately. |
| **Motion & Interaction** | MEDIUM | Frequency-based animation decisions, 150-300ms durations, ease-out default. |
| **Polish & Details** | LOW | Layered shadows over borders, press feedback on buttons, staggered enter animations. |

Never skip a CRITICAL/HIGH item to chase a LOW item. A beautifully animated button that fails keyboard navigation is a net negative.

---

## 3. Aesthetic Direction

Before writing a single line of CSS, commit to a bold aesthetic direction. The most common failure mode in AI-generated UI is convergence on the same safe, forgettable look.

### Pick a Tone

Choose one and commit fully:

- **Brutally minimal** — generous whitespace, monospace type, stark contrast, near-zero decoration
- **Maximalist chaos** — layered textures, clashing type scales, dense information, intentional visual noise
- **Retro-futuristic** — CRT glow effects, monospace terminals, scan lines, neon on dark
- **Organic / natural** — earth tones, rounded shapes, paper textures, hand-drawn accents
- **Luxury / refined** — serif headlines, muted palettes, ample negative space, subtle gold or cream accents
- **Editorial / magazine** — dramatic type hierarchy, full-bleed imagery, grid-breaking layouts
- **Playful / bold** — bright primaries, chunky borders, exaggerated shadows, bouncy motion

### Match Complexity to Vision

Maximalist design demands elaborate code — layered backgrounds, complex grid structures, multiple font stacks. Minimalist design demands surgical precision — every pixel of spacing matters more when there's nothing to hide behind.

### The Ban List (When No DESIGN.md Exists)

When building without an existing design system, avoid these overused defaults that signal "AI-generated":

- **Fonts**: Inter, Roboto, Arial, system-ui as display fonts, Space Grotesk
- **Colors**: Purple-to-blue gradients on white backgrounds
- **Patterns**: Generic hero with centered text + CTA + stock illustration

Vary between light and dark themes, different font pairings, different aesthetic directions. Never converge on the same choices across projects.

### Visual Texture

Add depth through: gradient meshes, noise/grain overlays (`filter: url(#noise)`), layered transparencies, subtle background patterns, duotone image treatments.

**DESIGN.md overrides this entire section.** If DESIGN.md specifies Inter, use Inter. If it specifies purple gradients, use them. The ban list only applies when no design system exists and you're making aesthetic choices from scratch.

---

## 4. Typography Essentials

Typography is the single highest-leverage design element. Get it right and mediocre layouts still feel good. Get it wrong and nothing else saves it.

### Root Setup

```css
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```

Apply font smoothing to the root layout. On macOS, the default sub-pixel rendering makes text appear heavier than the designer intended.

### Text Wrapping

```css
h1, h2, h3, h4, h5, h6 {
  text-wrap: balance;
}

p, li, dd, blockquote {
  text-wrap: pretty;
}
```

`balance` distributes heading lines evenly. `pretty` avoids orphaned words in body text.

### Numeric Display

```css
.data-value, .price, .counter, [data-numeric] {
  font-variant-numeric: tabular-nums;
}
```

Use `tabular-nums` for any number that updates dynamically — prices, counters, table columns. Without it, layout shifts as digit widths change.

### Scale and Rhythm

- **Base size**: 16px minimum for body text. Never go below 14px for any readable content.
- **Line height**: 1.5-1.75 for body text, 1.1-1.3 for large headings.
- **Max line length**: `max-width: 65ch` for body text. Long lines destroy readability.
- **Type scale**: Pick a consistent scale and stick to it: 12 / 14 / 16 / 18 / 24 / 32 / 48 / 64.

### Font Pairing

Pair a distinctive display font with a refined body font. The display font carries personality; the body font carries readability. Use `font-weight` for hierarchy within a family:

- **Headings**: 600-700 (semibold to bold)
- **Body**: 400 (regular)
- **Labels / UI**: 500 (medium)

Always include font stack fallbacks:

```css
--font-display: "Instrument Serif", "Georgia", serif;
--font-body: "Söhne", "Helvetica Neue", sans-serif;
--font-mono: "JetBrains Mono", "Fira Code", monospace;
```

---

## 5. Color & Theme

### HSL Custom Properties (shadcn Pattern)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  --radius: 0.5rem;
}
```

Define semantic tokens: primary, secondary, destructive, muted, accent, background, foreground. Reference colors by semantic name — never hardcode hex values in components.

### Dark Mode

```css
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... desaturated, lighter tonal variants — NOT simply inverted */
}
```

Dark mode is not "invert colors." Use desaturated, lighter tonal variants. Backgrounds go dark but not pure black (`#000`). Text goes light but not pure white (`#fff`). Test contrast separately for dark mode — what passes in light may fail in dark.

### Contrast Requirements

- **WCAG AA minimum**: 4.5:1 for normal text, 3:1 for large text (18px+ bold or 24px+ regular)
- Never convey information by color alone — always pair with an icon, label, or pattern
- Test with browser devtools contrast checker or axe-core

### Color Confidence

Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Pick one or two hero colors and let the rest of the palette recede. A confident palette has clear hierarchy; an uncertain palette spreads color evenly and feels flat.

---

## 6. Spatial Design

### Concentric Border Radius

This is the single most common thing that makes nested UI elements feel "off":

```
outer_radius = inner_radius + padding
```

```css
/* Correct: concentric */
.card        { border-radius: 16px; padding: 8px; }
.card-inner  { border-radius: 8px; }  /* 16 - 8 = 8 */

/* Wrong: same radius on parent and child */
.card        { border-radius: 12px; }
.card-inner  { border-radius: 12px; }  /* Looks bloated */
```

When geometric centering looks off, align optically. Play/pause icons, dropdown carets, and asymmetric glyphs often need 1-2px manual nudges to look centered.

### Shadows Over Borders

Layer multiple transparent `box-shadow` values for natural depth instead of using borders:

```css
.elevated {
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 2px 4px rgba(0, 0, 0, 0.04),
    0 4px 8px rgba(0, 0, 0, 0.04);
}
```

Multiple shadows at different spreads mimic how light works. A single hard shadow looks artificial.

### Image Outlines

Add a subtle inset outline to images and media for consistent depth against varied backgrounds:

```css
img, video {
  outline: 1px solid rgba(0, 0, 0, 0.06);
  outline-offset: -1px;
}
```

### Spacing Scale

Use a 4px / 8px base incremental system. Every spacing value should be a multiple of 4:

`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128`

### Hit Areas

Minimum 44x44px for all interactive elements. If the visual element is smaller, extend the hit area with a pseudo-element:

```css
.small-button::before {
  content: "";
  position: absolute;
  inset: -8px;
}
```

### Z-Index Scale

Define a layered scale and never use arbitrary values:

```css
--z-base: 0;
--z-dropdown: 10;
--z-sticky: 20;
--z-overlay: 40;
--z-modal: 100;
--z-toast: 1000;
```

---

## 7. Motion & Interaction

### The Frequency-Based Decision Framework

This is the most important mental model for animation decisions:

| Frequency | Examples | Animation |
|-----------|----------|-----------|
| **100+ times/day** | Keyboard shortcuts, command palette actions, tab switches | **None.** Zero animation. Instant. |
| **Tens of times/day** | Hover effects, list item navigation, toggles | **Remove or drastically reduce.** 50-100ms max. |
| **Occasional** | Modals, drawers, toasts, page transitions | **Standard animation.** 150-300ms. |
| **Rare / first-time** | Onboarding, celebrations, empty states | **Can add delight.** 300-500ms, more elaborate. |

High-frequency animations feel sluggish. Low-frequency animations without motion feel jarring. Match the animation budget to usage frequency.

### Custom Easing Curves

Built-in CSS easings (`ease`, `ease-in-out`) are too weak. Define custom curves:

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### Duration Guide

| Element | Duration |
|---------|----------|
| Buttons, toggles | 100-160ms |
| Tooltips | 125-200ms |
| Dropdowns, popovers | 150-250ms |
| Modals, drawers | 200-500ms |
| Page transitions | 250-400ms |

UI animations should stay under 300ms. Never use `ease-in` for UI animations — it front-loads the pause and feels sluggish.

### Enter/Exit Asymmetry

Exits should be softer and faster than enters. An enter animation at 250ms should have its exit at 150-200ms.

### Split and Stagger Enter Animations

When multiple elements enter the viewport, stagger them by semantic chunks with ~50-100ms delay:

```css
.stagger-item {
  animation: fadeSlideIn 300ms var(--ease-out) both;
}
.stagger-item:nth-child(1) { animation-delay: 0ms; }
.stagger-item:nth-child(2) { animation-delay: 60ms; }
.stagger-item:nth-child(3) { animation-delay: 120ms; }
```

### Scale Animations

Never animate from `scale(0)`. Start from `scale(0.9)` or higher, combined with opacity:

```css
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}
```

### Press Feedback

Every pressable element should scale down slightly on `:active`:

```css
button:active {
  transform: scale(0.97);
}
```

### Interruptibility

Use CSS transitions (not keyframe animations) for interactive state changes. Transitions can be interrupted mid-way; keyframes cannot. This matters for hover states, toggles, and any element the user might interact with rapidly.

### Popover Origin

Make popovers transform-origin aware — they should grow from their trigger element, not from center. Exception: modals always originate from center.

### Tooltip Hover Delay

Skip the tooltip delay on subsequent hovers. If the user has already waited for one tooltip, show the next one immediately.

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Respect `prefers-reduced-motion`. Reduce animations — don't eliminate opacity and color transitions entirely, as those provide important feedback.

### Hover Gate

Gate hover animations behind a media query so touch devices don't trigger stuck hover states:

```css
@media (hover: hover) and (pointer: fine) {
  .card:hover { transform: translateY(-2px); }
}
```

> Reference `references/animation-playbook.md` for deep dives on spring physics, gesture-driven animation, and complex choreography.

---

## 8. Component Craft

### Primitives

Use Radix UI primitives for accessible, unstyled foundations. Use CVA (class-variance-authority) for type-safe component variants:

```tsx
import { cva } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        default: "h-10 px-4 py-2",
        lg: "h-11 px-8 text-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
```

### Button

- Scale on press (`transform: scale(0.97)` on `:active`)
- Visible focus ring (never `outline: none` without replacement)
- Loading state with spinner replacing label, maintaining button dimensions
- Disabled state at `opacity: 0.5` with `pointer-events: none`

### Card

- Concentric border radius between card and inner elements
- Layered shadows (not borders) for depth
- Hover state: subtle elevation change (`translateY(-1px)` + shadow increase)

### Dialog / Modal

- Focus trap (keyboard cannot escape to elements behind)
- ESC to close, click outside overlay to close
- `transform-origin: center`, fade + scale enter animation
- `aria-modal="true"`, `role="dialog"`, `aria-labelledby`

### Form

- Visible labels always — never placeholder-only inputs
- Error messages near the field with `aria-live="polite"` for screen readers
- Progressive disclosure: show advanced fields only when needed
- Use React Hook Form + Zod for validation

### Theming

Use shadcn CSS variable pattern (HSL format) for all component colors. Wrap client-interactive components in server components for Next.js App Router compatibility.

> Reference `references/component-patterns.md` for the full component catalog with copy-paste implementations.

---

## 9. Accessibility Essentials

### Semantic HTML First

Use `<button>`, `<nav>`, `<main>`, `<header>`, `<footer>`, `<article>`, `<section>` before reaching for ARIA. A `<button>` gives you keyboard handling, focus management, and screen reader semantics for free. A `<div onClick>` gives you none of that.

### Keyboard Navigation

- **Tab / Shift+Tab**: move between focusable elements
- **Enter / Space**: activate buttons and links
- **Arrow keys**: navigate within lists, menus, tabs, radio groups
- **Escape**: close modals, popovers, dropdowns
- **Home / End**: jump to first/last item in lists

### Focus Management

- Visible focus rings on all interactive elements — NEVER use `outline: none` without a replacement
- Trap focus inside modals (Tab wraps within the modal, not behind it)
- Restore focus to the trigger element when a modal/popover closes
- Use `focus-visible` to show rings only for keyboard users, not mouse clicks:

```css
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

### ARIA Attributes

- `aria-label` for icon-only buttons: `<button aria-label="Close menu">X</button>`
- `aria-labelledby` to associate headings with sections
- `aria-describedby` to link help text or error messages to inputs
- `aria-live="polite"` for dynamic content updates (toast messages, form errors)
- `aria-hidden="true"` for decorative elements (icons next to text labels)
- `aria-expanded` for toggleable elements (dropdowns, accordions)

### Color and Contrast

- WCAG AA: 4.5:1 for normal text, 3:1 for large text
- Never use color as the sole indicator — pair with icons, text, or patterns
- Test in both light and dark modes

### Images and Media

- Descriptive `alt` text for meaningful images: `alt="Dashboard showing 23% revenue growth"`
- Empty `alt=""` for purely decorative images
- Captions for video, transcripts for audio

### Navigation Aids

- **Skip link**: first focusable element, hidden until focused:

```html
<a href="#main-content" class="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

- **Heading hierarchy**: sequential h1 through h6, no level skips. One `<h1>` per page.

### Touch Targets

- Minimum 44x44px interactive area
- 8px minimum spacing between adjacent touch targets
- Extend small visual elements with invisible padding or pseudo-elements

### Testing

- **Automated**: axe-core in CI, Lighthouse accessibility score 90+
- **Manual**: full keyboard-only navigation test
- **Screen reader**: test with VoiceOver (macOS) or NVDA (Windows)
- **Visual**: zoom to 200%, check nothing breaks or overlaps

> Reference `references/accessibility-checklist.md` for the full audit guide with pass/fail criteria.

---

## 10. Pre-Delivery Review

Run through this checklist before considering any UI implementation complete:

### Typography
- [ ] Font smoothing applied (`-webkit-font-smoothing: antialiased`)
- [ ] Headings use `text-wrap: balance`
- [ ] Dynamic numbers use `font-variant-numeric: tabular-nums`

### Color
- [ ] All colors referenced via semantic tokens, no hardcoded hex in components
- [ ] Color contrast meets WCAG AA (4.5:1 normal text, 3:1 large text)
- [ ] Dark mode tested separately for contrast

### Spatial
- [ ] Nested rounded elements use concentric border radius
- [ ] Spacing follows 4px / 8px scale consistently
- [ ] Interactive elements have 44x44px minimum hit area
- [ ] Shadows used instead of borders where appropriate

### Motion
- [ ] Animation frequency matches usage frequency (no animation on high-frequency actions)
- [ ] No `transition: all` anywhere — specific properties only
- [ ] Enter animations split and staggered where multiple elements appear
- [ ] `prefers-reduced-motion` respected

### Accessibility
- [ ] All interactive elements keyboard accessible
- [ ] Focus rings visible on keyboard navigation (never `outline: none` without replacement)
- [ ] Semantic HTML used before ARIA
- [ ] `aria-live` on dynamic content updates

> Reference `references/review-checklist.md` for the extended 30-item checklist with severity ratings and automated testing commands.
