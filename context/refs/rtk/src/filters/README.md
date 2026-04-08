# Built-in Filters README

This document describes the filter system for the Claude Code CLI, which reduces noise in command output through pattern-based filtering.

## Core Purpose

Filters eliminate irrelevant lines from command output while preserving its authentic appearance. They work best with "predictable, line-by-line text output" where regex filtering achieves significant reduction.

## Ideal Use Cases

TOML filters excel at cleaning:
- Installation logs (removing redundant status messages)
- System monitoring output (keeping relevant data, dropping decorations)
- Linter results (preserving findings while stripping context)
- Infrastructure tool output (removing progress indicators, keeping summaries)

## Implementation Workflow

To add a new filter:

1. **Create** a new `.toml` file using an existing filter as a template
2. **Configure** the three mandatory fields: description, match_command pattern, and at least one action
3. **Test** by adding `[[tests.name]]` entries
4. **Validate** with `cargo test`

## Configuration Fields

Essential field: `match_command` (regex against full command string)

Optional processing fields include:
- `strip_ansi`: Remove escape codes first
- `strip_lines_matching`: Drop lines by regex pattern
- `keep_lines_matching`: Retain only matching lines
- `replace`: Apply regex substitutions
- `match_output`: Short-circuit with custom messages
- `truncate_lines_at`: Limit line length
- `max_lines` / `tail_lines`: Control output length
- `on_empty`: Fallback for filtered-empty results

## File Naming

Use the command name as the filename (e.g., `terraform-plan.toml`). For subcommands, follow the format `<cmd>-<subcommand>.toml` rather than combining multiple filters.

For complete contribution requirements, consult the project's CONTRIBUTING.md and technical documentation.
