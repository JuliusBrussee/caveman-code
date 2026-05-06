# Repo map: `caveman-cli`

## Snapshot

- cwd: `/Users/julb/Desktop/GitHub/caveman-cli`
- branch: `strip/permissions`
- repo type: npm workspaces monorepo
- current goal dir: `.cave/goal/g-20260503233204-gcw2u2/`
- current WIP: dirty files concentrated in `packages/coding-agent/`, `packages/tui/`, `packages/agent/`
- test/build output found this iteration: none under `logs/`

## What repo is

Cave monorepo. Main product: `cave`, terminal coding agent.

Core package stack:

1. `@cave/ai` — provider/model abstraction, streaming, auth
2. `@cave/agent` — agent runtime, tools, memory, repo map, subagents
3. `@cave/tui` — terminal UI primitives
4. `cave` (`packages/coding-agent`) — assembled CLI/TUI/daemon product

Secondary packages add SDK, web UI, Slack bot, GPU pod tooling, markdown preview.

## Top-level dirs

| Path | Purpose |
| --- | --- |
| `packages/` | publishable packages + examples/extensions |
| `docs/` | VitePress docs site |
| `research/` | eval/benchmark harness + results |
| `scripts/` | release, profiling, smoke, maintenance scripts |
| `context/` | internal plans, notes, refs, archived design artifacts |
| `.github/` | CI workflows, templates |
| `.cave/` | local agent config + goal-loop artifacts |
| `installers/`, `Formula/` | install/distribution assets |
| `registry/` | registry-related assets |
| `vhs/` | demo GIF / tape assets |

## Workspace packages

| Package | Path | Role |
| --- | --- | --- |
| `cave` | `packages/coding-agent` | flagship CLI/TUI/JSON/RPC app |
| `@cave/agent` | `packages/agent` | stateful agent runtime on top of `@cave/ai` |
| `@cave/ai` | `packages/ai` | unified LLM API, providers, models, streaming, OAuth |
| `@cave/tui` | `packages/tui` | differential terminal UI library |
| `@cave/sdk` | `packages/sdk` | TS client for `cave serve` HTTP/WS API |
| `@cave/web-ui` | `packages/web-ui` | reusable browser chat/UI components |
| `@cave/mom` | `packages/mom` | Slack bot frontend |
| `@cave/pods` | `packages/pods` | vLLM / GPU pod CLI |
| `@cave/markdown-preview` | `packages/markdown-preview` | markdown/PDF preview extension |

## Entry points worth opening first

| File | Why |
| --- | --- |
| `package.json` | workspace list + canonical root scripts |
| `README.md` | product overview, capabilities, package roles |
| `packages/coding-agent/src/cli.ts` | executable shim |
| `packages/coding-agent/src/main.ts` | real CLI router/bootstrap |
| `packages/coding-agent/src/core/agent-session.ts` | shared runtime composition point |
| `packages/coding-agent/src/core/goal-loop/goal-runner.ts` | autonomous goal loop |
| `packages/agent/src/index.ts` | agent library export surface |
| `packages/ai/src/index.ts` | provider/model library export surface |
| `packages/tui/src/index.ts` | TUI export surface |
| `research/README.md` | benchmark/eval harness map |

## Architecture map

### CLI product path

- entry: `packages/coding-agent/src/cli.ts`
- router/bootstrap: `packages/coding-agent/src/main.ts`
- shared runtime: `packages/coding-agent/src/core/agent-session.ts`
- modes: `packages/coding-agent/src/modes/`
- slash commands: `packages/coding-agent/src/core/slash-commands/`
- autonomous loop: `packages/coding-agent/src/core/goal-loop/goal-runner.ts`

### Library dependency chain

- `@cave/ai`
  - provider adapters
  - model registry / generated model list
  - streaming + tool-call normalization
  - OAuth + API-key resolution
- `@cave/agent`
  - agent state / loop
  - tool execution
  - checkpoints / memory / repomap / subagents / MCP
- `@cave/tui`
  - rendering / input / components / markdown
- `cave`
  - commands, sessions, hooks, extensions, skills, daemon, interactive UI

### External surfaces

