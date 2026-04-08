# RTK Reference Material - START HERE

Complete reference documentation for the RTK (Rust Token Killer) project, prepared for caveman-cli tool result compression integration.

## Quick Navigation

### For Understanding Architecture
Start with **INDEX.md** then dive into:
1. **docs/contributing/ARCHITECTURE.md** - Complete system design
2. **docs/contributing/TECHNICAL.md** - Implementation details

### For Implementation Patterns
- **PATTERNS.md** - 12 filtering strategies, algorithms, key patterns
- **src/cmds/README.md** - How to add new command filters
- **src/core/README.md** - Core infrastructure and tracking
- **src/filters/README.md** - TOML filter DSL reference

### For Hook Integration
- **hooks/README.md** - Overview of 7 agent integrations
- **hooks/claude/README.md** - Claude Code specific implementation
- **hooks/claude/rtk-rewrite.sh** - Complete shell hook script

### For Contributing/Development
- **CONTRIBUTING.md** - Contribution guidelines
- **CLAUDE.md** - Quick reference for AI agents

## What is RTK?

RTK (Rust Token Killer) is a high-performance CLI proxy that reduces LLM token consumption by 60-90% through intelligent filtering and compression of command outputs. It's the reference implementation for tool result compression that caveman-cli should integrate.

## Key Statistics

- **Overall token savings**: ~80% on medium-sized projects
- **Command coverage**: 100+ commands across 9 ecosystems
- **Performance**: 5-15ms overhead per command
- **Binary size**: <5MB stripped
- **Memory usage**: <5MB resident
- **Startup time**: <10ms

## Core Architecture

### Six-Phase Command Lifecycle
1. **PARSE** - Extract command and flags
2. **ROUTE** - Dispatch to handler
3. **EXECUTE** - Run underlying tool
4. **FILTER** - Compress output
5. **PRINT** - Display results
6. **TRACK** - Record metrics

### 12-Strategy Filtering Taxonomy

RTK achieves compression through domain-specific strategies:

| Strategy | Savings | Example |
|----------|---------|---------|
| Stats Extraction | 90-99% | Reduce `cargo test` to summary |
| Error-Only | 60-80% | Show linter warnings, hide passing |
| Grouping | 80-90% | Aggregate violations by rule |
| Deduplication | 70-85% | Collapse duplicates with counts |
| Structure Only | 80-95% | File tree hierarchies |
| Code Filtering | 20-90% | Stack trace user code only |
| Failure Focus | 94-99% | Test failures only |
| Tree Compression | 50-70% | Directory counts |
| Progress Filtering | 85-95% | Final ANSI state only |
| JSON/Text Dual | 80%+ | Force structured format |
| State Machines | 90%+ | Track test lifecycle |
| NDJSON Streaming | 90%+ | Aggregate JSON events |

### 9 Ecosystems, 42 Command Modules

Organized by language/toolchain:
- **git** - Version control (git, gh, diff)
- **rust** - Cargo, test runners, clippy
- **js** - Node ecosystem (npm, pnpm, vitest, eslint, etc.)
- **python** - Ruff, pytest, pip
- **go** - Go toolchain with sub-enum routing
- **dotnet** - .NET tools
- **cloud** - AWS, Docker, kubectl
- **system** - Cross-platform commands
- **ruby** - Ruby ecosystem

## Command Rewriting Algorithm

### Phase 1: Tokenization
Shell-aware lexing with state machine processing:
- Handles shell quoting (single/double)
- Processes escape sequences
- Separates redirects, operators, pipes
- Preserves command structure integrity

**Key**: Avoids naive string-splitting failures on content like `git commit -m "fix && update"`

### Phase 2: Compound Command Splitting
Identifies operator-separated segments:
- `&&` (AND) - Execute both if left succeeds
- `||` (OR) - Right only if left fails
- `;` (Sequential) - Both regardless
- `|` (Pipe) - Output becomes input

**Critical Rule**: Only rewrite left side of pipes to preserve downstream format.

### Phase 3: Per-Segment Rewriting
For each command segment:
1. Strip trailing redirects temporarily
2. Handle special cases (head, tail, context-aware rewrites)
3. Normalize command (remove env prefixes, paths)
4. Pattern match against 60+ rewrite rules
5. Reconstruct with prefixes + RTK equivalent + args + redirects

### Phase 4: Safety Guards
Prevent rewriting when:
- `RTK_DISABLED=1` environment variable set
- Structured output flags present (`--json`, `--jq`)
- Write operations detected (`>`, `>>`)
- Command in exclusion list
- `cat` uses flags beyond `-n`

**Design**: Safety-first → failed filters gracefully degrade to raw output

## Token Tracking System

**SQLite-based metrics** stored in `~/.local/share/rtk/history.db`:

Tracks per-command:
- Original command and RTK equivalent
- Input/output token counts
- Savings percentage and execution time
- Project path (for per-project analysis)

**Token Estimation**: `tokens = ceiling(text.length / 4.0)` (GPT-style)

**Auto-cleanup**: Records older than 90 days removed daily

**Query**: `rtk gain` command shows aggregate statistics

