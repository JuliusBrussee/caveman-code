# Repo map: `caveman-cli`

## Snapshot

- cwd: `/Users/julb/Desktop/GitHub/caveman-cli`
- branch: `strip/permissions`
- repo: npm workspaces monorepo
- current WIP: many dirty files, concentrated in `packages/coding-agent/`, `packages/tui/`, `packages/agent/`, plus new `/goal` slash-command files
- test/build output found this iteration: none under `logs/`

## What repo is

Cave monorepo. Main product: `cave` terminal coding agent.

Primary stack:

1. `@cave/ai` — provider/model layer
2. `@cave/agent` — agent loop + tools/events/runtime
3. `@cave/tui` — terminal UI primitives
4. `cave` (`packages/coding-agent`) — assembled CLI/TUI/daemon product

Secondary packages add SDK, Slack bot, web UI, GPU-pod tooling, markdown preview.

## Top-level dirs

| Path | Purpose |
| --- | --- |
| `packages/` | all publishable packages + example apps/extensions |
| `docs/` | VitePress docs site |
| `research/` | benchmark harness, baselines, plots, results |
| `scripts/` | release, profiling, smoke, maintenance scripts |
| `context/` | internal plans/archive/context artifacts |
| `.github/` | CI/workflows/templates |
| `installers/`, `Formula/` | install/distribution assets |
| `registry/` | package/registry-related assets |
| `vhs/` | demo GIF assets |

## Workspace packages

| Package | Path | Role |
| --- | --- | --- |
| `cave` | `packages/coding-agent` | flagship CLI/TUI/JSON/RPC app |
| `@cave/agent` | `packages/agent` | stateful agent runtime on top of `@cave/ai` |
| `@cave/ai` | `packages/ai` | unified LLM API, providers, models, streaming, OAuth |
| `@cave/tui` | `packages/tui` | differential-rendered terminal UI library |
| `@cave/sdk` | `packages/sdk` | TS client for `cave serve` HTTP/WebSocket API |
| `@cave/web-ui` | `packages/web-ui` | reusable web chat/UI components |
| `@cave/mom` | `packages/mom` | Slack bot delegating to cave |
| `@cave/pods` | `packages/pods` | CLI for vLLM deployments on GPU pods |
| `@cave/markdown-preview` | `packages/markdown-preview` | extension for rendered markdown/LaTeX preview |

## Architecture map

### 1. CLI product path

- entry: `packages/coding-agent/src/cli.ts`
- router/bootstrap: `packages/coding-agent/src/main.ts`
- shared runtime: `packages/coding-agent/src/core/agent-session.ts`
- modes: interactive / print / json / rpc via `packages/coding-agent/src/modes/`
- autonomous loop: `packages/coding-agent/src/core/goal-loop/goal-runner.ts`

### 2. Library dependency chain

- `@cave/ai`
  - provider abstractions
  - model registry/generated model list
  - streaming + tool-calling normalization
  - OAuth + env key resolution
- `@cave/agent`
  - agent state
  - event stream
  - tool execution loop
  - checkpoints/memory/repomap/subagent support
- `@cave/tui`
  - terminal rendering/input/components
- `cave`
  - user-facing commands
  - session persistence
  - hooks/extensions/skills/prompts
  - interactive UI
  - daemon + SDK surface

### 3. External surfaces

- daemon client: `@cave/sdk`
- browser UI: `@cave/web-ui`
- Slack frontend: `@cave/mom`
- infra helper: `@cave/pods`
- extension ecosystem/examples: `packages/coding-agent/examples/`

## Key files to orient quickly

| File | Why |
| --- | --- |
| `package.json` | workspace list + canonical scripts |
| `README.md` | product positioning + high-level features |
| `packages/coding-agent/package.json` | main shipped package |
| `packages/coding-agent/src/main.ts` | real CLI command routing |
| `packages/coding-agent/src/core/agent-session.ts` | central runtime composition point |
| `packages/coding-agent/src/core/goal-loop/goal-runner.ts` | autonomous `/goal` driver |
| `packages/agent/README.md` | lower-level agent mental model |
| `packages/ai/README.md` | provider/model/tool API mental model |
| `packages/sdk/README.md` | daemon automation surface |
| `docs/index.md` | docs information architecture |
| `research/README.md` | benchmarks/evals/repro story |

## Major product capabilities surfaced in repo

- multi-provider LLM support
- OAuth + API-key auth
- interactive TUI + print + JSON + RPC modes
- plan mode + autonomous goal loop
- hooks, slash commands, skills, extensions
- repo map / symbol graph tooling
- memory/cavemem integration
- daemon + SDK + web UI
- benchmark/research pipeline

## Test map

### `packages/coding-agent/test/`
Broadest surface. Covers:
- agent session behavior
- CLI args/doctor/print mode
- hooks/extensions
- package manager/model registry
- compaction/cave mode
- daemon/server
- benchmarks/proof-bench
- interactive mode status/footer/suspend

### `packages/agent/src/__tests__/`
Core engine/runtime tests. Notable clusters:
- checkpoints
- compression/cost
- MCP
- memory
- repomap
- subagents/worktrees
- router/tiered behavior

### `packages/ai/test/`
Provider + streaming normalization tests. Notable clusters:
- abort/overflow/context handling
- OAuth providers
- cross-provider handoff
- tool-call normalization
- image/tool-result routing
- registry/model behavior

### `packages/tui/test/`
Terminal rendering/input coverage. Notable clusters:
- editor/input/keybindings
- markdown rendering
- overlays/status line
- width/wrapping/regressions
- terminal image/render behavior

## Operational scripts from root

| Script | Purpose |
| --- | --- |
| `npm run check` | format/lint + TS + browser smoke + web-ui check |
| `npm run build` | build packages in dependency order |
| `npm run bench:*` | benchmark/eval entrypoints |
| `npm run release:*` | release automation |
| `npm run smoke:install` | installer smoke test |

## Notable repo-specific signals from current snapshot

- branch name `strip/permissions` + many modified UI/core files suggest ongoing removal/refactor of permission prompts
- untracked `.cave/goal/` dir contains autonomous goal-loop state for this task
- untracked `packages/coding-agent/src/core/slash-commands/goal.ts` + test suggests `/goal` feature work in progress

## Fast navigation recipes

### Understand product end-to-end
1. `README.md`
2. `package.json`
3. `packages/coding-agent/src/cli.ts`
4. `packages/coding-agent/src/main.ts`
5. `packages/coding-agent/src/core/agent-session.ts`

### Work on model/provider layer
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

### Work on goal/autonomous loop
1. `packages/coding-agent/src/core/goal-loop/`
2. `packages/coding-agent/src/core/slash-commands/goal.ts`
3. `packages/coding-agent/test/task-tool.test.ts`
4. `packages/coding-agent/src/modes/interactive/interactive-mode.ts`

## Gaps / next optional mapping work

- derive import/dependency graph between packages
- map `packages/coding-agent/src/core/` submodules in detail
- map slash-command registry to concrete command files
- map extension/skill loading pipeline end-to-end
