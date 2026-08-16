<h1 align="center">Caveman Code</h1>
<p align="center">Terminal coding harness with token-saving caveman mode</p>
<p align="center">
  <a href="https://discord.com/invite/nKXTsAcmbT"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
  <a href="https://www.npmjs.com/package/@juliusbrussee/caveman-code"><img alt="npm" src="https://img.shields.io/npm/v/%40juliusbrussee%2Fcaveman-code?style=flat-square" /></a>
  <a href="https://github.com/JuliusBrussee/caveman-code/actions/workflows/ci.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/JuliusBrussee/caveman-code/ci.yml?style=flat-square&branch=main" /></a>
</p>

Caveman Code is the `caveman` CLI package in [JuliusBrussee/caveman-code](https://github.com/JuliusBrussee/caveman-code).

Caveman Code is a minimal terminal coding harness that stays provider-agnostic, terminal-native, and deeply extensible. Use it interactively, run it in print or JSON mode, embed it through the SDK, or extend it with TypeScript modules, skills, prompt templates, themes, and CaveKit workflows.

---

## Install

```bash
npm install -g @juliusbrussee/caveman-code
caveman
```

Requirements:
- Node.js 20+
- API key or active subscription for at least one supported provider

---

## Quick Start

### Authenticate

```bash
# API key
export ANTHROPIC_API_KEY=sk-ant-...
caveman

# Or sign in with an existing subscription
caveman
/login
```

### Use

```bash
caveman                              # interactive mode
caveman "explain this codebase"      # start with prompt
caveman -p "summarize this file"     # print mode
cat README.md | caveman -p "review"  # pipe stdin
caveman -c                           # continue last session
caveman -r                           # browse sessions
caveman goal start "<text>"          # autonomous goal loop
```

Success looks like this:
- interactive TUI opens with active model + status footer
- `/login` or API key auth succeeds
- model can call built-in tools like `read`, `bash`, `edit`, and `write`

Platform notes: [Windows](docs/windows.md) · [Termux](docs/termux.md) · [tmux](docs/tmux.md) · [Terminal setup](docs/terminal-setup.md) · [Shell aliases](docs/shell-aliases.md)

---

## What Caveman Code Adds

Caveman Code keeps upstream extensibility goals, then adds fork-specific workflows and compression features on top.

| Area | Caveman Code |
|------|------|
| Multi-provider coding agent | Built in |
| Caveman Code mode | 3-layer token compression |
| RTK integration | Optional bash command rewriting + output reduction |
| CaveKit | Draft → Architect → Build → Inspect workflow |
| Package ecosystem | Install prompts, skills, themes, and extensions via npm or git |
| SDK + RPC | Embed in apps or automate from other runtimes |

---

## Supported Providers

### OAuth subscriptions
Claude Pro/Max · ChatGPT Plus/Pro · GitHub Copilot · Google Gemini · Google Antigravity

### API keys
Anthropic · OpenAI · Azure OpenAI · Google Gemini · Google Vertex · Amazon Bedrock · Mistral · Groq · Cerebras · DeepSeek · xAI · OpenRouter · Vercel AI Gateway · Hugging Face · Kimi · MiniMax · ZAI · OpenCode

### Custom providers
Add any OpenAI-, Anthropic-, or Google-compatible endpoint via `~/.cave/agent/models.json`, or build a custom provider with [Extensions](docs/extensions.md) and [Custom Provider docs](docs/custom-provider.md).

Provider setup details: [docs/providers.md](docs/providers.md)

---

## Modes

| Mode | Command | Use case |
|------|---------|----------|
| Interactive | `caveman` | Full TUI with history, editor, tool calls, and status UI |
| Print | `caveman -p "..."` | One-shot scripting |
| JSON | `caveman --mode json "..."` | Structured automation |
| RPC | `caveman --mode rpc` | Stdin/stdout process integration |
| SDK | `createAgentSession()` | Embed Caveman Code in Node.js apps |

---

## Interactive Mode

<p align="center"><img src="docs/images/interactive-mode.png" alt="Interactive Mode" width="600"></p>

Main UI regions:
- **Startup header** — version, shortcuts, loaded context, skills, prompts, extensions
- **Messages** — prompts, assistant output, tool calls/results, notifications, extension UI
- **Editor** — input area, file picker, slash commands, shell dispatch
- **Footer** — cwd, session name, token/cache usage, cost, context usage, model

### Editor Features

| Feature | How |
|---------|-----|
| File reference | `@` fuzzy-searches project files |
| Path completion | `Tab` |
| Multi-line input | `Shift+Enter` |
| Paste images | `Ctrl+V` |
| Shell commands | `!cmd` sends output to model · `!!cmd` runs silently |
| Thinking level | `Shift+Tab` cycles levels |
| Model switcher | `Ctrl+L` |
| Collapse tool output | `Ctrl+O` |
| Collapse thinking | `Ctrl+T` |

### Slash Commands

| Command | Description |
|---------|-------------|
| `/login`, `/logout` | OAuth auth |
| `/model` | Switch models |
| `/settings` | Theme, thinking, delivery, transport, compaction |
| `/resume` | Pick prior session |
| `/new` | New session |
| `/tree` | Browse + branch session history |
| `/fork` | Create session from branch point |
| `/compact [prompt]` | Manual compaction |
| `/copy` | Copy last assistant message |
| `/export [file]` | Export session to HTML |
| `/share` | Upload session as private gist |
| `/reload` | Reload extensions, prompts, skills, keybindings, context |
| `/hotkeys` | Show shortcuts |
| `/changelog` | Show version history |

Keyboard shortcut details: [docs/keybindings.md](docs/keybindings.md)

---

## Sessions

Sessions auto-save to `~/.cave/agent/sessions/` and keep full tree history in JSONL format.

```bash
caveman -c                    # continue most recent session
caveman -r                    # browse sessions
caveman --session <path|id>   # open specific session
caveman --fork <path|id>      # fork into new session
caveman --no-session          # ephemeral mode
```

### Branching

Use `/tree` to search, branch, label bookmarks, and revisit earlier points without overwriting history.

### Compaction

Compaction summarizes older context while keeping recent turns active:
- automatic on overflow or near-limit conditions
- manual via `/compact`
- full history always remains in session file

Session format details: [docs/session.md](docs/session.md) · Compaction details: [docs/compaction.md](docs/compaction.md)

---

## Caveman Mode

Caveman Code mode is enabled by default and reduces token waste without changing workflow.

### Layer 1: prompt compression
- `lite` — brief responses
- `full` — default terse mode
- `ultra` — maximum brevity

### Layer 2: tool output compression
- strips ANSI noise
- applies per-tool budgets
- truncates with head/tail slices instead of hard cuts
- compresses structured bash output where possible

### Layer 3: read deduplication
- fingerprints reads within session
- returns stub when unchanged file is re-read
- reduces repeated context injection during refactors

Change level with `/caveman [lite|full|ultra|off]`.

Settings reference: [docs/settings.md](docs/settings.md)

### Benchmark Results

Run `npm run bench:offline` to reproduce. Results on 10 real-world tool output fixtures:

#### Tool Output Compression

```
                         0%        25%        50%        75%       100%
                         |          |          |          |          |
  git diff (901 lines)   [##################################################] -94.0%
  npm ls (701 lines)     [################################################  ] -91.6%
  ls recursive (601 ln)  [###############################################   ] -90.3%
  grep results (801 ln)  [##############################################    ] -89.3%
  test output (501 ln)   [############################################      ] -87.6%
  XML/pom.xml (382 ln)   [########################################          ] -78.7%
  docker inspect (258)   [##################################                ] -67.9%
  ANSI colored (97 ln)   [#########################                         ] -50.0%
  read file (429 lines)  [################                                  ] -32.0%
  build output (19 ln)   [#########                                         ] -18.0%
                         |          |          |          |          |
  AGGREGATE              [###########################################       ] -85.9%
```

**~72,400 tokens saved** across 337K chars of tool output. Larger outputs compress more aggressively.

#### Compression Pipeline Layers

| Layer | What it does | Biggest impact on |
|-------|-------------|-------------------|
| **Flint Chipper** | Per-tool line budgets (bash: 80, read: 300, grep: 120) | Large outputs (-67% to -92%) |
| **ANSI Strip** | Removes escape codes from colored output | Terminal output (-20% to -40%) |
| **Stone Tablet** | Semantic JSON/XML key extraction | Structured bash output |
| **Blank Collapse** | Collapses 3+ blank lines | Sparse output |
| **General Truncation** | 500-line cap with head+tail preservation | Very long outputs |

#### Read Deduplication

```
  First read (429-line file)   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  ~2,966 tokens
  Second read (unchanged)      ~                                            ~22 tokens
                                                                      99.3% savings
```

#### System Prompt Overhead vs Savings

| Intensity | Prompt Cost | Break-even | Net per 15-turn session |
|-----------|------------|------------|------------------------|
| lite | +120 tokens | 1 tool call | **+567K tokens saved** |
| full | +175 tokens | 1 tool call | **+567K tokens saved** |
| ultra | +195 tokens | 1 tool call | **+566K tokens saved** |

Caveman Code mode pays for itself on the **first tool call** of every session.

#### Cost Impact (Sonnet pricing, $3/M input)

```
  15-turn session:  ~$1.70 saved per session
  30-turn session:  ~$6.92 saved per session  (91% tool compression)
```

#### Session Replay (real sessions)

4 sessions analyzed from `~/.cave/agent/sessions/`:

| Metric | Value |
|--------|-------|
| Total tool calls | 78 |
| Actual API input tokens | 105,105 |
| Cache read tokens | 1,314,699 |
| Tool types | bash (19), read (31), write (28) |

Note: These sessions had small tool outputs (all under budget thresholds). Compression savings scale with output size -- the offline benchmarks above show the full range on realistic large outputs.

Run benchmarks yourself:

```bash
npm run bench:offline   # Compression analysis (free, <1s)
npm run bench:replay    # Analyze your real sessions (free)
npm run bench:live      # A/B comparison with LLM calls (needs API key, ~$1-2)
npm run bench           # All tiers
```

---

## RTK Integration

RTK (Rust Token Killer) is an optional external binary. When installed, Caveman Code can rewrite bash commands through `rtk rewrite` before execution, then still apply Caveman Code-mode compression afterward.

### Install check

```bash
rtk --version
```

### Disable globally

```json
// ~/.cave/agent/settings.json
{
  "rtk": { "enabled": false }
}
```

More: [docs/settings.md](docs/settings.md)

---

## Customization

### Prompt Templates
Reusable Markdown prompts in:
- `~/.cave/agent/prompts/`
- `.cave/prompts/`

Docs: [docs/prompt-templates.md](docs/prompt-templates.md)

### Skills
On-demand capability packs in:
- `~/.cave/agent/skills/`
- `~/.agents/skills/`
- `.cave/skills/`
- `.agents/skills/`

Docs: [docs/skills.md](docs/skills.md)

### Extensions
TypeScript modules can register tools, commands, event handlers, keybindings, UI, sub-agents, permission gates, MCP integrations, and more.

```typescript
export default function (api: ExtensionAPI) {
  api.registerTool({ name: "deploy", ... });
  api.registerCommand("stats", { ... });
  api.on("tool_call", async (event, ctx) => { ... });
}
```

Extension docs: [docs/extensions.md](docs/extensions.md) · Examples: [examples/extensions/](examples/extensions/)

### Themes
Built-in: `dark`, `light`. Custom themes live in:
- `~/.cave/agent/themes/`
- `.cave/themes/`

Docs: [docs/themes.md](docs/themes.md)

### Caveman Code Packages
Bundle and share extensions, skills, prompts, and themes via npm or git.

```bash
caveman install npm:@foo/cave-tools
caveman install git:github.com/user/repo
caveman remove npm:@foo/cave-tools
caveman list
caveman update
caveman config
```

Package docs: [docs/packages.md](docs/packages.md)

---

## Programmatic Usage

### SDK

```typescript
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@juliusbrussee/caveman-code";

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

await session.prompt("What files are in the current directory?");
```

Advanced API docs: [docs/sdk.md](docs/sdk.md) · Examples: [examples/sdk/](examples/sdk/)

### RPC Mode

```bash
caveman --mode rpc
```

Protocol details: [docs/rpc.md](docs/rpc.md)

---

## CLI Reference

```bash
caveman [options] [@files...] [messages...]
```

### Subcommands

| Command | Description |
|---------|-------------|
| `caveman goal start "<text>" [flags]` | Autonomous goal loop (Ralph-style) |
| `caveman goal resume [id] [--force]` | Resume a paused/completed goal |
| `caveman goal status [id]` | Show goal state, ledger, transcript |
| `caveman goal cancel [id]` | Mark goal as cancelled |
| `caveman goal list` | List all goals in project |

### Subcommands

| Command | Description |
|---------|-------------|
| `caveman goal start "<text>" [flags]` | Autonomous Ralph-style goal loop |
| `caveman goal resume [id] [--force]` | Resume a paused goal |
| `caveman goal status [id]` | Show goal state and ledger |
| `caveman goal cancel [id]` | Cancel a running goal |
| `caveman goal list` | List all goals |
| `caveman mcp <subcmd>` | Manage MCP servers |
| `caveman watch [paths]` | File watcher for `// cave!` triggers |
| `caveman exec [flags] "<prompt>"` | Non-interactive CI mode |
| `caveman plugin <subcmd>` | Plugin marketplace |
| `caveman run-recipe <name>` | Run YAML workflows |
| `caveman rollback N` | Revert to checkpoint N |
| `caveman models <subcmd>` | Manage model registry |
| `caveman serve` / `attach` | Daemon mode |

### Core options

| Option | Description |
|--------|-------------|
| `-c`, `--continue` | Continue most recent session |
| `-r`, `--resume` | Browse and select session |
| `-p`, `--print` | Print response and exit |
| `--mode json\|rpc` | Structured output modes |
| `--provider <name>` | Provider (`anthropic`, `openai`, `google`, ... ) |
| `--model <pattern>` | Model ID or pattern |
| `--thinking <level>` | `off` · `minimal` · `low` · `medium` · `high` · `xhigh` |
| `--tools <list>` | Enable specific built-in tools |
| `--no-tools` | Disable built-in tools |
| `--no-extensions` | Disable extension discovery |
| `-e`, `--extension <src>` | Load explicit extension |
| `--api-key <key>` | Override env var auth |
| `-v`, `--version` | Show version |
| `-h`, `--help` | Show help |

### Slash commands (in TUI)

| Command | Description |
|---------|-------------|
| `/plan` | Toggle plan mode (read-only exploration) |
| `/act` | Execute a saved plan |
| `/caveman [level]` | Adjust token compression |
| `/login`, `/logout` | OAuth authentication |
| `/model` | Switch models |
| `/settings` | Configure settings |
| `/resume` | Browse sessions |
| `/tree` | Navigate session history |

Built-in tools: `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`

### Environment variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `CAVE_CODING_AGENT_DIR` | Override config directory (default: `~/.cave/agent`) |
| `CAVE_PACKAGE_DIR` | Override package directory |
| `CAVE_SKIP_VERSION_CHECK` | Skip version check at startup |
| `CAVE_CACHE_RETENTION` | Set to `long` for extended prompt cache |
| `VISUAL`, `EDITOR` | External editor for Ctrl+G |

---

## Contributing

Contribution guide: [../../CONTRIBUTING.md](../../CONTRIBUTING.md)

Development docs:
- [docs/development.md](docs/development.md)
- [docs/settings.md](docs/settings.md)
- [docs/models.md](docs/models.md)
- [docs/custom-provider.md](docs/custom-provider.md)

---

## Plugin Marketplace

Caveman Code supports a plugin ecosystem. Plugins bundle commands, skills, agents, themes, hooks, and MCP server configs.

```bash
caveman plugin search [query]           # Search all configured marketplaces
caveman plugin install <owner/name>     # Install a plugin from GitHub or a URL
caveman plugin list                     # Show installed plugins
caveman plugin upgrade                  # Upgrade all installed plugins
caveman plugin marketplace add <url>    # Register a remote marketplace
caveman plugin marketplace list         # Show configured marketplace sources
```

Marketplaces are resolved in order: repo (`.cave/plugins/marketplace.json`), personal (`~/.cave/plugins/marketplace.json`), and remote URLs. Plugins install into `~/.cave/plugins/<owner>/<name>/`. To scaffold a new plugin, use `/plugin create` in interactive mode (invokes the `plugin-creator` skill).

---

## License

MIT
