# RTK Technical Documentation Summary

## Overview

RTK is a Rust-based CLI filtering system designed to reduce token consumption for LLM-powered coding agents. It intercepts command outputs and strips boilerplate, achieving "60-90% token savings per command" while maintaining transparency and adding minimal overhead.

## Core Architecture

The system operates through a layered pipeline:

1. **Hook Layer**: Agent-specific hooks (7 supported agents including Claude Code, Copilot, Cursor) intercept commands via JSON events and rewrite them to RTK equivalents
2. **Rewrite Registry**: Determines which commands qualify for filtering via pattern matching
3. **Filter Engine**: Applies either compiled Rust filters or declarative TOML DSL filters
4. **Tracking Layer**: Records metrics to SQLite for analytics

## Key Design Principles

- **Single-threaded architecture**: "Startup < 10ms" with no async overhead
- **Graceful degradation**: "Filter failure falls back to raw output"
- **Exit code propagation**: "RTK never swallows non-zero exits"
- **Transparent proxy**: Unknown commands "pass through unchanged"

## Command Rewriting Flow

The rewrite pipeline tokenizes input, splits on operators, strips redirects, classifies commands, and reconstructs with RTK equivalents. Notably, "only the left side of `|` is rewritten" to preserve pipe semantics.

## Filter Systems

**Rust Filters**: Compiled ecosystem-specific modules (9 ecosystems: Rust, Go, Node, Python, Java, .NET, Cloud/Kubernetes, Git, Web)

**TOML DSL Filters**: Declarative pipeline with "8-stage" processing: ANSI stripping, regex replacement, line matching, truncation, and more

## Testing Requirements

Tests embed in module files within `#[cfg(test)]` blocks using real command fixtures. "60% minimum required" token savings verification mandatory for new filters.

## Performance Targets

| Metric | Target |
|--------|--------|
| Startup time | < 10ms |
| Memory usage | < 5MB resident |
| Binary size | < 5MB stripped |

## Hook Support Matrix

Claude Code, GitHub Copilot (VS Code & CLI), Cursor, Cline/Roo Code, Windsurf, OpenCode, and Codex CLI each have dedicated integration mechanisms ranging from shell hooks to TypeScript plugins.
