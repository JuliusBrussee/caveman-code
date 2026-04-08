# Caveman Code

> Caveman Code is a fork of [pi-mono](https://github.com/badlogic/pi-mono) by [Mario Zechner (badlogic)](https://mariozechner.at). The original project is MIT-licensed. Caveman Code adds Cave Mode, the CaveKit extension, and is published under the `@cavepi/` package scope.

A minimal, extensible terminal coding agent and multi-provider LLM toolkit — adapt it to your workflow, not the other way around.

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`@cavepi/pi-coding-agent`](packages/coding-agent) | `cave` CLI | Coding agent CLI with sessions, extensions, skills, and themes |
| [`@cavepi/pi-ai`](packages/ai) | `pi-ai` CLI | Unified multi-provider LLM API (OpenAI, Anthropic, Google, and more) |
| [`@cavepi/pi-agent-core`](packages/agent) | — | Agent runtime with tool calling and state management |
| [`@cavepi/pi-tui`](packages/tui) | — | Terminal UI library with differential rendering |
| [`@cavepi/pi-web-ui`](packages/web-ui) | — | Web components for AI chat interfaces |
| [`@cavepi/pi-mom`](packages/mom) | `mom` CLI | Slack bot that delegates messages to the coding agent |
| [`@cavepi/pi`](packages/pods) | `pi-pods` CLI | CLI for managing vLLM deployments on GPU pods |
| [`@cavekit/pi-extension`](packages/cavekit-extension) | — | CaveKit SDD workflow extension (Draft → Architect → Build → Inspect) |

---

## Quick Start

### Requirements

- Node.js 20+
- An API key for at least one supported provider, or an active subscription

### Install the coding agent

```bash
npm install -g @cavepi/pi-coding-agent
```

This installs the `cave` CLI.

### Authenticate

```bash
# Via API key (Anthropic example)
export ANTHROPIC_API_KEY=sk-ant-...
cave

# Via OAuth subscription (Claude Pro/Max, ChatGPT Plus, Gemini, Copilot, etc.)
cave
/login   # then select provider
```

### Run

```bash
cave                  # interactive mode
cave "explain this codebase"
cave -p "summarize this file"   # non-interactive, print and exit
cat README.md | cave -p "summarize this"   # pipe stdin
```

---

## Features

### Providers & Models

Caveman Code maintains an up-to-date list of tool-capable models for every built-in provider.

**Via subscription (OAuth):** Claude Pro/Max · ChatGPT Plus/Pro · GitHub Copilot · Google Gemini · Google Antigravity

**Via API key:** Anthropic · OpenAI · Azure OpenAI · Google Gemini · Google Vertex · Amazon Bedrock · Mistral · Groq · Cerebras · xAI · OpenRouter · Vercel AI Gateway · Hugging Face · Kimi · MiniMax · ZAI · OpenCode

**Custom providers:** Add any OpenAI/Anthropic/Google-compatible endpoint via `~/.cave/agent/models.json`. For full custom OAuth or APIs, use the [Extensions API](packages/coding-agent/docs/extensions.md).

Switch models at any time with `/model` (or `Ctrl+L`). Cycle between a scoped set of favourites with `Ctrl+P`.

### Interactive Mode

The TUI shows a startup header, message history (including tool calls and thinking blocks), a live editor, and a footer with cost/token/context stats.

| Feature | How |
|---------|-----|
| File reference | Type `@` to fuzzy-search project files |
| Path completion | Tab |
| Multi-line input | Shift+Enter |
| Paste images | Ctrl+V |
| Run shell commands | `!cmd` (sends output to LLM) · `!!cmd` (runs silently) |
| Thinking level | Shift+Tab to cycle (`off → minimal → low → medium → high → xhigh`) |
| Collapse tool output | Ctrl+O |
| Collapse thinking | Ctrl+T |

### Commands

Type `/` to trigger any command. Extensions can register their own.

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

Sessions auto-save to `~/.cave/agent/sessions/`, organised by working directory. Each session is a JSONL file with a full tree structure so branching never overwrites history.

```bash
cave -c                    # continue most recent session
cave -r                    # browse and select a session
cave --session <path|id>   # open a specific session
cave --fork <path|id>      # fork a session into a new file
cave --no-session          # ephemeral mode
```

**`/tree`** — navigate and branch in-place. Search, fold, page, and filter (default / no-tools / user-only / labeled-only). Press `Shift+L` to label bookmarks.

**Compaction** — automatic context compaction triggers on overflow or when approaching the limit. Use `/compact` for manual control with optional custom instructions. Full history remains in the JSONL file.

### Customization

**Prompt Templates** — reusable Markdown prompts with `{{placeholders}}`. Place in `~/.cave/agent/prompts/` or `.pi/prompts/` and invoke with `/templatename`.

**Skills** — on-demand capability packages. Place in `~/.cave/agent/skills/` or `.pi/skills/` (or install via `cave install`). Invoke with `/skill:name` or let the agent auto-load them.

**Extensions** — TypeScript modules loaded at startup. Register tools, commands, keyboard shortcuts, event handlers, and UI components:

