# Findings Board: Caveman CLI Product Direction & Feature Research

> Shared coordination state for research agents.
> Later agents read this before searching to avoid duplicates and build on earlier work.

## Codebase Findings

### Architecture
- Monorepo (10 packages), fork of badlogic/pi-mono, CLI entry: `cave`/`pi`
- Build: tsgo 7.0.0-dev (pre-release risk), Biome 2.3.5, Bun 1.2.20 for binaries
- Extensions: jiti-loaded TypeScript with ExtensionAPI, NO MCP by design
- Config: .cave/ dir, AGENTS.md/CLAUDE.md tree walk, deep-merge settings
- Distribution: npm @cavepi/ + Bun binaries (5 platforms), no Homebrew
- NOT a Claude Code extension — standalone CLI. CaveKit CC plugin is separate.

### Patterns & Dependencies
- TypeScript strict ESM, no `any`, no inline imports, configurable keybindings
- Cave mode: 3-layer (prompt injection + tool output compression + optional RTK)
- CaveKit: 4-phase DABI lifecycle, markdown kits, build site DAG, wave executor
- Key deps: Anthropic/OpenAI/Google/Mistral SDKs, TypeBox, jiti, proper-lockfile

### Tests & UI
- ~150 test files, ~28K lines, Vitest + Node built-in runner, no coverage tools
- 35 interactive components, 12 TUI primitives, Lit web components (untested)
- No token savings benchmarks in-repo, claims from external sources
- Visual theme overhaul specified but unimplemented

### Distribution & Viral
- /share disabled (no domain), /export HTML works
- Cave mode = primary viral differentiator (runs cheaper)
- Package gallery still at upstream domain
- No /cave toggle command, upstream logo in README
- 50+ example extensions, full skill/package ecosystem

## Web Findings

### Library Landscape
- Claude Code: 9K+ extensions, find-skills = 661K installs (discoverability is king)
- Competitors: Cursor, Windsurf, Aider (43K stars), Continue (32K), Copilot (20M users)
- LLMLingua: 20x compression, 1.5% perf loss; RTK: 21.8K stars, 80% reduction
- TUI: Ink (37.5K stars, used by Claude Code/Codex/Copilot CLI)
- SDD: Thoughtworks key 2025 practice, Kiro/Spec-Kit/Tessl tools

### Best Practices
- Hooks: 4 types, 30+ events, PreToolUse can rewrite inputs, agent-type most powerful
- Security: CVE for hooks RCE — quote paths, validate inputs
- Viral: HN Show HN #1 channel, quantified claims drive sharing, zero-config principle
- Tokens: output 4-6x more expensive, prompt caching 90% savings, lazy tool discovery
- Instruction fade-out real in long sessions, needs event-triggered reminders
- SDD spec adherence unsolved — hook-layer enforcement is unique opportunity
- Gamification: streaks, leaderboards, quantified savings displays
