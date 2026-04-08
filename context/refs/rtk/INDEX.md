# RTK Reference Material Index

This directory contains comprehensive reference documentation for the RTK (Rust Token Killer) repository, organized by topic for easy navigation and integration with caveman-cli.

## Core Documentation

- **[README.md](README.md)** - Overview of RTK, key statistics, features, installation methods
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines, design principles, workflow
- **[CLAUDE.md](CLAUDE.md)** - AI agent quick reference, development workflow, coding standards

## Architecture & Technical Design

- **[docs/contributing/ARCHITECTURE.md](docs/contributing/ARCHITECTURE.md)** - Complete architecture overview including:
  - Core design principles (6)
  - Command lifecycle (6 phases)
  - Filtering taxonomy (12 distinct strategies)
  - Module organization (64 total modules, 42 command + 22 infrastructure)
  - Ecosystem coverage with token savings percentages
  - Python & Go stack architecture details
  - Package manager detection logic
  - Token tracking system (SQLite-based)
  - Performance profile and targets
  - Extensibility patterns

- **[docs/contributing/TECHNICAL.md](docs/contributing/TECHNICAL.md)** - Technical implementation details:
  - Layered pipeline architecture
  - Command rewriting flow
  - Filter systems (Rust vs. TOML)
  - Testing requirements
  - Performance targets
  - Hook support matrix

## Command & Filter Implementation

- **[src/cmds/README.md](src/cmds/README.md)** - Command filter modules guide:
  - Scope & boundaries
  - Rust vs. TOML filter decision matrix
  - 9 ecosystem organizations with command lists
  - Execution flow: `runner::run_filtered()`
  - Exit code propagation patterns
  - Cross-cutting behavior contracts
  - Step-by-step guide for adding new command filters

- **[src/filters/README.md](src/filters/README.md)** - Built-in filters (TOML DSL):
  - Core purpose and ideal use cases
  - Implementation workflow
  - Configuration fields (8-stage pipeline)
  - File naming conventions

- **[src/core/README.md](src/core/README.md)** - Core infrastructure:
  - Domain-agnostic building blocks
  - TOML filter pipeline (8 stages)
  - Tracking schema and SQLite design
  - Configuration structure
  - Consumer contracts (tracking, tee recovery)

- **[src/discover/README.md](src/discover/README.md)** - Command rewriting system:
  - Live command rewriting vs. historical analysis
  - Tokenization and state machine processing
  - Compound command splitting logic
  - Per-segment rewriting pipeline
  - Safety guards and special cases
  - Environment variable management

## LLM Agent Integration

- **[hooks/README.md](hooks/README.md)** - Hook integration overview:
  - Core mechanism (hook → rtk rewrite → JSON response)
  - Supported agents (7 agents with different mechanisms)
  - Design principles (non-blocking, graceful degradation, single source of truth)
  - Rewrite registry categories
  - Override controls
  - Adding new integrations

- **[hooks/claude/README.md](hooks/claude/README.md)** - Claude Code specific:
  - Shell-based PreToolUse hook
  - Key features and safety mechanisms
  - Testing capabilities (60+ assertions)

- **[hooks/claude/rtk-rewrite.sh](hooks/claude/rtk-rewrite.sh)** - Claude Code hook script:
  - Complete implementation with dependency checks
  - JSON manipulation logic
  - Exit code interpretation (0=allow, 1=passthrough, 2=deny, 3=ask)
  - Command extraction and rewriting

## Key Implementation Patterns

### Filter Implementations
RTK uses a taxonomy of 12 filtering strategies:
1. Stats Extraction (90-99% savings)
2. Error Only (60-80%)
3. Grouping by Pattern (80-90%)
4. Deduplication (70-85%)
5. Structure Only (80-95%)
6. Code Filtering (20-90%)
7. Failure Focus (94-99%)
8. Tree Compression (50-70%)
9. Progress Filtering (85-95%)
10. JSON/Text Dual Mode (80%+)
11. State Machine Parsing (90%+)
12. NDJSON Streaming (90%+)

### Module Organization
Ecosystems covering 9 domains:
- **git/** - Git operations, GitHub CLI, diffs
- **rust/** - Cargo, test/error runners
- **js/** - Node ecosystem (npm, pnpm, vitest, lint, tsc, etc.)
- **python/** - Ruff, pytest, mypy, pip
- **go/** - Go toolchain (test, build, vet, golangci-lint)
- **dotnet/** - .NET stack
- **cloud/** - AWS, Docker, kubectl, curl
- **system/** - Cross-platform commands
- **ruby/** - Ruby ecosystem

### Hook Mechanisms
7 agents with different integration patterns:
1. **Claude Code** - Shell hook (PreToolUse)
2. **VS Code Copilot** - Rust binary
3. **GitHub Copilot CLI** - Rust binary (deny-with-suggestion)
4. **Cursor** - Shell hook
5. **Gemini CLI** - Rust binary
6. **Cline/Roo Code** - Rules file (.clinerules)
7. **Windsurf** - Rules file (.windsurfrules)

## Integration Points for caveman-cli

### Token Compression Strategy
RTK reduces token consumption through intelligent filtering across 100+ commands achieving:
- Overall: ~80% token savings on medium projects
- Peak: 90-99% savings for specific command categories

### Rewrite Registry
The registry intelligently decides which commands qualify for RTK filtering via:
1. Tokenization (shell-aware lexing)
2. Compound command splitting (handles operators: &&, ||, ;, |)
3. Per-segment rewriting (patterns → RTK equivalents)
4. Safety guards (detects write operations, structured flags, etc.)

### Performance Constraints
- Startup time: < 10ms
- Memory usage: < 5MB resident
- Binary size: < 5MB stripped
- Command overhead: 5-15ms per invocation

### Configuration
- User settings: `~/.config/rtk/config.toml`
- Project-local filters: `.rtk/filters.toml`
- Telemetry: Anonymous, optional, daily aggregation

---

**Last Updated**: 2026-04-08 | **RTK Version Reference**: 0.28.2+