```typescript
export default function (pi: ExtensionAPI) {
  pi.registerTool({ name: "deploy", ... });
  pi.registerCommand("stats", { ... });
  pi.on("tool_call", async (event, ctx) => { ... });
}
```

Extensions can add sub-agents, plan mode, permission gates, custom editors, status lines, headers, footers, overlays, MCP integration, git checkpointing, and more.

**Themes** — built-in `dark` and `light`; themes hot-reload. Place custom themes in `~/.cave/agent/themes/` or `.pi/themes/`.

**Cave Packages** — bundle and share extensions, skills, prompts, and themes via npm or git:

```bash
cave install npm:@foo/pi-tools
cave install git:github.com/user/repo
cave remove npm:@foo/pi-tools
cave list
cave update
cave config   # enable/disable package resources
```

### CaveKit Extension (`@cavekit/pi-extension`)

Integrates the **CaveKit SDD (Spec-Driven Development) workflow** as first-class `/ck:*` commands — from natural language spec to built, validated code.

| Command | Description |
|---------|-------------|
| `/ck:draft <description>` | Decompose a project description into domain kit files with R-numbered requirements and acceptance criteria |
| `/ck:architect` | Generate a tiered task graph (build site) from approved kits, with dependency edges and coverage matrix |
| `/ck:build` | Execute the build site via wave-based parallel dispatch; tasks in the same wave run concurrently |
| `/ck:inspect` | Gap analysis — classify each acceptance criterion as met / partial / not met; flag over-builds |
| `/ck:research <topic>` | Dispatch parallel subagents to explore a topic and return a consolidated summary |
| `/ck:design [create\|audit]` | Create or audit a structured `DESIGN.md` (9-section design system format) |
| `/ck:progress` | Show build state: task statuses, wave progress, tier gate results, convergence metrics |
| `/ck:config [key] [value]` | Read or write CaveKit configuration |
| `/ck:help [command]` | List all `/ck:*` commands or show detailed usage for one |

**Tier Gate Review** — at each tier boundary, an adversarial reviewer evaluates completed work. P0/P1 findings pause the build and prompt: approve, generate fix tasks, or abort.

**Convergence Monitoring** — tracks lines changed per iteration and test pass rates. Detects healthy convergence vs. iteration ceiling and recommends stopping when further iteration is unproductive.

**Scoped Context** — each dispatched subagent receives only the kit sections relevant to its assigned tasks, keeping context focused.

### Programmatic Usage

**SDK:**

```typescript
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@cavepi/pi-coding-agent";

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

await session.prompt("What files are in the current directory?");
```

**RPC mode** — for non-Node.js integrations, communicate over stdin/stdout via JSONL:

```bash
cave --mode rpc
```

**Print / JSON mode** — for scripting:

```bash
cave -p "Summarize this codebase"
cave --mode json "List todos"
```

---

## CLI Reference

```bash
cave [options] [@files...] [messages...]
```

### Key options

| Option | Description |
|--------|-------------|
| `-c`, `--continue` | Continue most recent session |
| `-r`, `--resume` | Browse and select session |
| `-p`, `--print` | Non-interactive: print response and exit |
| `--mode json\|rpc` | Structured output modes |
| `--provider <name>` | Provider (anthropic, openai, google, …) |
| `--model <pattern>` | Model ID or pattern; supports `provider/id` and `:<thinking>` suffix |
| `--thinking <level>` | `off` · `minimal` · `low` · `medium` · `high` · `xhigh` |
| `--tools <list>` | Enable specific built-in tools (default: `read,bash,edit,write`) |
| `--no-tools` | Disable built-in tools (extension tools still active) |
| `--no-extensions` | Disable extension discovery |
| `-e`, `--extension <src>` | Load a specific extension (repeatable) |
| `--api-key <key>` | API key (overrides env vars) |
| `-v`, `--version` | Show version |
| `-h`, `--help` | Show help |

Available built-in tools: `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`

### Environment variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `CAVE_CODING_AGENT_DIR` | Override config directory (default: `~/.cave/agent`) |
| `CAVE_SKIP_VERSION_CHECK` | Skip startup version check |
| `CAVE_CACHE_RETENTION` | Set to `long` for extended prompt cache (Anthropic: 1h, OpenAI: 24h) |

---

## Development

```bash
npm install          # install all dependencies
npm run build        # build all packages (order-dependent, run before check)
npm run check        # lint, format, and type check
./test.sh            # run tests (LLM-dependent tests skipped without API keys)
./pi-test.sh         # run cave from sources (works from any directory)
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and [AGENTS.md](AGENTS.md) for project-specific rules for humans and agents.

Caveman Code tracks upstream pi-mono. Caveman Code-specific changes (binary name, package scope, CaveKit extension) are kept in separate commits for clean rebasing.

**Upstream:** [github.com/badlogic/pi-mono](https://github.com/badlogic/pi-mono)
**Fork:** [github.com/JuliusBrussee/caveman-cli](https://github.com/JuliusBrussee/caveman-cli)

---

## License

MIT