## Package Manager Detection (JS/TS)

Critical for monorepo and CWD preservation:

```
if pnpm-lock.yaml exists
  → pnpm exec -- <tool>
else if yarn.lock exists
  → yarn exec -- <tool>
else
  → npx --no-install -- <tool>
```

**Applies to**: lint, tsc, next, prettier, playwright, prisma, vitest, pnpm

## Exit Code Propagation

Essential for CI/CD reliability:

```
0 = success
1 = RTK internal error
N = preserved from underlying tool
128 + signal = Unix signal handling
```

**Pattern**: Modules return `Result<i32>`, `main.rs` exits once. Never block command execution.

## Configuration

**Two tiers**:
1. **User**: `~/.config/rtk/config.toml` (tracking, tee, database paths)
2. **Project**: `.rtk/filters.toml` (custom TOML filters)

**LLM Integration**: `CLAUDE.md` template (via `rtk init`) with instructions

## TOML Filter Pipeline (8 Stages)

Sequential processing of output:

1. **strip_ansi** - Remove ANSI escape codes
2. **replace** - Regex substitutions with backreferences
3. **match_output** - Short-circuit rules
4. **strip/keep_lines** - Line filtering
5. **truncate_lines_at** - Unicode-safe truncation
6. **head/tail_lines** - Keep N first/last lines
7. **max_lines** - Final ceiling
8. **on_empty** - Fallback message

Example: Strip ANSI → Replace timestamps → Keep error lines → Truncate → Max 30 lines

## LLM Agent Hook Integration

Seven agents with different integration mechanisms:

| Agent | Type | Mechanism |
|-------|------|-----------|
| Claude Code | Shell | PreToolUse hook |
| Copilot (VS Code) | Binary | Direct binary call |
| Copilot (CLI) | Binary | Deny-with-suggestion |
| Cursor | Shell | Shell hook |
| Gemini CLI | Binary | Direct binary call |
| Cline/Roo | Rules | .clinerules file |
| Windsurf | Rules | .windsurfrules file |

**Hook Pattern**:
1. Agent executes command
2. Hook intercepts via agent event system
3. Hook calls `rtk rewrite` subprocess
4. Returns optimized equivalent in agent-specific JSON
5. Agent executes rewritten command

**Design**: Thin delegates (shell/TypeScript) calling Rust binary as single source of truth

## Integration for caveman-cli

### Filtering Strategy
Apply 12-strategy taxonomy to caveman-cli's tool result compression:
- Identify command category
- Select appropriate filter strategy(ies)
- Execute multi-stage TOML pipeline
- Track token savings via SQLite

### Rewriting Logic
Implement command rewriting using RTK's algorithm:
- Tokenize shell input with state machine
- Split compound commands by operators
- Pattern match per-segment against rules
- Apply safety guards before rewriting

### Performance Profile
Target RTK's constraints:
- Startup <10ms (lazy initialization)
- Memory <5MB (focus on efficiency)
- Command overhead 5-15ms (acceptable in LLM context)

### Module Organization
Structure filters by ecosystem (git, python, rust, js, etc.) with shared infrastructure layer for core utilities (tracking, configuration, TOML engine).

### Hook Integration
Implement Claude Code `PreToolUse` hook using RTK's pattern:
- Shell-based hook (requires `jq`)
- Calls `rtk rewrite` subprocess
- Returns modified command in Claude-specific JSON
- Exit codes: 0=auto-allow, 1=passthrough, 2=deny, 3=ask

## Files in This Reference

- **00-START-HERE.md** (this file) - Overview and navigation
- **INDEX.md** - Detailed index with all section links
- **PATTERNS.md** - Key algorithms and implementation patterns
- **README.md** - RTK feature overview
- **CONTRIBUTING.md** - Contribution guidelines
- **CLAUDE.md** - AI agent quick reference

### Documentation Structure
```
docs/contributing/
  ├── ARCHITECTURE.md (64-module design, 12-strategy taxonomy)
  └── TECHNICAL.md (implementation details)

src/
  ├── cmds/README.md (command filter architecture)
  ├── core/README.md (core infrastructure)
  ├── discover/README.md (command rewriting system)
  └── filters/README.md (TOML DSL reference)

hooks/
  ├── README.md (7-agent integration overview)
  └── claude/
      ├── README.md (Claude Code specific)
      └── rtk-rewrite.sh (implementation)
```

## Statistics

- **Total documents**: 14 files
- **Total content**: 1,549 lines
- **Total size**: 76 KB
- **Coverage**: Complete architecture, implementation guides, and integration examples

## Next Steps

1. Read **ARCHITECTURE.md** for complete system understanding
2. Study **PATTERNS.md** for the 12 filtering strategies
3. Review **src/cmds/README.md** for module addition patterns
4. Examine **hooks/claude/rtk-rewrite.sh** for Claude Code integration
5. Use **TOML filter pipeline** for creating new filters

---

**Prepared**: 2026-04-08  
**Source**: https://github.com/rtk-ai/rtk (master branch)  
**For**: caveman-cli tool result compression integration
