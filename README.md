<div align="center">

# 🪨 Caveman Code

**The terminal coding agent that talks like a caveman — and burns half the tokens doing it.**

Same model. Same task. **~2× fewer tokens than Codex.** 20+ providers · plan mode · autopilot loop · MIT.

<p>
  <a href="https://github.com/JuliusBrussee/caveman-cli/stargazers"><img src="https://img.shields.io/github/stars/JuliusBrussee/caveman-cli?color=d97757&style=flat-square" alt="Stars" /></a>
  <a href="https://www.npmjs.com/package/@juliusbrussee/caveman-code"><img src="https://img.shields.io/npm/v/%40juliusbrussee%2Fcaveman-code?color=2ea043&label=npm&style=flat-square" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@juliusbrussee/caveman-code"><img src="https://img.shields.io/npm/dm/%40juliusbrussee%2Fcaveman-code?color=2ea043&label=downloads&style=flat-square" alt="npm downloads" /></a>
  <a href="https://github.com/JuliusBrussee/caveman-cli/actions"><img src="https://img.shields.io/github/actions/workflow/status/JuliusBrussee/caveman-cli/ci.yml?branch=main&label=ci&style=flat-square" alt="CI" /></a>
  <a href="https://github.com/JuliusBrussee/caveman-cli/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-2ea043?style=flat-square" alt="MIT License" /></a>
</p>

<a href="#install">Install</a> ·
<a href="#-the-trick">The Trick</a> ·
<a href="#how-it-saves-tokens">How It Saves Tokens</a> ·
<a href="#why-caveman-code">Why Caveman</a> ·
<a href="#features">Features</a> ·
<a href="#sdk">SDK</a>

<!-- TODO before publish: render the demo gif → `vhs vhs/install.tape`, then uncomment the line below.
<img src="vhs/install.gif" width="760" alt="caveman install + first prompt — 30 seconds" />
-->

</div>

---

## 🔥 The trick

Big agent waffle. Waffle cost token. Caveman no waffle.

```
  ASKED ▸  why does this component re-render on every keystroke?

  ───  ordinary agent  ────────────────────────────  ~290 tokens
  Great question! A React component can re-render on every
  keystroke for several reasons. The most common cause is
  passing a fresh object or function reference as a prop on
  each render, which defeats React's referential-equality
  bail-out and forces the child to reconcile again …
  …three more paragraphs…

  ───  caveman code  ─────────────────────────────────  31 tokens
  New object ref each render. Inline prop = new ref = re-render.
  Wrap in useMemo.
```

Same answer. Same model. Caveman version costs **~9× less to read back** — and the agent reads its own context back on *every single turn*. The saving compounds across the whole session.

That is the entire product. Everything below is the coding agent it ships inside.

---

## The proof

```
  25-task MicroBench · gpt-5.5 · xhigh reasoning · 2026-05-18

  caveman  ████████████▌                         524k tokens · 14/25 · $1.78
  codex    ████████████████████████  1,010k tokens · 15/25 · $0 (codex sub)
```

> **1.93× fewer tokens than Codex CLI on identical tasks.**
> Same `gpt-5.5` model. Same `xhigh` reasoning. Pass rate within one task.
>
> No marketing-deck baselines. Each tool spawned as a real child process. Each task verified by a task-specific `verify.sh`. Raw CSV + per-task logs published.

```bash
npx tsx research/evals/run-honest-bench.ts --tools caveman,codex   # reproduce in one command
```

[Raw CSV](research/results/honest-bench-2026-05-18.csv) · [Aggregate JSON](research/results/honest-bench-2026-05-18.json) · [Methodology](research/README.md) · [25 task prompts](research/evals/microbench/tasks/)

---

## Install

```bash
npm install -g @juliusbrussee/caveman-code
```

Installs two binaries — `caveman` (primary) and `caveman-code` (alias). Same command, pick either.

```bash
export ANTHROPIC_API_KEY=sk-ant-...     # or any supported provider's key
caveman                                 # launch the TUI
caveman "explain this codebase"          # one-shot
caveman --goal "ship feature X"          # autonomous loop
```

