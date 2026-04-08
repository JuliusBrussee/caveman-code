# RTK Key Patterns & Algorithms

This document captures critical implementation patterns and algorithms from RTK that are directly applicable to caveman-cli's tool result compression strategy.

## Command Rewriting Algorithm

### Phase 1: Tokenization (State Machine Lexing)
Single-pass conversion of raw shell input to typed tokens:
- Handles shell quoting (single/double quotes)
- Processes escape sequences
- Separates redirects, operators, pipes
- Preserves command structure integrity

**Key Design**: Naive string-splitting fails on content like `git commit -m "fix && update"`. RTK's state machine correctly parses this as a single command with quoted argument.

### Phase 2: Compound Command Splitting
Identifies segments separated by operators:
- `&&` (AND) - both execute if left succeeds
- `||` (OR) - right executes if left fails
- `;` (sequential) - both execute regardless
- `|` (pipe) - output becomes input

**Critical Rule**: "Only the left side of `|` is rewritten" to preserve output format compatibility downstream.

### Phase 3: Per-Segment Rewriting
For each command segment:
1. Strip trailing redirects (temporarily remove `2>&1`, `>/dev/null`)
2. Handle special cases (head, tail, cat with context-aware rewrites)
3. Normalize command (strip env prefixes, paths)
4. Pattern match against 60+ rewrite rules
5. Reconstruct: `prefix + rtk_equivalent + args + redirects`

### Phase 4: Safety Guards
Prevent rewriting when:
- `RTK_DISABLED=1` in environment
- Structured output flags present (`--json`, `--jq`)
- `cat` uses flags beyond `-n`
- Write operations detected (`>`, `>>`)
- Command in exclusion list

**Impact**: Safety-first approach means failed filters gracefully degrade to raw output.

## Filter Architecture: 12-Strategy Taxonomy

### 1. Stats Extraction (90-99% savings)
**Example**: `cargo test` output
```
Input:  "test result: ok. 1245 passed; 0 failed; 0 ignored"
       (plus 10,000 lines of individual test results)
Output: "✓ 1245 passed"
```
**Technique**: Extract summary stats, drop detail lines.

### 2. Error-Only Mode (60-80% savings)
**Example**: Linter with warnings mixed in
```
Input:  100 lines (90 passing checks + 10 warnings)
Output: 10 warning lines only
```
**Technique**: Isolate stderr, suppress stdout when not requested.

### 3. Grouping by Pattern (80-90% savings)
**Example**: ESLint violations by rule
```
Input:  "file.ts:10: unused-var"
       "file.ts:20: unused-var"
       "file.ts:30: unused-var"
Output: "unused-var: 3 violations in file.ts"
```
**Technique**: Aggregate identical error types with counts.

### 4. Deduplication (70-85% savings)
**Example**: Repeated build warnings
```
Input:  [line 1] Warning A
       [line 2] Warning A
       [line 3] Warning B
Output: Warning A (2x)
       Warning B (1x)
```
**Technique**: Collapse duplicate lines, annotate counts.

### 5. Structure Only (80-95% savings)
**Example**: File tree listing
```
Input:  "drwxr-xr-x  user  group  4096  Apr 1  src/utils/helpers/types.ts"
Output: "src/utils/helpers/"
```
**Technique**: Extract schema/hierarchy, strip literal values.

### 6. Code Filtering (20-90% savings)
**Example**: Stacktrace condensing
```
Input:  Full 50-line stack with library frames
Output: User code frames only (10 lines)
```
**Technique**: Language-aware filtering (skip framework, keep user code).

### 7. Failure Focus (94-99% savings)
**Example**: Test suite with 1000 passing, 2 failing
```
Input:  Full output (5000 lines)
Output: 2 failing tests only (20 lines)
```
**Technique**: Show failures/errors, hide passing cases.

### 8. Tree Compression (50-70% savings)
**Example**: `find` or `tree` output
```
Input:  "dir/subdir/subsubdir/file.txt" (100 entries)
Output: "dir/ (47 files, 8 subdirs)"
```
**Technique**: Group by directory, provide counts.

### 9. Progress Filtering (85-95% savings)
**Example**: Build tool with ANSI progress
```
Input:  "[=====     ] 50% Compiling..."
       "[======    ] 60% Compiling..."
Output: "[======    ] 60% Compiling..." (only final state)
```
**Technique**: Strip ANSI escape codes, keep final state.

### 10. JSON/Text Dual Mode (80%+ savings)
**Example**: Tool supports both formats
```
Input via --format text: 50 lines of text output
Input via --format json: Structured data (same info, 10 lines)
```
**Technique**: Inject `--json` flag, parse structured output.

### 11. State Machine Parsing (90%+ savings)
**Example**: Test runner phases
```
IDLE → TEST_SUITE_START → [TEST_A_PASS → TEST_B_FAIL → ...] → SUMMARY
Accumulate: (passed: 1000, failed: 2, skipped: 5)
```
**Technique**: Track state transitions, aggregate final metrics.

### 12. NDJSON Streaming (90%+ savings)
**Example**: Newline-delimited JSON events
```
Each line: {"type": "test", "name": "foo", "status": "pass"}
Accumulate: {"total": 1000, "passed": 998, "failed": 2}
```
**Technique**: Line-by-line parsing, aggregate into summary.

## TOML Filter Pipeline (8 Stages)

Sequential processing of output through configurable stages:

