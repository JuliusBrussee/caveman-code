# Discover Module README

## Overview

The discover module powers Claude Code's command rewriting system through two complementary functions: live command rewriting during LLM execution and historical analysis of past sessions.

## Core Responsibilities

**Live Command Rewriting**
Every command the LLM agent executes passes through the rewrite engine, which determines whether to transform it into an `rtk` equivalent or leave it unchanged. This is the critical hot path for performance optimization.

**Historical Session Analysis**
The `rtk discover` command examines past Claude Code JSONL session files to identify commands that could have benefited from rewriting but weren't, using identical classification logic.

## Command Rewriting Architecture

### Tokenization Phase

The lexer converts raw shell input into typed tokens via single-pass state machine processing. This approach correctly handles shell quoting, escapes, redirects, and operators—avoiding naive string-splitting failures on content like `git commit -m "fix && update"`.

### Compound Command Splitting

The rewrite engine traverses tokens to identify segments separated by operators (`&&`, `||`, `;`) or pipes (`|`). Each segment rewrites independently, except for pipe consumers (which run raw) and commands like `find`/`fd` before pipes (which break downstream tools expecting different output formatting).

### Per-Segment Rewriting Pipeline

1. **Redirect stripping** — Trailing redirects (`2>&1`, `>/dev/null`) are temporarily removed
2. **Special case handling** — Commands like `head` and `tail` receive context-aware rewrites that preserve correct flag positioning
3. **Command classification** — Environment prefixes, paths, and git options are normalized before pattern matching against 60+ rules
4. **Prefix replacement** — The command name becomes its `rtk` equivalent with environment prefix re-applied and redirects restored

### Safety Guards

The system skips rewriting when:
- `RTK_DISABLED=1` appears in environment variables
- Structured output flags (`--json`, `--jq`) would be corrupted
- `cat` uses flags beyond `-n`
- Write operations (`>`, `>>`) are detected
- Commands appear in the exclusion configuration

## History Analysis Mechanism

The discover command processes Claude Code session files containing tool invocation pairs. It extracts commands, applies the same tokenization and classification logic as live rewriting, and generates aggregate reports on rewrite opportunities and projected token savings.

## Environment Variable Management

The `ENV_PREFIX` regex intelligently strips variable assignments (quoted or unquoted), `sudo`, and `env` declarations from command prefixes, then re-applies them to the rewritten output. This dual-processing approach ensures clean pattern matching while preserving runtime environment requirements.

## Extending Rewrite Rules

Adding new rewrite patterns requires only modifying `rules.rs` with entries containing: regex pattern, target RTK command, command prefixes to replace, and optional per-subcommand overrides. The system auto-compiles patterns via lazy initialization without requiring changes elsewhere.
