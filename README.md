<h1 align="center">Caveman Code</h1>

<p align="center">
<strong>Same work. 40x fewer tokens.</strong><br/>
Terminal coding agent that compresses at every layer — prompts, tool output, file reads, structured data.<br/>
Full coding capability. Fraction of the cost. <a href="research/README.md">Prove it yourself.</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cave"><img src="https://img.shields.io/npm/v/cave?color=blue&label=npm" alt="npm version" /></a>
  <a href="https://github.com/JuliusBrussee/caveman-cli/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node.js 20+" /></a>
</p>

```
  Tokens per resolved task

  cave         ▏ 59k · $0.07            ← you are here
  Codex        █████████████████████████████ 1,348k · $3.37
  Claude Code  ██████████████████████████████████████████████████ 2,353k · $7.35
```

> **23x** fewer tokens than Codex. **40x** fewer than Claude Code. **105x** cheaper per resolved task.
> Cave MicroBench vs published SWE-bench baselines — different task sets.
> **[Full eval methodology + reproduce every number →](research/README.md)**

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman-cli/main/install.sh | sh

# Windows (PowerShell)
irm https://raw.githubusercontent.com/JuliusBrussee/caveman-cli/main/install.ps1 | iex

# Homebrew
brew tap juliusbrussee/cave https://github.com/JuliusBrussee/caveman-cli && brew install cave

# npm (any platform with Node 20+)
npm install -g cave

# Docker
docker run --rm -it -v "$PWD:/work" ghcr.io/juliusbrussee/caveman-cli:latest
```

<p align="center">
  <img src="packages/coding-agent/docs/images/cave-tui.png" width="680" alt="cave interactive mode" />
</p>

---

## How It Saves Tokens

Four compression layers. Always on. Break-even after one tool call.

| Layer | What happens | Impact |
|-------|-------------|--------|
| **Cave Mode** | Model responds in terse technical fragments — no filler, no hedging. `lite` / `full` / `ultra` | Prompt + response compression |
| **Tool Budgets** | Per-tool line limits (bash: 80, read: 300, grep: 120) + ANSI strip + blank collapse + semantic JSON/XML extraction | **-67% to -94%** on tool output |
| **Read Dedup** | Files fingerprinted per session — re-reads return a stub, not the content | **-99%** on repeated reads |
| **RTK** | Optional Rust binary rewrites bash output before it enters context | **~60%** additional reduction |

<details>
<summary>Full benchmark: 10 real-world tool output fixtures</summary>

```
  git diff (901 lines)   ██████████████████████████████████████████████████  -94%
  npm ls (701 lines)     ████████████████████████████████████████████████    -92%
  ls recursive (601 ln)  ███████████████████████████████████████████████     -90%
  grep results (801 ln)  █████████████████████████████████████████████       -89%
  test output (501 ln)   ████████████████████████████████████████████        -88%
  XML/pom.xml (382 ln)   ████████████████████████████████████████            -79%
  docker inspect (258)   ██████████████████████████████████                  -68%
  ANSI colored (97 ln)   █████████████████████████████                      -50%
  read file (429 lines)  ████████████████                                   -32%
  build output (19 ln)   █████████                                          -18%
                         ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  AGGREGATE              ███████████████████████████████████████████████     -86%
```

| Metric | Value |
|--------|-------|
| Tokens saved (10 fixtures) | ~72,400 out of 337K chars |
| System prompt overhead | 120–195 tokens (lite–ultra) |
| Net savings (15-turn session) | **+567K tokens (~$1.70 with Sonnet)** |
| Net savings (30-turn session) | **+1.13M tokens (~$6.92 with Sonnet)** |

```bash
npm run bench:offline   # compression analysis — free, <1s
npm run bench:replay    # analyze your real sessions — free
npm run bench:live      # A/B with LLM calls — needs API key
```

</details>

<details>
<summary>MicroBench eval: 25 coding tasks, $1.19 total, 14 minutes</summary>

25 self-contained tasks (read/edit/bash) at three difficulty levels. No Docker, no repo cloning.

| Difficulty | Pass Rate | Avg Cost | Avg Duration |
|-----------|-----------|----------|-------------|
| Easy | 8/8 (100%) | $0.03 | 17s |
| Medium | 6/10 (60%) | $0.04 | 33s |
| Hard | 2/7 (29%) | $0.06 | 55s |
| **Total** | **16/25 (64%)** | **$0.05** | **33s** |

**75% prompt cache hit rate** from caveman compression. **[Run it yourself →](research/README.md)**

</details>

---

## Quick Start

```bash
# Authenticate (pick one)
export ANTHROPIC_API_KEY=sk-ant-...          # any supported provider's API key
cave && /login                                # or OAuth: Claude Pro, ChatGPT Plus, Copilot, Gemini...

# Use
cave                              # interactive mode
cave "explain this codebase"      # start with a prompt
cave -p "summarize this file"     # non-interactive, print and exit
cat README.md | cave -p "review"  # pipe stdin
cave -c                           # continue last session
cave -r                           # browse sessions
```

---

## CaveKit — Spec-Driven Development

Structured pipeline from description to validated code. No open-ended chat — every step has acceptance criteria.

```
Description ──→ Draft ──→ Architect ──→ Build ──→ Inspect ──→ Validated Code
                 │          │            │          │
                kits      task graph   waves     acceptance
                + AC      + tiers     + gates    criteria
