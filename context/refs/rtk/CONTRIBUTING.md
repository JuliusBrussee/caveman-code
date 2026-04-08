# RTK Contributing Guide

## Overview

**rtk (Rust Token Killer)** is a coding agent proxy that filters CLI output to reduce token consumption by 60-90%. The project welcomes contributions through bug reports, fixes, new filters, code review, and documentation improvements.

## Core Design Principles

The project adheres to four foundational guidelines:

1. **Correctness vs. Token Savings**: Honor explicit user requests for detailed output via flags. Compress default outputs aggressively, but preserve content when users request it explicitly.

2. **Transparency**: RTK's filtered output must remain indistinguishable from standard tool output. Avoid custom headers or formats that could confuse LLM parsing.

3. **Never Block**: Filters must gracefully fall back to raw output on failure. RTK should never prevent command execution.

4. **Zero Overhead**: Maintain <10ms startup time. No async runtimes, config I/O on critical paths, or network calls.

## Contribution Types

| Category | Examples |
|----------|----------|
| **Report** | Clear issues with reproduction steps |
| **Fix** | Bug corrections and filter repairs |
| **Build** | New filters, command support, features |
| **Review** | PR feedback and local testing |
| **Document** | Docs clarification and improvements |

## Scope Guidelines

**In Scope**: Text-heavy commands (100+ tokens) compressible 60%+ without information loss—test runners, linters, build tools, VCS operations, package managers.

**Out of Scope**: Interactive TUIs, binary output, trivial commands, non-proxy features.

## TOML vs. Rust Implementation

Choose **TOML filters** for plain text with predictable line structure requiring regex-based filtering. Select **Rust modules** for structured output (JSON), state machine parsing, flag injection, or cross-command routing.

## Branch Naming

Use slash-prefixed conventions:
- `fix/` for patches
- `feat/` for features
- `chore/` for breaking changes

Format: `<prefix>/<scope>-<description>` (e.g., `fix/git-log-filter-drops-merge-commits`)

## Pull Request Process

1. **Branch from `develop`** and follow naming conventions
2. **Keep changes focused** — one feature/fix per PR
3. **Add tests** — mandatory for all changes
4. **Update documentation** — match what changed
5. **Pass pre-commit checks**: `cargo fmt`, `cargo clippy`, `cargo test`
6. **Sign the CLA** — automatic via GitHub comment
7. **Target `develop`** for merging

## Testing Requirements

All modifications require tests following TDD principles:

- **Unit tests**: In-module `#[cfg(test)]` blocks
- **Snapshot tests**: Using `insta` crate
- **Smoke tests**: `scripts/test-all.sh` (69 assertions)
- **Integration tests**: Marked `#[ignore]`

Verify ≥60% token savings and cover edge cases.

## Documentation Updates

Match documentation to code changes:
- New filters: Update ecosystem `README.md`, command list, `CHANGELOG.md`
- Architecture changes: Update `TECHNICAL.md`, `ARCHITECTURE.md`
- Bug fixes: Update `CHANGELOG.md`

Keep examples practical and concise.

## Resources

- [Technical Documentation](docs/contributing/TECHNICAL.md) — Architecture and testing details
- [src/cmds/README.md](src/cmds/README.md) — Adding command filters
- [src/filters/README.md](src/filters/README.md) — TOML filter guidance
- [Issues](../../issues), [Discussions](../../discussions) — Questions and feedback

## CLA

All contributions require signing the Contributor License Agreement, granting rtk-ai and rtk-ai Labs perpetual, worldwide, royalty-free licensing rights under Apache 2.0.
