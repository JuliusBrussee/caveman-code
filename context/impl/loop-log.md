### Iteration 1 — 2026-04-09
- T-001: Process Title, Onboarding Hint, Tmux Warning — DONE. Files: cli.ts, bun/cli.ts, interactive-mode.ts. Build P, Tests P. Next: T-002
- T-002: System Prompt References — DONE. Files: system-prompt.ts. Build P, Tests P. Next: T-003
- T-003: Config URLs — DONE. Files: config.ts. Build P, Tests P. Next: T-004
- T-004: Binary Release Artifact Names — DONE. Files: build-binaries.sh, build-binaries.yml. Build P, Tests P. Next: T-005
- T-005: Test Script Paths — DONE. Files: test.sh. Build P, Tests P. Next: T-006
- T-006: Earendil Announcement Text — DONE. Files: earendil-announcement.ts. Build P, Tests P. Next: T-007
- T-007: Dark Theme Background Palette — DONE. Files: dark.json. Build P, Tests P. Next: T-008
- T-008: Dark Theme Accent + Brand Color — DONE. Files: dark.json, light.json, theme-schema.json. Build P, Tests P. Next: T-009
- T-009: Documentation Link Fixes — DONE. Files: AGENTS.md, 6x package.json, cl.md, pr.md, contribution.yml. Build P, Tests P. Next: T-010

### Iteration 2 — 2026-04-09
- T-010: CLI Args Help Text — DONE. Files: args.ts. Build P, Tests P. Next: T-011
- T-011: Dark Theme Border Colors — DONE. Files: dark.json. Build P, Tests P. Next: T-012
- T-012: Dark Theme Interactive States + Light Theme — DONE. Verified by T-007/T-008 work. No additional changes needed. Next: T-013
- T-013: Root README, Coding Agent README, Contributing — DONE. Files: README.md, packages/coding-agent/README.md, CONTRIBUTING.md. Build P, Tests P. Next: T-014

### Iteration 3 — 2026-04-09
- T-014: ASCII Art Logo — DONE. Files: interactive-mode.ts, theme.ts. Build P, Tests P. Next: T-015
- T-015: Version Display + Keybinding Hints — DONE. Verified existing code meets all ACs. Next: T-016
- T-016: Cave Mode Status Line + Earendil Removal — DONE. Files: interactive-mode.ts. Build P, Tests P. All tasks complete.

### Iteration 4 — 2026-04-09 (RTK Integration)
- T-017: RTK Binary Detection Module — DONE. Files: rtk.ts (new). Build P, Tests P. Next: T-018
- T-018: RTK Integration Settings — DONE. Files: settings-manager.ts. Build P, Tests P. Next: T-019
- T-019: RTK Command Rewrite Function — DONE. Files: rtk.ts. Build P, Tests P. Next: T-020
- T-020: RTK BashSpawnHook Factory — DONE. Files: rtk.ts. Build P, Tests P. Next: T-021
- T-021: Wire RTK Hook into Agent Session — DONE. Files: agent-session.ts. Build P, Tests P. Next: T-022
- T-022: RTK Integration Tests — DONE. Files: rtk.test.ts (new), 17/17 tests pass. Build P, Tests P. All RTK tasks complete.
