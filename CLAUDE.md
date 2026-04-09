# Caveman Code — caveman-cli

Fork of [pi-mono](https://github.com/badlogic/pi-mono). Adds Cave Mode, CaveKit extension, `@cavepi/` scope.

## What It Is

Minimal terminal coding agent + multi-provider LLM toolkit. TypeScript monorepo.

## Packages

| Package | CLI | Purpose |
|---------|-----|---------|
| `packages/coding-agent` | `cave` | Coding agent: sessions, extensions, skills, themes |
| `packages/ai` | `pi-ai` | Unified LLM API: OpenAI, Anthropic, Google, more |
| `packages/agent` | — | Agent runtime: tool calling, state management |
| `packages/tui` | — | Terminal UI: differential rendering |
| `packages/web-ui` | — | Web components for AI chat |
| `packages/mom` | `mom` | Slack bot → delegates to coding agent |
| `packages/pods` | `pi-pods` | vLLM deployment on GPU pods |
| `packages/cavekit-extension` | — | CaveKit SDD workflow: Draft→Architect→Build→Inspect |

## Key Commands

```bash
npm install          # install all deps
npm run build        # build all packages
npm run lint         # biome lint
npm run format       # biome format
```

## Context Hierarchy

See `context/CLAUDE.md`. Kits live in `context/kits/`, plans in `context/plans/`.

## Conventions

- Biome for lint/format (not ESLint/Prettier). Config: `biome.json`.
- TypeScript strict. Shared tsconfig: `tsconfig.base.json`.
- Package scope: `@cavepi/*` (public), `@cavekit/*` (extension).
- Node.js 20+.

## Agent Guidance

- Read package-specific CLAUDE.md before touching that package.
- Kits define WHAT. Plans define HOW. Never conflate.
- CaveKit extension commands: `/ck:*`. Blueprint commands deprecated: use `/ck:*`.
