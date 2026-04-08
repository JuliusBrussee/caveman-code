# RTK Architecture Documentation — Complete Reference

## Overview

**RTK (Rust Token Killer)** is a high-performance CLI proxy designed to minimize LLM token consumption through intelligent filtering and compression. The system achieves 60-99% token reduction across different ecosystems while maintaining ~5-15ms overhead per command.

## Core Design Principles

1. **Single Responsibility**: Each module manages one command type
2. **Minimal Overhead**: Negligible performance impact per invocation
3. **Exit Code Preservation**: Critical for CI/CD pipeline reliability
4. **Fail-Safe Design**: Falls back to original output if filtering fails
5. **Transparency**: Users access raw output via `-v` flags

## Command Lifecycle (Six Phases)

The execution flow moves through: **PARSE** (extract command and flags) → **ROUTE** (dispatch to handler) → **EXECUTE** (run underlying tool) → **FILTER** (compress output) → **PRINT** (display results) → **TRACK** (record metrics).

For example, `rtk git log --oneline -5` captures 500 characters of output, compresses to 20 characters (96% reduction), and logs tokens saved to SQLite.

## Filtering Taxonomy

RTK employs twelve distinct filtering strategies:

| Strategy | Technique | Example Savings |
|----------|-----------|-----------------|
| **Stats Extraction** | Count/aggregate, drop details | 90-99% |
| **Error Only** | Isolate stderr, drop stdout | 60-80% |
| **Grouping by Pattern** | Group violations by rule | 80-90% |
| **Deduplication** | Unique entries plus counts | 70-85% |
| **Structure Only** | Keys/types, strip values | 80-95% |
| **Code Filtering** | Language-aware stripping | 20-90% (varies by level) |
| **Failure Focus** | Show failures only, hide passing | 94-99% |
| **Tree Compression** | Directory hierarchies with counts | 50-70% |
| **Progress Filtering** | Strip ANSI sequences | 85-95% |
| **JSON/Text Dual Mode** | Structured when available | 80%+ |
| **State Machine Parsing** | Track test lifecycle | 90%+ |
| **NDJSON Streaming** | Line-by-line JSON aggregation | 90%+ |

## Module Organization

RTK comprises **64 modules total**: 42 command modules + 22 infrastructure modules.

**Ecosystem Coverage** (token savings by category):
- **GIT**: 85-99% (status, diff, log, branch operations)
- **JS/TS**: 70-99% (eslint, tsc, next, prettier, vitest, pnpm)
- **Python**: 70-90% (ruff, pytest, pip)
- **Go**: 75-90% (go test/build, golangci-lint)
- **Ruby**: 60-90% (rake, rspec, rubocop)
- **.NET**: 70-85% (dotnet build/test)
- **Cloud**: 60-80% (aws, docker, kubectl, curl)
- **System**: 50-90% (ls, tree, grep, json parsing)
- **Rust**: 60-99% (cargo test/build, clippy)

## Python & Go Architecture

### Python Stack (Standalone Commands)

Python commands (`ruff_cmd.rs`, `pytest_cmd.rs`, `pip_cmd.rs`) use distinct output formats:

- **ruff check**: JSON API with rule violations grouped and counted
- **ruff format**: Text diff extraction ("Fixed 12 files")
- **pytest**: State machine parsing (IDLE → TEST_START → PASSED/FAILED → SUMMARY)
- **pip list**: JSON-to-table compression

**No Package Manager Detection**: Unlike JS/TS, Python doesn't auto-detect poetry/pipenv because `pip` is universally available and `uv` detection is explicit.

### Go Stack (Sub-Enum Pattern)

Go commands use a sub-enum router (`Commands::Go { Test, Build, Vet }`):

- **go test**: NDJSON streaming with interleaved package events aggregated
- **go build**: Text filtering for compiler diagnostics
- **go vet**: File:line:message triple extraction
- **golangci-lint**: JSON parsing with violations grouped by linter rule

**Sub-Enum vs Standalone**: Go commands are semantically related (core toolchain), mirror existing patterns (git/cargo), and provide natural CLI syntax (`rtk go test`).

