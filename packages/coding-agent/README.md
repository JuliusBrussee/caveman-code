<!-- OSS_WEEKEND_START -->
# 🏖️ OSS Weekend

**Issue tracker reopens Monday, April 13, 2026.**

OSS weekend runs Thursday, April 2, 2026 through Monday, April 13, 2026. New issues and PRs from unapproved contributors are auto-closed during this time. Approved contributors can still open issues and PRs if something is genuinely urgent, but please keep that to pressing matters only. For support, join [Discord](https://discord.com/invite/nKXTsAcmbT).

> _Current focus: at the moment i'm deep in refactoring internals, and need to focus._
<!-- OSS_WEEKEND_END -->

---

<h1 align="center">Caveman Code</h1>
<p align="center">Terminal coding harness with token-saving cave mode</p>
<p align="center">
  <a href="https://discord.com/invite/nKXTsAcmbT"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
  <a href="https://www.npmjs.com/package/cave"><img alt="npm" src="https://img.shields.io/npm/v/cave?style=flat-square" /></a>
  <a href="https://github.com/JuliusBrussee/caveman-cli/actions/workflows/ci.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/JuliusBrussee/caveman-cli/ci.yml?style=flat-square&branch=main" /></a>
</p>

Caveman Code is the `cave` CLI package in [JuliusBrussee/caveman-cli](https://github.com/JuliusBrussee/caveman-cli). Forked from [pi-mono](https://github.com/badlogic/pi-mono) by badlogic. This README documents the forked Caveman Code package, not the upstream project.

Cave is a minimal terminal coding harness that stays provider-agnostic, terminal-native, and deeply extensible. Use it interactively, run it in print or JSON mode, embed it through the SDK, or extend it with TypeScript modules, skills, prompt templates, themes, and CaveKit workflows.

---

## Install

```bash
npm install -g cave
cave
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
cave

# Or sign in with an existing subscription
cave
/login
```

### Use

```bash
cave                              # interactive mode
cave "explain this codebase"      # start with prompt
cave -p "summarize this file"     # print mode
cat README.md | cave -p "review"  # pipe stdin
cave -c                           # continue last session
cave -r                           # browse sessions
```

Success looks like this:
- interactive TUI opens with active model + status footer
- `/login` or API key auth succeeds
- model can call built-in tools like `read`, `bash`, `edit`, and `write`

Platform notes: [Windows](docs/windows.md) · [Termux](docs/termux.md) · [tmux](docs/tmux.md) · [Terminal setup](docs/terminal-setup.md) · [Shell aliases](docs/shell-aliases.md)

---

## What Cave Adds

Caveman Code keeps upstream extensibility goals, then adds fork-specific workflows and compression features on top.

| Area | Cave |
|------|------|
| Multi-provider coding agent | Built in |
| Cave mode | 3-layer token compression |
| RTK integration | Optional bash command rewriting + output reduction |
| CaveKit | Draft → Architect → Build → Inspect workflow |
| Package ecosystem | Install prompts, skills, themes, and extensions via npm or git |
| SDK + RPC | Embed in apps or automate from other runtimes |

---

## Supported Providers

### OAuth subscriptions
Claude Pro/Max · ChatGPT Plus/Pro · GitHub Copilot · Google Gemini · Google Antigravity

### API keys
Anthropic · OpenAI · Azure OpenAI · Google Gemini · Google Vertex · Amazon Bedrock · Mistral · Groq · Cerebras · xAI · OpenRouter · Vercel AI Gateway · Hugging Face · Kimi · MiniMax · ZAI · OpenCode

### Custom providers
Add any OpenAI-, Anthropic-, or Google-compatible endpoint via `~/.cave/agent/models.json`, or build a custom provider with [Extensions](docs/extensions.md) and [Custom Provider docs](docs/custom-provider.md).

Provider setup details: [docs/providers.md](docs/providers.md)

---

## Modes

| Mode | Command | Use case |
|------|---------|----------|
| Interactive | `cave` | Full TUI with history, editor, tool calls, and status UI |
| Print | `cave -p "..."` | One-shot scripting |
| JSON | `cave --mode json "..."` | Structured automation |
| RPC | `cave --mode rpc` | Stdin/stdout process integration |
| SDK | `createAgentSession()` | Embed Cave in Node.js apps |

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
cave -c                    # continue most recent session
cave -r                    # browse sessions
cave --session <path|id>   # open specific session
cave --fork <path|id>      # fork into new session
cave --no-session          # ephemeral mode
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

## Cave Mode

Cave mode is enabled by default and reduces token waste without changing workflow.

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

Change level with `/cave [lite|full|ultra|off]`.

Settings reference: [docs/settings.md](docs/settings.md)

---

## RTK Integration

RTK (Rust Token Killer) is an optional external binary. When installed, Cave can rewrite bash commands through `rtk rewrite` before execution, then still apply Cave-mode compression afterward.

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

## CaveKit

CaveKit is the structured development workflow bundled with Caveman Code.

| Command | Phase | Description |
|---------|-------|-------------|
| `/ck:draft` | Draft | Turn a description into kits with requirements + acceptance criteria |
| `/ck:research` | Draft | Research a topic before spec work |
| `/ck:design` | Draft | Create or audit structured design docs |
| `/ck:architect` | Architect | Build tiered task graph from approved kits |
| `/ck:build` | Build | Execute tasks with tier gates + convergence tracking |
| `/ck:inspect` | Inspect | Verify work against acceptance criteria |
| `/ck:progress` | Any | Show task and wave status |
| `/ck:config` | Any | Read or update CaveKit config |

Context layout:
- `context/kits/` — requirements
- `context/plans/` — implementation plans
- `context/designs/` — design artifacts

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

### Cave Packages
Bundle and share extensions, skills, prompts, and themes via npm or git.

```bash
cave install npm:@foo/cave-tools
cave install git:github.com/user/repo
cave remove npm:@foo/cave-tools
cave list
cave update
cave config
```

Package docs: [docs/packages.md](docs/packages.md)

---

## Programmatic Usage

### SDK

```typescript
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "cave";

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
cave --mode rpc
```

Protocol details: [docs/rpc.md](docs/rpc.md)

---

## CLI Reference

```bash
cave [options] [@files...] [messages...]
```

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

## License

MIT
