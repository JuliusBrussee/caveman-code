# RTK - Rust Token Killer: Complete README Overview

## Core Purpose
RTK is a high-performance CLI proxy that dramatically reduces token consumption for LLM interactions. The tool filters and compresses command outputs before they reach your AI assistant's context window, achieving 60-90% token reduction across typical development workflows.

## Key Statistics
In a typical 30-minute Claude Code session, RTK delivers substantial savings:
- Directory operations (ls/tree): 80% reduction
- File reading (cat): 70% reduction  
- Search operations (grep/rg): 80% reduction
- Git commands: 75-92% reduction
- Test runners (cargo, npm, pytest): 90% reduction
- **Overall: ~80% token savings** on medium-sized projects

## Installation Methods
Users can install via Homebrew (recommended), curl script, Cargo, or pre-built binaries for macOS, Linux, and Windows.

## How It Works
Four optimization strategies apply per command:
1. **Smart Filtering** removes noise and boilerplate
2. **Grouping** aggregates similar items
3. **Truncation** preserves relevant context
4. **Deduplication** collapses repeated lines with counts

## AI Tool Support
RTK integrates with 10 coding assistants including Claude Code, GitHub Copilot, Cursor, Gemini CLI, Codex, Windsurf, Cline, OpenCode, OpenClaw, and planned Mistral Vibe support.

## Command Coverage
The tool supports 100+ commands across:
- File operations (ls, read, find, grep, diff)
- Git workflows (status, log, diff, commit, push, pull)
- Test runners (cargo, npm, pytest, go, playwright)
- Build tools (TypeScript, ESLint, Prettier, cargo clippy)
- Package managers (pnpm, pip, bundle)
- Cloud platforms (AWS)
- Containers (Docker, kubectl)
- Data utilities (JSON, logs, curl)

## Auto-Rewrite Hook
The most effective usage pattern transparently intercepts Bash commands and rewrites them to RTK equivalents before execution, ensuring 100% adoption with zero token overhead.

## Privacy
RTK collects anonymous, aggregate usage metrics daily (enabled by default). "Device hash (salted SHA-256 — per-user random salt stored locally, not reversible)" represents the data collection approach. Users can disable telemetry via environment variable or configuration file.

## Project Details
- **License:** MIT
- **Repository:** github.com/rtk-ai/rtk
- **Community:** Discord server available
- **Documentation:** Troubleshooting, architecture, security, and audit guides included