<details>
<summary><strong>Other install paths</strong> — pnpm · yarn · bun · Docker · OAuth login</summary>

```bash
pnpm add -g @juliusbrussee/caveman-code
yarn global add @juliusbrussee/caveman-code
bun  add -g @juliusbrussee/caveman-code

# Docker
docker run --rm -it -v "$PWD:/work" ghcr.io/juliusbrussee/caveman-cli:latest

# No API key? Use a subscription you already pay for:
caveman && /login   # Claude Pro · ChatGPT Plus · Copilot · Gemini · Antigravity
```

CI / headless install: [docs/getting-started/installation.md](docs/getting-started/installation.md).

</details>

---

## Quick Start

```bash
caveman                            # interactive TUI
caveman "fix the failing tests"     # start with a prompt
caveman -p "summarize this file"    # non-interactive: print and exit
cat err.log | caveman -p "debug"    # pipe stdin
caveman -c                          # continue last session
caveman -r                          # browse + resume sessions
caveman --plan "ship payments v2"   # plan mode — read-only
caveman --goal "ship payments v2"   # autonomous Ralph loop
```

Type `/` inside the TUI for every slash command. Reference: [docs/reference/slash-commands.md](docs/reference/slash-commands.md).

---

## How It Saves Tokens

Four compression layers, always on — and they hit **two** separate token sinks: what the model *says* and what the shell *returns*.

| Token sink | Layer | What happens | Cut |
|---|---|---|---|
| **Model reply** | Caveman Mode | Terse technical fragments — no filler, no hedging. Levels `lite` · `full` · `ultra`. | prompt + reply |
| **Tool output** | Tool Budgets | Per-tool line caps (bash 80 · read 300 · grep 120), ANSI strip, blank-line collapse, semantic JSON/XML extraction. | **−67% to −94%** |
| | Read Dedup | Files fingerprinted per session — re-reads return a stub, not the bytes. | **−99%** on repeats |
| | RTK | Optional Rust binary rewrites bash output before it enters context. | **~60%** extra |

Pays for itself after one tool call.

<details>
<summary><strong>Benchmark</strong> — 10 real tool-output fixtures · −86% aggregate</summary>

```
  git diff (901 lines)   ██████████████████████████████████████████████████  -94%
  npm ls (701 lines)     ████████████████████████████████████████████████    -92%
  ls recursive (601 ln)  ███████████████████████████████████████████████     -90%
  grep results (801 ln)  █████████████████████████████████████████████       -89%
  test output (501 ln)   ████████████████████████████████████████████        -88%
  XML/pom.xml (382 ln)   ████████████████████████████████████████            -79%
  docker inspect (258)   ██████████████████████████████████                  -68%
  ANSI colored (97 ln)   █████████████████████████████                       -50%
  read file (429 lines)  ████████████████                                    -32%
  build output (19 ln)   █████████                                           -18%
                         ────────────────────────────────────────────────────
  AGGREGATE              ███████████████████████████████████████████████     -86%
```

| Metric | Value |
|---|---|
| Tokens saved (10 fixtures) | ~72,400 of 337K chars |
| System-prompt overhead | 120–195 tokens (lite–ultra) |
| Net savings — 15-turn session | **+567K tokens (~$1.70, Sonnet)** |
| Net savings — 30-turn session | **+1.13M tokens (~$6.92, Sonnet)** |

```bash
npm run bench:offline   # compression analysis — free, <1s
npm run bench:replay    # analyze your real sessions — free
npm run bench:live      # A/B with live LLM calls — needs API key
```

</details>

```bash
caveman --caveman-mode ultra   # most aggressive
caveman --caveman-mode lite    # system-prompt compression only
caveman --no-caveman-mode      # off
```

---

## Why Caveman Code

