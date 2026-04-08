# Command Filter Modules — Complete README

## Overview

This component handles **command execution and output filtering** across multiple ecosystems (Git, Rust, JavaScript, Python, Go, .NET, Cloud, System, Ruby). Each module executes an external CLI tool, transforms stdout/stderr to reduce token consumption, and records savings via the tracking system.

## Scope & Boundaries

**Owns:** All command-specific filter logic organized by ecosystem, with cross-ecosystem routing as needed (e.g., lint detecting Python and delegating to ruff).

**Does not own:** The TOML DSL filter engine (`core/toml_filter`), hook interception (`hooks/`), or analytics dashboards (`analytics/`). This component writes to the tracking database; analytics reads from it.

**Boundary rule:** A module belongs here if it executes an external command and filters its output. Infrastructure serving multiple modules without calling commands belongs in `core/`.

## Rust vs. TOML Filters

Rust modules exist for capabilities TOML lacks:
- Parsing structured output (JSON, NDJSON)
- State machine parsing across phases
- Injecting CLI flags (e.g., `--format json`)
- Cross-command routing and "flag-aware filtering" (adjusting compression based on user flags like `--nocapture`)

**Ecosystem placement:** Match the command's language/toolchain; use `system/` for language-agnostic commands. Create new ecosystems when 3+ related commands justify it.

## Ecosystems

| Ecosystem | Commands | Key Pattern |
|-----------|----------|------------|
| **git/** | git, gh, gt, diff | Trailing var-arg parsing, gh markdown filtering |
| **rust/** | cargo, runner (err/test) | Cargo sub-enum routing, runner dual-mode |
| **js/** | npm, pnpm, vitest, lint, tsc, next, prettier, playwright, prisma | Package manager auto-detection, lint routing |
| **python/** | ruff, pytest, mypy, pip | JSON vs. text format, state machine parsing, uv detection |
| **go/** | go test/build/vet, golangci-lint | NDJSON streaming, sub-enum pattern |
| **dotnet/** | dotnet, binlog, trx, format_report | DotnetCommands sub-enum, internal helpers |
| **cloud/** | aws, docker/kubectl, curl, wget, psql | Docker/Kubectl sub-enums, forced JSON output |
| **system/** | ls, tree, read, grep, find, wc, env, json, log, deps, summary, format, smart | Format routing, filter levels, language detection |
| **ruby/** | rake/rails test, rspec, rubocop | JSON injection, `ruby_exec()` bundle exec detection |

## Execution Flow: `runner::run_filtered()`

The shared wrapper in `core/runner.rs` encapsulates a six-phase skeleton:

```
Execute → Filter → Print → Stderr passthrough → Track → Exit code
```

**Phases:**
1. `cmd.output()` captures stdout + stderr
2. `filter_fn` receives stdout-only or combined, returns compressed string
3. Filtered output printed; tee appends recovery hint on failure (if enabled)
4. When `filter_stdout_only`: stderr printed via `eprintln!()` unconditionally
5. `timer.track()` records raw vs. filtered for token savings
6. Returns `Ok(exit_code)` to caller; `main.rs` exits once

**RunOptions builder:**

| Constructor | Behavior |
|---|---|
| `default()` | Combined stdout+stderr, no tee |
| `with_tee("label")` | Combined + tee recovery |
| `stdout_only()` | Stdout-only to filter, stderr passthrough, no tee |
| `stdout_only().tee("label")` | Stdout-only + tee recovery |

**Example — filtered command:**

```rust
pub fn run(args: &[String], verbose: u8) -> Result<i32> {
    let mut cmd = resolved_command("mycmd");
    for arg in args { cmd.arg(arg); }
    if verbose > 0 { eprintln!("Running: mycmd {}", args.join(" ")); }
    runner::run_filtered(
        cmd, "mycmd", &args.join(" "),
        filter_mycmd_output,
        runner::RunOptions::stdout_only().tee("mycmd"),
    )
}
```

Exit code handling is **fully automatic** — the wrapper extracts the exit code (including Unix signal handling via 128+signal), tracks savings, and returns `Ok(exit_code)`.

## Cross-Cutting Behavior Contracts

### Exit Code Propagation

All module `run()` functions return `Result<i32>` (the underlying command's exit code). `main.rs` calls `std::process::exit(code)` once — **modules never call `process::exit()` directly**.

| Return | Meaning | Who exits |
|---|---|---|
| `Ok(0)` | Command succeeded | `main.rs` exits 0 |
| `Ok(N)` | Command failed with code N | `main.rs` exits N |
| `Err(e)` | RTK itself failed | `main.rs` prints error, exits 1 |

When using `run_filtered()`: exit code handling is automatic. For manual execution, use `exit_code_from_output()` or `exit_code_from_status()`.

### Filter Failure Passthrough
When filtering fails, fall back to raw output and warn on stderr. Never block the user.

### Tee Recovery
Modules parsing structured output (JSON, NDJSON, state machines) must call `tee::tee_and_hint()` for full output recovery on failure.

### Stderr Handling
Capture stderr and include it in the raw string passed to `timer.track()`, so savings reflect total output.

### Tracking Completeness
Call `timer.track()` on every path — success, failure, and fallback. Since modules return `Ok(exit_code)` instead of exiting, tracking always runs before program exit.

### Verbose Flag
All modules accept `verbose: u8`. Use it to print debug info; do not accept and ignore it.

## Adding a New Command Filter

### Rust Module

1. **Create module** in `src/cmds/<ecosystem>/mycmd_cmd.rs`:
   - Write `filter_mycmd()` function (pure: `&str -> String`)
   - Write `pub fn run(...)` using `runner::run_filtered()` — build Command, choose RunOptions, delegate
   - Use `stdout_only()` for structured stdout parsing; `default()` for combined text
   - Add `.tee("label")` for structured output (recovery on failure)
   - Exit codes handled automatically

2. **Register module**:
   - Ecosystem `mod.rs` files use `automod::dir!()` — all `.rs` files become public modules automatically
   - Add variant to `Commands` enum in `main.rs` with `#[arg(trailing_var_arg = true, allow_hyphen_values = true)]`
   - Add routing match arm in `main.rs`: `Commands::Mycmd { args } => mycmd_cmd::run(&args, cli.verbose)?,`

3. **Add rewrite pattern** in `src/discover/rules.rs` (PATTERNS + RULES arrays at matching index)

4. **Write tests** — Real fixture, snapshot test, token savings >= 60%

5. **Update docs** — Ecosystem README, CHANGELOG.md

### TOML Filter

1. Create filter in `src/filters/`
2. Add rewrite pattern in `src/discover/rules.rs`
3. Write tests and update docs

---

**Cross-Command Dependencies:**
- `lint_cmd` routes to `mypy_cmd` or `ruff_cmd` for Python detection
- `format_cmd` routes to `prettier_cmd` or `ruff_cmd` by formatter
- `gh_cmd` imports `compact_diff()` from `git` for diff formatting