## Package Manager Detection

**Critical for JS/TS ecosystem** — detection priority:

```
1. pnpm-lock.yaml exists? → pnpm exec -- <tool>
2. yarn.lock exists?      → yarn exec -- <tool>
3. Fallback               → npx --no-install -- <tool>
```

This ensures CWD preservation, monorepo support, and no global installs. Used by: lint, tsc, next, prettier, playwright, prisma, vitest, pnpm.

## Token Tracking System

**SQLite-based metrics** stored in `~/.local/share/rtk/history.db`:

Token estimation: `tokens = (text.length / 4.0).ceil()` — heuristic based on GPT-style tokenization.

Each command records: timestamp, original_cmd, rtk_cmd, input_tokens, output_tokens, saved_tokens, savings_pct, exec_time_ms.

Auto-cleanup removes records older than 90 days. The `rtk gain` command queries aggregate statistics: total commands, total tokens saved, average savings percentage, execution time metrics.

## Verbosity & Global Flags

**Verbosity Levels**:
- **None**: Compact output only
- **-v**: Debug messages via eprintln!
- **-vv**: Command execution details
- **-vvv**: Raw output before filtering

**Ultra-Compact Mode (-u)**:
- ASCII icons instead of words
- Inline formatting (single-line summaries)
- Maximum compression for LLM contexts

Both are implemented as global flags via Clap's derive macros.

## Exit Code Preservation (CI/CD Critical)

Standard pattern across modules:

```rust
let output = Command::new("git").args(args).output()?;
if !output.status.success() {
    eprintln!("{}", String::from_utf8_lossy(&output.stderr));
    std::process::exit(output.status.code().unwrap_or(1));
}
```

**Exit codes**: 0 = success, 1 = rtk internal error, N = preserved from underlying tool. Essential for pre-commit hooks and CI/CD pipelines.

## Error Handling

Uses `anyhow::Result<()>` propagation chain:

```
main() → git::run() → git::execute() → Command::output()
                ↓
         .context("meaningful message")
                ↓
         anyhow::Error bubbles up
                ↓
         eprintln!("Error: {:#}", err)
```

Provides full context chain for debugging while preserving exit codes.

## Configuration System

**Two tiers**:
1. **User Settings**: `~/.config/rtk/config.toml` (tracking, tee, database paths)
2. **LLM Integration**: `CLAUDE.md` (via `rtk init`) with template instructions

Initialization flow prompts user, writes template, and creates config directory structure.

## Performance Profile

**Binary**: ~4.1 MB (stripped release build), ~5-10ms startup, ~2-5 MB runtime memory

**Command Overhead** (estimated):
- git status: +8ms
- grep: +12ms
- read: +5ms
- lint: +15ms

Sources: Clap parsing (~2-3ms), execution (~1-2ms), filtering/compression (~2-8ms), SQLite tracking (~1-3ms).

## Extensibility

To add new commands, follow the checklist in `src/cmds/README.md`:
1. Create module file (e.g., `new_cmd.rs`)
2. Add enum variant to `Commands` in `main.rs`
3. Implement routing in match statement
4. Add filtering logic with appropriate strategy
5. Write unit tests with representative outputs
6. Document in ecosystem README

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Rust** | Performance (~5-15ms overhead), safety, single binary, cross-platform |
| **SQLite** | Zero config, lightweight (~100KB for 90 days), ACID compliance, queryable |
| **anyhow** | Context chains, ergonomic `?` operator, user-friendly error display |
| **Clap** | Derive macros, auto-generated help, type safety, global flags |

## Key Files & Resources

- **TECHNICAL.md**: End-to-end flow walkthrough
- **CONTRIBUTING.md**: Philosophy, workflow, design checklist
- **CLAUDE.md**: AI agent quick reference
- **README.md**: User guide and examples
- **src/core/README.md**: Utilities API and configuration format
- **src/cmds/README.md**: New command addition guide
- **hooks/README.md**: Hook interception and JSON formats

---

**Last Updated**: 2026-03-24 | **Architecture Version**: 3.1
