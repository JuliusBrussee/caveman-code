# Packages

TypeScript monorepo under the `@cave/` scope.

## Package Map

**v2 core (load-bearing — see `context/plans/cave-v2-best-in-class.md`):**

| Dir | Package | Binary | Role |
|-----|---------|--------|------|
| `coding-agent/` | `cave` | `cave` | Main coding agent CLI |
| `ai/` | `@cave/ai` | `pi-ai` | Multi-provider LLM unified API |
| `agent/` | `@cave/agent` | — | Agent runtime: tool calling, state |
| `tui/` | `@cave/tui` | — | Terminal UI: differential rendering |

**Out of scope for v2 (separate product surfaces):**

| Dir | Package | Binary | Role |
|-----|---------|--------|------|
| `web-ui/` | `@cave/web-ui` | — | Web components for AI chat |
| `mom/` | `@cave/mom` | `mom` | Slack bot → coding agent delegate |
| `pods/` | `@cave/pods` | `cave-pods` | vLLM deployment on GPU pods |

## Conventions

- Read package-level README.md before modifying.
- Shared TypeScript config: `../tsconfig.base.json`.
- Biome for lint/format (not ESLint/Prettier).
- The active master plan is `context/plans/cave-v2-best-in-class.md`. Older
  CaveKit kits/plans/impl live in `context/archive/`.
