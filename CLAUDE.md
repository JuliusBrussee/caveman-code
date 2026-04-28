# CAVE CLI — caveman-cli

Minimal terminal coding agent + multi-provider LLM toolkit. TypeScript monorepo.

## Packages

| Package | CLI | Purpose |
|---------|-----|---------|
**v2 core (load-bearing):**
| `packages/coding-agent` | `cave` | Coding agent: sessions, extensions, skills, themes |
| `packages/ai` | `pi-ai` | Unified LLM API: OpenAI, Anthropic, Google, more |
| `packages/agent` | — | Agent runtime: tool calling, state management |
| `packages/tui` | — | Terminal UI: differential rendering |

**Out of scope for v2 (separate product surfaces, kept independent):**
| `packages/web-ui` | — | Web components for AI chat |
| `packages/mom` | `mom` | Slack bot → delegates to coding agent |
| `packages/pods` | `cave-pods` | vLLM deployment on GPU pods |

## Key Commands

```bash
npm install          # install all deps
npm run build        # build all packages
npm run lint         # biome lint
npm run format       # biome format
```

## Context Hierarchy

See `context/CLAUDE.md`. The active plan is `context/plans/cave-v2-best-in-class.md`.
Legacy CaveKit kits/plans/impl have been moved to `context/archive/`.

## Conventions

- Biome for lint/format (not ESLint/Prettier). Config: `biome.json`.
- TypeScript strict. Shared tsconfig: `tsconfig.base.json`.
- Package scope: `@cave/*` (all packages). Main CLI package: `cave` (unscoped).
- Node.js 20+.

## Agent Guidance

- Read package-specific CLAUDE.md before touching that package.
- Before building from scratch, run the **pi-check**: search `pi-code` upstream,
  the `pi-*` npm scope, and pi extensions for an existing module. Vendor or wrap
  if found. Note "borrowed from pi: <name>" in the deliverable. See plan §0.
- CaveKit (`@cave/cavekit`) has been removed; its workflow is being replaced by
  plan mode (read-only exploration), markdown skills, and recipes.