| Capability | Caveman | Claude Code | Codex | Aider | opencode |
|---|:---:|:---:|:---:|:---:|:---:|
| 4-layer token compression | ✅ | ❌ | ❌ | repo map only | ❌ |
| 20+ provider OAuth | ✅ | Anthropic | ChatGPT | API keys | API keys |
| Autonomous goal loop | ✅ | ❌ | ❌ | ❌ | ❌ |
| Autopilot — no permission prompts | ✅ | ❌ | ❌ | ✅ | ❌ |
| Repo map (PageRank, Aider-style) | ✅ | ❌ | ❌ | ✅ | ❌ |
| Architect / editor model split | ✅ | ❌ | ❌ | ✅ | ❌ |
| Session branching + shadow-git checkpoints | ✅ | ❌ | fork only | git only | ❌ |
| Persistent semantic memory (cavemem) | ✅ | MEMORY.md | ❌ | ❌ | ❌ |
| MIT open source | ✅ | closed | Apache-2.0 | Apache-2.0 | ✅ |

Full table including Crush: [docs/comparison.md](docs/comparison.md).

---

## Features

| | Feature | Trigger |
|---|---|---|
| 🤖 | **Autonomous goal loop** — Ralph-style autopilot. Rolling state, per-iteration $/token ledger, shadow-git checkpoints, ranked termination (sentinel · iteration cap · $-cap · no-progress · SIGINT). Resume any time. | `caveman --goal` |
| 🧠 | **Plan mode** — read-only chat. Model sees only `read`/`grep`/`find`/`ls`, produces a written plan, never edits. Subagents inherit the gate. `/act` to execute. | `--plan` · `/plan` |
| 👥 | **Subagents** — up to 7 parallel, worktree-isolated. Frontmatter agents at `.cave/agents/*.md` (Claude Code superset). Five ship by default. | `Task` tool |
| 🪞 | **Architect / editor split** — slow model plans, fast model executes. ~3–5× cheaper than a single-model run. | `--architect` · `--editor` |

Latest release: plan mode · goal loop · native memory tools · subagent registry. Full history → [CHANGELOG.md](CHANGELOG.md).

<details>
<summary><strong>More</strong> — sessions · providers · MCP · memory · recipes · daemon · CLI flags</summary>

### 🌳 Sessions, branching, replay
JSONL sessions in `~/.cave/agent/sessions/`, organized by working directory. Branching never overwrites history.

```bash
caveman -c                    # continue most recent
caveman -r                    # browse and select
caveman --fork <path|id>      # fork into a new file
```
`/tree` navigate + branch in-place (search · fold · page · filter) · `/compact` manual compaction · `/checkpoint` + `/rollback N` rewind code **and** conversation together.

### 🌐 20+ providers, 6 OAuth flows
**OAuth** — Claude Pro/Max · ChatGPT Plus/Pro · GitHub Copilot · Google Gemini · Antigravity · Vertex
**API keys** — Anthropic · OpenAI · Azure · Vertex · Bedrock · Mistral · Groq · Cerebras · xAI · OpenRouter · Vercel AI Gateway · Hugging Face · Kimi · MiniMax · Z.AI · DeepSeek
**Custom** — any OpenAI-/Anthropic-/Google-compatible endpoint via `~/.cave/agent/models.json`.

### 🔌 MCP, hooks, skills, commands — Claude Code-compatible
Authoring formats are a **superset** of Claude Code's — paste your existing config, it works.

| Claude Code | Caveman | Notes |
|---|---|---|
| `~/.claude/settings.json` | `~/.cave/settings.json` | Hooks identical (run as observers, never block) |
| `~/.claude/commands/*.md` | `~/.cave/commands/*.md` | Frontmatter superset |
| `~/.claude/skills/<name>/SKILL.md` | `~/.cave/skills/<name>/SKILL.md` | Identical |
| `~/.claude/agents/<name>.md` | `~/.cave/agents/<name>.md` | Frontmatter superset |
| `.mcp.json` | `.mcp.json` | Same path, no change |

MCP transports: stdio · Streamable HTTP · in-process. OAuth 2.1 + PKCE; tokens in OS keychain.
```bash
caveman mcp add <name>      # add a server
caveman mcp doctor          # health-check + tool listing
caveman mcp-server          # run caveman itself as an MCP server (Codex-compatible)
```

