# Raw Findings: Codebase Tests & UI

Key findings:
- Tests: Vitest (coding-agent, ai), Node built-in (tui), ~150 test files, ~28K lines of test code
- No coverage tooling configured, no token savings benchmarks
- CI: GitHub Actions on push/PR, requires system deps (cairo, pango), runs without API keys
- PR-gate: auto-closes unapproved contributors, OSS weekend gate
- TUI: 12 terminal primitives (box, editor, image, input, markdown, select-list, etc.)
- Interactive: 35 components including ActionBar (mode hints), Footer (token stats), ToolExecution (rich rendering)
- Easter eggs: ArminComponent (382-line animated XBM art), DaxnutsComponent (tribute pixel art)
- Web-UI: Lit web components for chat interface, zero tests
- No .pen files, no Figma/Pencil design files
- Theme: JSON-based with 30+ semantic color slots, hot-reloadable
- Visual theme overhaul (navy/cyan/amber) specified in kit but unimplemented
- Cave mode settings undocumented in docs/settings.md
- Token savings claims from external sources, no in-repo benchmarks
