# Raw Findings: Codebase Architecture

Agent output from codebase architecture exploration. See findings-board.md for consolidated view.

Key findings:
- Monorepo with 10 packages, fork of badlogic/pi-mono renamed to Cave Pi
- Binary: `cave` and `pi` aliases, both point to same compiled entry
- Build: tsgo (native TypeScript compiler preview 7.0.0-dev), Biome 2.3.5, Bun 1.2.20 for binaries
- Extensions: jiti-loaded TypeScript, NO MCP by design, ExtensionAPI factory pattern
- Config: .cave/ dir, AGENTS.md/CLAUDE.md discovery walking up tree, deep-merge settings
- Distribution: npm @cavepi/ scope + Bun binaries via GitHub Releases (5 platforms)
- Cave mode: 3-layer compression (system prompt + tool output + optional RTK)
- This is NOT a Claude Code extension — it's a standalone CLI. CaveKit plugin for Claude Code is separate artifact.
- Concerns: tsgo pre-release risk, incomplete rebrand (.pi/.cave duplication), version skew