1. **strip_ansi**: Remove ANSI escape codes
   ```toml
   strip_ansi = true
   ```

2. **replace**: Line-by-line regex substitutions
   ```toml
   replace = [
     { pattern = "^\\[.*\\]", replacement = "" },  # Remove timestamps
     { pattern = " \\(pid \\d+\\)$", replacement = "" }  # Remove PIDs
   ]
   ```

3. **match_output**: Short-circuit rules with custom messages
   ```toml
   match_output = [
     { pattern = "^error", message = "Build failed", preserve_errors = true }
   ]
   ```

4. **strip/keep_lines**: Mutually exclusive line filtering
   ```toml
   strip_lines_matching = ["^DEBUG:", "^TRACE:"]  # OR
   keep_lines_matching = ["^ERROR:", "^WARN:"]    # Only these
   ```

5. **truncate_lines_at**: Unicode-safe per-line truncation
   ```toml
   truncate_lines_at = 100  # Max 100 chars/line
   ```

6. **head/tail_lines**: First N or last N lines
   ```toml
   head_lines = 20  # First 20 lines
   tail_lines = 10  # OR last 10 lines
   ```

7. **max_lines**: Final ceiling
   ```toml
   max_lines = 50  # Hard cap at 50 lines
   ```

8. **on_empty**: Fallback message
   ```toml
   on_empty = "No relevant output"
   ```

**Example Pipeline**: Strip ANSI → Replace timestamps → Keep error lines → Truncate to 80 chars → Max 30 lines

## Package Manager Detection (JS/TS Priority)

**Detection Logic**:
```
if pnpm-lock.yaml exists
  → pnpm exec -- <tool>
else if yarn.lock exists
  → yarn exec -- <tool>
else
  → npx --no-install -- <tool>
```

**Why Order Matters**:
1. **pnpm**: Fastest, best monorepo support
2. **yarn**: Medium speed, good compatibility
3. **npx**: Fallback, no install required

**Applies To**: lint, tsc, next, prettier, playwright, prisma, vitest, pnpm

**Rationale**: Preserves CWD, supports monorepos, avoids global installs.

## Token Tracking Metrics

**SQLite Schema**:
```
commands table:
- timestamp (when)
- original_cmd (what was run)
- rtk_cmd (what RTK replaced it with)
- project_path (where)
- input_tokens (before compression)
- output_tokens (after compression)
- saved_tokens (difference)
- savings_pct (ratio)
- exec_time_ms (performance impact)

parse_failures table:
- raw_command
- error_type
- fallback_succeeded
```

**Token Estimation Heuristic**:
```
tokens = ceiling(text.length / 4.0)
```
GPT-style tokenization: ~4 characters per token average.

**Auto-Cleanup**: Records older than 90 days removed daily.

**Query Pattern** (`rtk gain`):
- Total commands executed
- Total tokens saved
- Average savings percentage
- Command overhead metrics

## Exit Code Propagation Pattern

**Critical for CI/CD Reliability**:

```rust
pub fn run(args: &[String]) -> Result<i32> {
    let output = Command::new("tool").args(args).output()?;
    
    if !output.status.success() {
        eprintln!("{}", String::from_utf8_lossy(&output.stderr));
        std::process::exit(output.status.code().unwrap_or(1));
    }
    
    Ok(exit_code_from_output(&output))
}
```

**Rules**:
- 0 = success
- 1 = RTK internal error
- N = preserved from underlying tool
- 128 + signal = Unix signal handling

**Key Principle**: Modules return `Result<i32>`, never call `process::exit()` directly. `main.rs` exits once with final code.

## Graceful Degradation Pattern

**Standard Fallback**:
```rust
match filter_output(&stdout) {
    Ok(filtered) => println!("{}", filtered),
    Err(e) => {
        eprintln!("Filter failed: {}", e);
        eprintln!("Falling back to raw output");
        println!("{}", stdout);  // Raw output unchanged
    }
}
```

**Never Block**: If filtering fails for any reason, user still sees output.

## Tee Recovery Pattern

For structured output parsing (JSON, NDJSON, state machines):

```rust
match parse_json(&stdout) {
    Ok(parsed) => {
        let summary = summarize(&parsed);
        println!("{}", summary);
        tee::tee_and_hint("label", &stdout);  // Save full output
    }
    Err(_) => {
        tee::tee_and_hint("label", &stdout);  // Full output available
        println!("{}", stdout);  // Raw fallback
    }
}
```

**Purpose**: Ensures full output available to LLM via recovery hints when filtering succeeds but truncates.

## Environment Variable Prefix Handling

**Pattern**:
```
INPUT:  "RUST_LOG=debug RAILS_ENV=test rails test"
PARSE:  Extract "RUST_LOG=debug RAILS_ENV=test" + "rails test"
REWRITE: Extract tool "rails test" → rewrite to "rtk rails test"
RECONSTRUCT: "RUST_LOG=debug RAILS_ENV=test rtk rails test"
```

**Regex**:
```rust
^((?:[A-Z_]+=(?:'[^']*'|"[^"]*"|[^\s])*\s+)*)?(?:sudo\s+)?(?:env\s+)?
```

Strips assignments, preserves them for reapplication.

---

**These patterns enable caveman-cli to**:
1. Make intelligent filtering decisions per command category
2. Preserve exit codes for CI/CD safety
3. Gracefully degrade on filter failures
4. Track and report token savings
5. Support multiple LLM agent integration hooks
6. Scale across 100+ command types with consistent architecture
