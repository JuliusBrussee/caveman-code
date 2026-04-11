# Packages

TypeScript monorepo under the `@cave/` scope.

## Package Map

| Dir | Package | Binary | Role |
|-----|---------|--------|------|
| `coding-agent/` | `cave` | `cave` | Main coding agent CLI |
| `ai/` | `@cave/ai` | `pi-ai` | Multi-provider LLM unified API |
| `agent/` | `@cave/agent` | — | Agent runtime: tool calling, state |
| `tui/` | `@cave/tui` | — | Terminal UI: differential rendering |
| `web-ui/` | `@cave/web-ui` | — | Web components for AI chat |
| `mom/` | `@cave/mom` | `mom` | Slack bot → coding agent delegate |
| `pods/` | `@cave/pods` | `cave-pods` | vLLM deployment on GPU pods |
| `cavekit-extension/` | `@cave/cavekit` | — | CaveKit SDD: Draft→Architect→Build→Inspect |

## Conventions

- Read package-level README.md before modifying.
- Shared TypeScript config: `../tsconfig.base.json`.
- Biome for lint/format (not ESLint/Prettier).
- See `context/kits/` for requirements, `context/plans/` for tasks.
