# Packages

TypeScript monorepo under `@cavepi/` and `@cavekit/` scopes.

## Package Map

| Dir | Package | Binary | Role |
|-----|---------|--------|------|
| `coding-agent/` | `@cavepi/pi-coding-agent` | `cave` | Main coding agent CLI |
| `ai/` | `@cavepi/pi-ai` | `pi-ai` | Multi-provider LLM unified API |
| `agent/` | `@cavepi/pi-agent-core` | — | Agent runtime: tool calling, state |
| `tui/` | `@cavepi/pi-tui` | — | Terminal UI: differential rendering |
| `web-ui/` | `@cavepi/pi-web-ui` | — | Web components for AI chat |
| `mom/` | `@cavepi/pi-mom` | `mom` | Slack bot → coding agent delegate |
| `pods/` | `@cavepi/pi` | `pi-pods` | vLLM deployment on GPU pods |
| `cavekit-extension/` | `@cavekit/pi-extension` | — | CaveKit SDD: Draft→Architect→Build→Inspect |

## Conventions

- Read package-level README.md before modifying.
- Shared TypeScript config: `../tsconfig.base.json`.
- Biome for lint/format (not ESLint/Prettier).
- See `context/kits/` for requirements, `context/plans/` for tasks.
