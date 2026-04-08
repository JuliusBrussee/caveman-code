# LLM Agent Hooks Integration README

## Overview

This directory contains deployed hook artifacts for integrating RTK (Rust Toolkit) with 7 major LLM coding assistants. These are "thin delegates" that intercept agent commands, route them through RTK's rewrite registry, and return agent-specific JSON responses.

## Core Mechanism

The integration flow follows this pattern:

1. Agent executes a command (e.g., `git status`)
2. Hook intercepts via agent's native event system
3. Hook calls `rtk rewrite` subprocess with the command
4. Registry returns optimized equivalent (e.g., `rtk git status`)
5. Hook formats response in agent-specific JSON
6. Agent executes rewritten command, delivering 60-90% token savings

As stated in the documentation: "All rewrite logic lives in the Rust binary. Hook scripts are thin delegates that handle agent-specific JSON formats and call `rtk rewrite`" for the actual decision-making.

## Supported Agents & Mechanisms

| Agent | Implementation | Command Modification |
|-------|---|---|
| Claude Code | Shell hook (`PreToolUse`) | Yes |
| VS Code Copilot Chat | Rust binary | Yes |
| GitHub Copilot CLI | Rust binary | Deny-with-suggestion |
| Cursor | Shell hook | Yes |
| Gemini CLI | Rust binary | Yes |
| Cline/Roo Code | Rules file (prompt-level) | N/A |
| Windsurf | Rules file (prompt-level) | N/A |

## Directory Structure

Each agent has a dedicated subdirectory with agent-specific README documentation:

- **`claude/`** — Shell hook, `PreToolUse` format, `settings.json` integration
- **`copilot/`** — Dual-format Rust binary (VS Code vs CLI modes)
- **`cursor/`** — Shell hook with empty `{}` response requirement
- **`cline/`** — `.clinerules` project-local rules file
- **`windsurf/`** — `.windsurfrules` workspace-scoped rules
- **`codex/`** — AGENTS.md awareness document
- **`opencode/`** — TypeScript plugin using zx library

## Design Principles

**Non-blocking execution**: Hooks must never prevent command execution. All error paths (missing binary, invalid JSON, rewrite failures) must exit with code 0, allowing the agent's unmodified command to run.

**Graceful degradation**: Missing dependencies, version mismatches, or subprocess failures produce warnings to stderr but don't interrupt workflow.

**Single source of truth**: The Rust registry handles all 70+ rewrite patterns; hooks only handle JSON translation.

## Rewrite Registry Categories

The registry optimizes commands across multiple domains:

- **Test runners** (vitest, pytest, cargo test): 90-99% savings
- **Build tools** (cargo, npm, make): 70-90% savings
- **Version control** (git operations): 70-80% savings
- **Infrastructure** (docker, kubectl, aws): 75-85% savings
- **Linters & formatters**: 80-85% savings

Compound commands with operators (`&&`, `||`, `;`, `|`) are handled intelligently—pipes only rewrite the left side to preserve output format compatibility.

## Override Controls

- `RTK_DISABLED=1` — Skip rewriting for a single command invocation
- `exclude_commands` in `~/.config/rtk/config.toml` — Blacklist specific commands
- Commands already prefixed with `rtk` pass through unchanged

## Adding New Integrations

New agent support requires:

1. **Documented, stable hook/plugin API** (not experimental)
2. **Active maintenance** (recent commit history)
3. **Exit code contract compliance** (exit 0 on all error paths)
4. **Exact JSON format matching** the agent's expectations

Three integration tiers exist: full hooks (high maintenance), plugins (medium), and rules files (low maintenance, prompt-level only).

---

For agent-specific implementation details, consult the README in each subdirectory.