- daemon client: `@cave/sdk`
- browser UI: `@cave/web-ui`
- Slack frontend: `@cave/mom`
- infra helper: `@cave/pods`
- extension examples: `packages/coding-agent/examples/`

## Package-level start points

### `packages/coding-agent/`

Primary app package.

- `src/main.ts` — CLI routing
- `src/core/agent-session.ts` — runtime/session assembly
- `src/core/goal-loop/goal-runner.ts` — `/goal` loop
- `src/modes/interactive/` — TUI mode wiring
- `src/core/slash-commands/` — command implementations
- `test/` + `src/core/__tests__/` — highest-volume app coverage

### `packages/agent/`

Lower-level agent runtime.

- `src/index.ts` — exports
- `src/mcp/` — MCP plumbing
- `src/repomap/` — Aider-style repo map / PageRank logic
- `src/tools/` — editing/tool helpers
- `src/__tests__/` — checkpoints, MCP, repomap, subagents, memory

### `packages/ai/`

Provider/model layer.

- `src/index.ts` — exports
- `src/providers/` — provider implementations
- `src/models.generated.ts` — generated model catalog
- `src/cache/` — cache + tool serialization
- `test/` — provider/stream normalization suite

### `packages/tui/`

Terminal UI primitives.

- `src/index.ts` — exports
- `src/components/` — renderer widgets/components
- `test/` — rendering/input/wrapping regressions

### `packages/sdk/`

Daemon client.

- `src/index.ts` — public SDK surface

### `packages/web-ui/`

Reusable browser chat components.

- `src/index.ts` — exports
- `example/` — example app

### `packages/mom/`

Slack bot wrapper.

- `src/main.ts` — bot bootstrap

### `packages/pods/`

GPU pod / vLLM helper CLI.

- `src/cli.ts` — command routing

### `packages/markdown-preview/`

Extension package.

- `index.ts` — extension entry

## Test map

| Area | Path |
| --- | --- |
| app / CLI / sessions / hooks | `packages/coding-agent/test/` |
| app internals | `packages/coding-agent/src/core/__tests__/` |
| agent runtime | `packages/agent/src/__tests__/` |
| provider/model layer | `packages/ai/test/` |
| terminal UI | `packages/tui/test/` |

## Root scripts

| Script | Purpose |
| --- | --- |
| `npm run check` | format/lint + typecheck + browser smoke + web-ui check |
| `npm run build` | build packages in dependency order |
| `npm run bench*` | eval/benchmark entrypoints |
| `npm run release:*` | release automation |
| `npm run smoke:install` | installer smoke test |

## Current repo signals

- branch `strip/permissions`
- dirty files suggest active work around permission removal, goal loop, memory/tools, interactive TUI components
- untracked `.cave/goal/` contains prior completed map run and current active run
- current run now has dedicated repo map artifact: `.cave/goal/g-20260503233204-gcw2u2/REPO_MAP.md`

## Fast navigation recipes

### Understand product end-to-end
1. `README.md`
2. `package.json`
3. `packages/coding-agent/src/cli.ts`
4. `packages/coding-agent/src/main.ts`
5. `packages/coding-agent/src/core/agent-session.ts`

### Work on provider/model layer
1. `packages/ai/README.md`
2. `packages/ai/src/`
3. `packages/ai/test/`

### Work on agent/runtime layer
1. `packages/agent/README.md`
2. `packages/agent/src/`
3. `packages/agent/src/__tests__/`

### Work on TUI
1. `packages/tui/src/`
2. `packages/coding-agent/src/modes/interactive/`
3. `packages/tui/test/`

### Work on autonomous goal loop
1. `packages/coding-agent/src/core/goal-loop/`
2. `packages/coding-agent/src/core/slash-commands/goal.ts`
3. `packages/coding-agent/src/core/__tests__/cave-invocation.test.ts`
4. `packages/coding-agent/src/core/slash-commands/__tests__/goal.test.ts`

## Verification

- source files inspected this iteration: `package.json`, `README.md`, current `.cave/goal/*`, prior generated `REPO_MAP.md`
- repo structure cross-checked with `find packages -maxdepth 2 -name package.json`
- no build/test log files found in `logs/`
