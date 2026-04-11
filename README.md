<h1 align="center">Caveman Code</h1>

<p align="center">
  <strong>The most token-efficient coding CLI.</strong><br/>
  A lightweight Claude Code alternative with spec-driven development built in.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cave"><img src="https://img.shields.io/npm/v/cave?color=blue&label=npm" alt="npm version" /></a>
  <a href="https://github.com/JuliusBrussee/caveman-cli/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node.js 20+" /></a>
</p>

---

Caveman Code (`cave`) is a terminal coding agent that treats tokens like a scarce resource. Every layer of the stack — prompt construction, tool output, file reads, structured data — is compressed before it hits your context window. The result: you get the same work done with a fraction of the tokens.

It works with every major LLM provider, but the point isn't just multi-provider support. The point is doing more with less. Cave mode is always on by default, RTK rewrites tool calls to cut output by ~60%, read deduplication prevents wasted context on repeated file reads, and per-tool budgets keep structured output tight. Spec-driven development (CaveKit) is built in so you can go from description to validated code through a structured pipeline instead of open-ended chat.

Forked from [pi-mono](https://github.com/badlogic/pi-mono) by badlogic. Maintained at [JuliusBrussee/caveman-cli](https://github.com/JuliusBrussee/caveman-cli).

```bash
npm install -g cave
cave
```

---

## Why Cave Over Claude Code

| | Caveman Code | Claude Code |
|---|---|---|
| **Token usage** | Cave mode + RTK + read dedup = ~60% fewer tokens per session | No built-in compression |
| **Communication style** | Caveman mode: terse, technical, no filler — configurable (`lite`/`full`/`ultra`/`off`) | Standard verbose output |
| **Spec-driven dev** | CaveKit built in: Draft → Architect → Build → Inspect with tier gates | No structured workflow |
| **Provider lock-in** | 15+ providers, switch mid-conversation, OAuth or API key | Anthropic only |
| **Tool output** | Per-tool budgets, structured compression, ANSI stripping, head/tail truncation | Full output passed through |
| **File reads** | Fingerprinted deduplication — re-reads return stubs | Full content every time |
| **Extensibility** | TypeScript extensions, skills, themes, prompt templates, packages | Limited |
| **Cost** | Your API key, your subscription, your rates | Anthropic pricing only |

---

## How Token Savings Work

Cave doesn't just talk shorter. It compresses at every layer of the stack:

### Layer 1: Caveman Mode (prompt compression)
The model responds in terse, technical fragments. No filler, no pleasantries, no hedging. All technical accuracy preserved. Three intensity levels:
- **`lite`** — brief responses, still mostly natural
- **`full`** (default) — caveman fragments, drops articles and filler
- **`ultra`** — maximum brevity, telegraphic

### Layer 2: Tool Output Compression (Flint Chipper + Stone Tablet)
Every tool call result gets compressed before entering context:
- **Per-tool budgets** — bash gets 80 lines, read gets 300, grep gets 120, each with head/tail preservation
- **Structured compression** — JSON and XML outputs are semantically compressed, extracting relevant keys
- **ANSI stripping** — terminal escape codes removed
- **Blank line collapse** — consecutive empty lines merged

### Layer 3: Read Deduplication
Files are fingerprinted within a session. When the same unchanged file is read again, a stub is returned instead of the full content. During refactors where files get re-read repeatedly, this alone saves significant context.

### Layer 4: RTK (Rust Token Killer)
Optional external binary. When installed, bash commands are rewritten through `rtk rewrite` before execution, producing more compact output. Combined with Cave mode compression, tool calls see ~60% token reduction.

Change level anytime: `/cave [lite|full|ultra|off]`

---

## Quick Start

### Requirements
- Node.js 20+
- An API key or active subscription for at least one supported provider

### Authenticate

```bash
# API key (any supported provider)
export ANTHROPIC_API_KEY=sk-ant-...
cave

# OAuth subscription (Claude Pro/Max, ChatGPT Plus, Copilot, Gemini, etc.)
cave
/login
```

### Use

```bash
cave                              # interactive mode
cave "explain this codebase"      # start with a prompt
cave -p "summarize this file"     # non-interactive, print and exit
cat README.md | cave -p "review"  # pipe stdin
cave -c                           # continue last session
cave -r                           # browse and select a session
```

---

## Supported Providers

### Via OAuth subscription
Claude Pro/Max · ChatGPT Plus/Pro · GitHub Copilot · Google Gemini · Google Antigravity

### Via API key
Anthropic · OpenAI · Azure OpenAI · Google Gemini · Google Vertex · Amazon Bedrock · Mistral · Groq · Cerebras · xAI · OpenRouter · Vercel AI Gateway · Hugging Face · Kimi · MiniMax · ZAI · OpenCode

### Custom providers
Add any OpenAI/Anthropic/Google-compatible endpoint via `~/.cave/agent/models.json`, or build a full custom provider with the [Extensions API](packages/coding-agent/docs/extensions.md).

---

## CaveKit — Spec-Driven Development

Instead of open-ended chat, CaveKit gives you a structured pipeline from description to validated code. Built in as `/ck:*` commands.

| Command | Phase | What it does |
|---------|-------|-------------|
| `/ck:draft` | Draft | Turn a description into kits with requirements + acceptance criteria |
| `/ck:research` | Draft | Parallel subagent research with consolidated summary |
| `/ck:design` | Draft | Create or audit a structured design system |
| `/ck:architect` | Architect | Build a tiered task graph from approved kits |
| `/ck:build` | Build | Execute tasks with wave-based parallel dispatch |
| `/ck:inspect` | Inspect | Verify work against acceptance criteria |
| `/ck:progress` | Any | Show task statuses, wave progress, convergence metrics |
| `/ck:config` | Any | Read or update CaveKit config |

**Tier gates** — at each tier boundary, an adversarial reviewer evaluates completed work. P0/P1 findings pause the build.

**Convergence monitoring** — tracks lines changed per iteration and test pass rates. Detects when further iteration is unproductive.

**Scoped context** — each dispatched subagent only receives the kit sections relevant to its tasks, keeping context focused and costs low.

---

## Features

### Interactive TUI

Full terminal interface with startup header, message history, tool calls, thinking blocks, live editor, and a cost/token/context footer.

| Feature | How |
|---------|-----|
| File reference | `@` to fuzzy-search project files |
| Path completion | Tab |
| Multi-line input | Shift+Enter |
| Paste images | Ctrl+V |
| Thinking level | Shift+Tab to cycle (`off → minimal → low → medium → high → xhigh`) |
| Shell commands | `!cmd` (sends output to LLM) · `!!cmd` (runs silently) |
| Collapse tool output | Ctrl+O |
| Collapse thinking | Ctrl+T |
| Switch model | Ctrl+L |
| Cycle favourites | Ctrl+P |

### Commands

Type `/` to see all available commands. Extensions can register their own.

| Command | Description |
|---------|-------------|
| `/login` / `/logout` | OAuth authentication |
| `/model` | Switch model |
| `/settings` | Thinking level, theme, transport, compaction |
| `/resume` | Browse previous sessions |
| `/new` | Start a new session |
| `/tree` | Navigate session tree and branch from any point |
| `/fork` | Create a new session from a branch point |
| `/compact [prompt]` | Manually compact context |
| `/copy` | Copy last assistant message to clipboard |
| `/export [file]` | Export session to HTML |
| `/share` | Upload session as a private GitHub Gist |
| `/reload` | Reload extensions, skills, prompts, keybindings, context |
| `/hotkeys` | Show all keyboard shortcuts |
| `/changelog` | View version history |

### Sessions

Sessions auto-save to `~/.cave/agent/sessions/`, organized by working directory. Each session is a JSONL file with full tree structure — branching never overwrites history.

```bash
cave -c                    # continue most recent session
cave -r                    # browse and select a session
cave --session <path|id>   # open a specific session
cave --fork <path|id>      # fork a session into a new file
cave --no-session          # ephemeral mode
```

**`/tree`** — navigate and branch in-place. Search, fold, page, filter. `Shift+L` to label bookmarks, `Shift+T` to toggle timestamps.

**Compaction** — automatic on overflow. `/compact` for manual control. Full history always in the JSONL file.

---

## Customization

### Prompt Templates

Reusable Markdown prompts with `{{placeholders}}`. Place in `~/.cave/agent/prompts/` or `.cave/prompts/` and invoke with `/templatename`.

### Skills

On-demand capability packages. Place in `~/.cave/agent/skills/` or `.cave/skills/` (or install via `cave install`). Invoke with `/skill:name` or let the agent auto-load them.

### Extensions

TypeScript modules loaded at startup. Register tools, commands, keyboard shortcuts, event handlers, and UI components:

```typescript
export default function (api: ExtensionAPI) {
  api.registerTool({ name: "deploy", ... });
  api.registerCommand("stats", { ... });
  api.on("tool_call", async (event, ctx) => { ... });
}
```

Extensions can add sub-agents, plan mode, permission gates, custom editors, status lines, headers, footers, overlays, MCP integration, git checkpointing, and more. See the [extension docs](packages/coding-agent/docs/extensions.md).

### Themes

Built-in `dark` and `light` themes, with hot-reload. Place custom themes in `~/.cave/agent/themes/` or `.cave/themes/`.

### Cave Packages

Bundle and share extensions, skills, prompts, and themes via npm or git:

```bash
cave install npm:@foo/cave-tools
cave install git:github.com/user/repo
cave remove npm:@foo/cave-tools
cave list
cave update
cave config   # enable/disable package resources
```

---

## SDK & Programmatic Usage

### Embedding Cave

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

### RPC mode

For non-Node.js integrations, communicate over stdin/stdout via JSONL:

```bash
cave --mode rpc
```

### Print / JSON mode

For scripting and automation:

```bash
cave -p "Summarize this codebase"
cave --mode json "List todos"
```

---

## CLI Reference

```bash
cave [options] [@files...] [messages...]
```

| Option | Description |
|--------|-------------|
| `-c`, `--continue` | Continue most recent session |
| `-r`, `--resume` | Browse and select session |
| `-p`, `--print` | Non-interactive: print response and exit |
| `--mode json\|rpc` | Structured output modes |
| `--provider <name>` | Provider (`anthropic`, `openai`, `google`, …) |
| `--model <pattern>` | Model ID or pattern; supports `provider/id` and `:<thinking>` suffix |
| `--thinking <level>` | `off` · `minimal` · `low` · `medium` · `high` · `xhigh` |
| `--tools <list>` | Enable specific built-in tools (default: `read,bash,edit,write`) |
| `--no-tools` | Disable built-in tools (extension tools still active) |
| `--no-extensions` | Disable extension discovery |
| `-e`, `--extension <src>` | Load a specific extension (repeatable) |
| `--api-key <key>` | API key (overrides env vars) |
| `-v`, `--version` | Show version |
| `-h`, `--help` | Show help |

Built-in tools: `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`

### Environment variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `CAVE_CODING_AGENT_DIR` | Override config directory (default: `~/.cave/agent`) |
| `CAVE_SKIP_VERSION_CHECK` | Skip startup version check |
| `CAVE_CACHE_RETENTION` | Set to `long` for extended prompt cache (Anthropic: 1h, OpenAI: 24h) |

---

## Monorepo Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`cave`](packages/coding-agent) | `cave` | Coding agent CLI |
| [`@cave/ai`](packages/ai) | `pi-ai` | Unified multi-provider LLM API |
| [`@cave/agent`](packages/agent) | — | Agent runtime with tool calling and state management |
| [`@cave/tui`](packages/tui) | — | Terminal UI with differential rendering |
| [`@cave/web-ui`](packages/web-ui) | — | Web components for AI chat interfaces |
| [`@cave/mom`](packages/mom) | `mom` | Slack bot that delegates to the coding agent |
| [`@cave/pods`](packages/pods) | `cave-pods` | vLLM deployment on GPU pods |
| [`@cave/cavekit`](packages/cavekit-extension) | — | CaveKit SDD workflow extension |

---

## Contributing

```bash
git clone https://github.com/JuliusBrussee/caveman-cli.git
cd caveman-cli
npm install
npm run build
npm run check   # lint, format, type check
./test.sh       # run tests
```

Uses [Biome](https://biomejs.dev/) for linting and formatting. TypeScript strict mode throughout.

---

## License

MIT
