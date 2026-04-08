# Core Infrastructure README

## Overview

Core Infrastructure provides domain-agnostic building blocks that support all RTK command modules. As a dependency leaf with no inward imports, it handles configuration, token tracking, filtering, output recovery, and telemetry.

## Key Responsibilities

**Owns:**
- Configuration loading
- Token tracking persistence
- TOML filter engine
- Tee output recovery
- Display formatting
- Telemetry
- Shared utilities

**Does Not Own:**
- Command-specific filtering (handled by `cmds/`)
- Hook lifecycle management (handled by `src/hooks/`)
- Analytics dashboards (handled by `analytics/`)

## TOML Filter Pipeline

Filters execute in 8 sequential stages:

1. **strip_ansi** — Remove ANSI escape codes when enabled
2. **replace** — Line-by-line regex substitutions with backreferences
3. **match_output** — Short-circuit rules with optional error preservation
4. **strip/keep_lines** — Mutually exclusive line filtering
5. **truncate_lines_at** — Unicode-safe character truncation per line
6. **head/tail_lines** — Keep N first or last lines with omission messages
7. **max_lines** — Final line count ceiling
8. **on_empty** — Fallback message if result is empty

Filters load via three-tier lookup (first match wins): project-local `.rtk/filters.toml`, user `~/.config/rtk/filters.toml`, or compiled built-ins.

## Tracking Schema

Two tables persist metrics:

**commands** — Records timestamp, original command, RTK invocation, project path, input/output token counts, savings percentage, and execution time.

**parse_failures** — Logs parsing errors with raw commands and whether fallback succeeded.

Uses GLOB patterns to avoid wildcard interpretation in file paths.

## Configuration Structure

Core supports sections for tracking, display, tee output, telemetry, hooks, and operational limits—all optional with sensible defaults.

## Consumer Contracts

**Tracking:** Call `timer.track()` on all code paths (success, failure, fallback) before exit. Include stdout and stderr in raw strings for accurate metrics.

**Tee Recovery:** Call `tee::tee_and_hint()` for structured output parsing. Use `force_tee_hint()` for successful truncation cases to preserve full output availability for LLMs.

## Design Principles

- Lazy initialization for <10ms startup
- No circular dependencies
- General-purpose utilities only
- Unit tests colocated with implementations
