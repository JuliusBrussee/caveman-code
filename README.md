<p align="center">
  <img src="packages/coding-agent/src/modes/interactive/assets/clankolas.png" width="120" />
</p>

<h1 align="center">Caveman Code</h1>

<p align="center">
  <strong>Caveman Code is the open-source terminal coding agent that works with every LLM.</strong><br/>
  One tool. Every provider. Your workflow.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cave"><img src="https://img.shields.io/npm/v/cave?color=blue&label=npm" alt="npm version" /></a>
  <a href="https://github.com/JuliusBrussee/caveman-cli/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node.js 20+" /></a>
</p>

---

Most terminal coding agents lock you into a single provider. Cave doesn't. Use Claude, GPT, Gemini, Mistral, Bedrock, or any OpenAI-compatible endpoint — and switch between them mid-conversation. Bring your API key, use your existing subscription (Claude Pro, ChatGPT Plus, Copilot, Gemini), or plug in a custom provider. Your context, sessions, and tools travel with you.

Cave is built for developers who want a coding agent they can actually own: extend it, theme it, script it, and share packages with others — all without touching a fork.

Forked from [pi-mono](https://github.com/badlogic/pi-mono) by badlogic. Maintained in [JuliusBrussee/caveman-cli](https://github.com/JuliusBrussee/caveman-cli).

```bash
npm install -g cave
cave
```

---

## Why Cave

**Provider freedom** — 15+ providers built in. OAuth subscriptions and API keys both work. Switch models at any time with `/model` or `Ctrl+L`. No vendor lock-in, ever.

**Real extensibility** — Extensions are TypeScript modules that hook into everything: tools, commands, keyboard shortcuts, event handlers, UI components, sub-agents, permission gates, MCP servers. Not a plugin API bolted on after the fact — it's the core architecture.

**Session intelligence** — Sessions are persistent, tree-structured, and branchable. Navigate your full conversation history with `/tree`, fork from any point, label bookmarks, and resume across restarts. Automatic context compaction keeps you in flow without losing history.

**Spec-driven development** — The CaveKit extension (`/ck:*`) takes you from natural language description to built, validated code through a structured pipeline: Draft specs → Architect a task graph → Build with parallel dispatch → Inspect against acceptance criteria. Tier gates and convergence monitoring keep the build honest.

**Package ecosystem** — Bundle and share extensions, skills, prompt templates, and themes via npm or git. Install with `cave install`, manage with `cave config`. Build once, use everywhere.

**Programmable** — Full SDK for embedding Cave in your own tools. RPC mode for non-Node integrations. JSON mode for scripting. Pipe stdin, pass files with `@`, or run non-interactively with `-p`.

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

## Features

### Interactive TUI

A full terminal interface — not just streaming text. Startup header, message history with tool calls and thinking blocks, live editor, and a footer with cost/token/context stats.

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
| `/tree` | Navigate the full session tree and branch from any point |
| `/fork` | Create a new session from a selected branch point |
| `/compact [prompt]` | Manually compact context |
| `/copy` | Copy last assistant message to clipboard |
| `/export [file]` | Export session to HTML |
| `/share` | Upload session as a private GitHub Gist |
| `/reload` | Reload extensions, skills, prompts, keybindings, and context files |
| `/hotkeys` | Show all keyboard shortcuts |
| `/changelog` | View version history |

### Sessions

Sessions auto-save to `~/.cave/agent/sessions/`, organised by working directory. Each session is a JSONL file with a full tree structure — branching never overwrites history.

```bash
cave -c                    # continue most recent session
cave -r                    # browse and select a session
cave --session <path|id>   # open a specific session
cave --fork <path|id>      # fork a session into a new file
cave --no-session          # ephemeral mode
```

**`/tree`** — navigate and branch in-place. Search, fold, page, and filter (default / no-tools / user-only / labeled-only). Press `Shift+L` to label bookmarks, `Shift+T` to toggle timestamps.

**Compaction** — automatic context compaction triggers on overflow. Use `/compact` for manual control with optional custom instructions. Full history remains in the JSONL file.

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

## CaveKit — Spec-Driven Development

The built-in CaveKit extension (`@cave/cavekit`) integrates a full spec-driven development workflow as `/ck:*` commands.

| Command | Description |
|---------|-------------|
| `/ck:draft <description>` | Decompose a description into domain kits with requirements and acceptance criteria |
| `/ck:architect` | Generate a tiered task graph from kits, with dependency edges and coverage matrix |
| `/ck:build` | Execute the task graph via wave-based parallel dispatch |
| `/ck:inspect` | Gap analysis — classify each acceptance criterion as met / partial / not met |
| `/ck:research <topic>` | Parallel subagent research with consolidated summary |
| `/ck:design [create\|audit]` | Create or audit a structured design system (`DESIGN.md`) |
| `/ck:progress` | Build state: task statuses, wave progress, convergence metrics |
| `/ck:config` | Read or write CaveKit configuration |

**Tier Gate Review** — at each tier boundary, an adversarial reviewer evaluates completed work. P0/P1 findings pause the build and prompt: approve, generate fix tasks, or abort.

**Convergence Monitoring** — tracks lines changed per iteration and test pass rates. Detects healthy convergence vs. iteration ceiling and recommends stopping when further iteration is unproductive.

**Scoped Context** — each dispatched subagent receives only the kit sections relevant to its assigned tasks, keeping context focused and costs low.

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