```

| Command | What it does |
|---------|-------------|
| `/ck:draft` | Description → kits with requirements + acceptance criteria |
| `/ck:architect` | Kits → tiered task dependency graph |
| `/ck:build` | Wave-based parallel execution with tier gates |
| `/ck:inspect` | Verify against acceptance criteria |
| `/ck:progress` | Live task status + convergence metrics |

Tier gates pause on P0/P1 findings. Convergence monitoring detects unproductive iteration. Each subagent receives only the kit sections it needs.

---

## Providers

**OAuth subscriptions** — Claude Pro/Max · ChatGPT Plus/Pro · GitHub Copilot · Google Gemini · Antigravity

**API keys** — Anthropic · OpenAI · Azure OpenAI · Google Vertex · Bedrock · Mistral · Groq · Cerebras · xAI · OpenRouter · Vercel AI Gateway · Hugging Face · Kimi · MiniMax · ZAI · OpenCode

**Custom** — Any OpenAI/Anthropic/Google-compatible endpoint via `~/.cave/agent/models.json` or the [Extensions API](packages/coding-agent/docs/extensions.md)

---

## Features

<details>
<summary><strong>Interactive TUI</strong></summary>

| Key | Action |
|-----|--------|
| `@` | Fuzzy-search project files |
| Tab | Path completion |
| Shift+Enter | Multi-line input |
| Ctrl+V | Paste images |
| Shift+Tab | Cycle thinking level (`off → minimal → low → medium → high → xhigh`) |
| `!cmd` / `!!cmd` | Shell → LLM / shell silently |
| Ctrl+O / Ctrl+T | Collapse tool output / thinking |
| Ctrl+L / Ctrl+P | Switch model / cycle favourites |

</details>

<details>
<summary><strong>Sessions</strong> — auto-save, branching, tree navigation</summary>

JSONL files in `~/.cave/agent/sessions/`, organized by working directory. Branching never overwrites history.

```bash
cave -c                    # continue most recent
cave -r                    # browse and select
cave --session <path|id>   # open specific session
cave --fork <path|id>      # fork into new file
```

`/tree` — navigate and branch in-place with search, fold, page, filter. `/compact` — manual context compaction (automatic on overflow).

</details>

<details>
<summary><strong>Commands</strong> — type <code>/</code> to list all</summary>

`/login` `/logout` · `/model` · `/settings` · `/resume` `/new` `/tree` `/fork` · `/compact` · `/copy` · `/export` · `/share` · `/reload` · `/hotkeys` · `/changelog`

Extensions register their own commands.

</details>

<details>
<summary><strong>Extensions</strong> — tools, commands, events, UI</summary>

TypeScript modules loaded at startup. 40+ event types.

```typescript
export default function (api: ExtensionAPI) {
  api.registerTool({ name: "deploy", ... });
  api.registerCommand("stats", { ... });
  api.on("tool_call", async (event, ctx) => { ... });
}
```

Custom editors, overlays, permission gates, MCP integration, sub-agents, and more. Full guide: [extensions.md](packages/coding-agent/docs/extensions.md).

</details>

<details>
<summary><strong>Customization</strong> — prompts, skills, themes, packages</summary>

- **Prompts** — Markdown templates with `{{placeholders}}` in `~/.cave/agent/prompts/`
- **Skills** — On-demand capabilities in `~/.cave/agent/skills/` or `cave install`
- **Themes** — Built-in dark/light + custom themes in `~/.cave/agent/themes/`
- **Packages** — Bundle extensions, skills, prompts, themes:

```bash
cave install npm:@foo/cave-tools
cave install git:github.com/user/repo
cave list && cave update
```

</details>

<details>
<summary><strong>SDK & scripting</strong> — embed, RPC, print mode, JSON mode</summary>

```typescript
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "cave";

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage: AuthStorage.create(),
  modelRegistry: ModelRegistry.create(AuthStorage.create()),
});
await session.prompt("What files are in the current directory?");
```

```bash
cave --mode rpc                     # JSONL over stdin/stdout
cave -p "Summarize this codebase"   # print and exit
cave --mode json "List todos"       # structured JSON output
```

</details>

<details>
<summary><strong>CLI reference</strong></summary>

| Flag | Description |
|------|-------------|
| `-c`, `--continue` | Continue most recent session |
| `-r`, `--resume` | Browse and select session |
| `-p`, `--print` | Non-interactive: print and exit |
| `--mode json\|rpc` | Structured output modes |
| `--provider <name>` | `anthropic`, `openai`, `google`, ... |
| `--model <pattern>` | Model ID or `provider/id`; supports `:<thinking>` suffix |
| `--thinking <level>` | `off` · `minimal` · `low` · `medium` · `high` · `xhigh` |
| `--tools <list>` | Enable specific tools (default: `read,bash,edit,write`) |
| `-e`, `--extension <src>` | Load a specific extension (repeatable) |

| Env var | Description |
|---------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `CAVE_CODING_AGENT_DIR` | Override config directory |
| `CAVE_CACHE_RETENTION` | `long` for extended prompt cache (Anthropic: 1h, OpenAI: 24h) |

</details>

---

## Monorepo

| Package | Description |
|---------|-------------|
| [`cave`](packages/coding-agent) | Coding agent CLI |
| [`@cave/ai`](packages/ai) | Multi-provider LLM API |
| [`@cave/agent`](packages/agent) | Agent runtime + tool calling |
| [`@cave/tui`](packages/tui) | Terminal UI with differential rendering |
| [`@cave/web-ui`](packages/web-ui) | Web components for AI chat |
| [`@cave/mom`](packages/mom) | Slack bot → coding agent |
| [`@cave/pods`](packages/pods) | vLLM on GPU pods |

## Contributing

```bash
git clone https://github.com/JuliusBrussee/caveman-cli.git
cd caveman-cli && npm install && npm run build
npm run check   # lint + format + type check
./test.sh       # run tests
```

[Biome](https://biomejs.dev/) for lint/format. TypeScript strict.

## License

MIT