### 🧠 Memory via cavemem
Persistent memory delegated to [cavemem](https://github.com/JuliusBrussee/cavemem) (MIT, hybrid BM25 + local vectors). Agent has two native tools — `memory_search` and `memory_save`; relevant recall is auto-injected each turn.
```bash
/memory search "auth migration"
/memory consolidate            # cluster recent observations into semantic facts
/memory sync --from claude     # import Claude Code's MEMORY.md
```

### 🛠️ Recipes
Declarative multi-step YAML workflows at `~/.cave/recipes/*.yaml`. Ten built in: `accessibility-audit` · `add-feature-flag` · `add-tests` · `bump-deps` · `extract-component` · `migrate-deps` · `migrate-to-biome` · `port-to-typescript` · `release` · `seo-audit`.
```bash
/recipe run add-tests src/auth.ts
```

### 🖥️ Daemon
```bash
caveman serve --port 39245             # start the daemon
caveman attach --host localhost:39245  # attach a TUI
```
Sessions live in SQLite and survive SSH drops. Prepend `&` to any prompt to dispatch to a remote `caveman worker`.

### ⚙️ CLI flags
| Flag | Description |
|---|---|
| `-c` / `-r` | Continue / browse-resume session |
| `-p`, `--print` | Non-interactive: print and exit |
| `--mode json\|rpc` | Structured output modes |
| `--plan` / `--goal <prompt>` | Plan mode / autonomous loop |
| `--provider` / `--model` | Provider name / model ID (`:<thinking>` suffix ok) |
| `--thinking <level>` | `off`·`minimal`·`low`·`medium`·`high`·`xhigh` |
| `--architect` / `--editor <model>` | Architect/editor split |
| `--caveman-mode <level>` / `--no-caveman-mode` | `lite`·`full`·`ultra` / off |

Env: `ANTHROPIC_API_KEY` · `OPENAI_API_KEY` · `CAVE_CODING_AGENT_DIR` (config dir) · `CAVE_CACHE_RETENTION=long` (extended prompt cache).

</details>

---

## SDK

```typescript
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@juliusbrussee/caveman-code";

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage: AuthStorage.create(),
  modelRegistry: ModelRegistry.create(AuthStorage.create()),
});

session.on("message", (msg) => console.log(msg.role, msg.text));
await session.prompt("Refactor src/auth.ts to use the new TokenStore.");
```

Talk to a running daemon over HTTP / WS via [`@juliusbrussee/caveman-sdk`](packages/sdk). [API reference →](docs/api.md)

TypeScript monorepo, 9 packages — full layout in [CLAUDE.md](CLAUDE.md).

---

## Acknowledgements

**Caveman Code is a heavy fork of [pi-code](https://github.com/badlogic/pi-code) by [Mario Zechner](https://github.com/badlogic).** We track upstream and contribute fixes back where generally useful.

| From `pi-code` (upstream) | Caveman Code's own work |
|---|---|
| Agent runtime · MCP scaffolding · provider OAuth · repo map · slash-command parser · settings manager · skills loader · edit-format renderers · TUI components | Caveman Mode (4-layer compression) · goal loop · plan mode · cavemem integration · `/tree` session branching · architect/editor split · honest-bench harness |

Also indebted to [Aider](https://aider.chat) (repo map + edit-format-per-model), [Claude Code](https://www.anthropic.com/news/claude-code) (settings/commands/skills/agents/`.mcp.json` formats — adopted verbatim, then extended), [Codex](https://github.com/openai/codex) (cave-as-MCP-server), and [Biome](https://biomejs.dev) (single-binary lint/format).

Missing credit? [Open an issue](https://github.com/JuliusBrussee/caveman-cli/issues) — we'll fix it fast.

---

## License

MIT © [Julius Brussee](https://github.com/JuliusBrussee). Forked from [pi-code](https://github.com/badlogic/pi-code) (MIT © Mario Zechner).

<div align="center">

[Issues](https://github.com/JuliusBrussee/caveman-cli/issues) · [Releases](https://github.com/JuliusBrussee/caveman-cli/releases) · [Changelog](CHANGELOG.md) · [Docs](docs/index.md)

<sub>Caveman no waste token. Caveman ship.</sub>

</div>
