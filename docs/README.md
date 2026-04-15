# Cave Docs

This directory holds the source for Cave's user-facing documentation.

## Sections

- **routing** — plan/edit/explore/verify role model + CLI flags
- **caching** — layered cache policy, retention, breakpoints
- **caps** — per-turn and per-session cost caps
- **sandbox** — macOS Seatbelt, Linux Landlock, Windows permissive
- **mcp** — MCP client + `cave mcp serve` server mode + ACP
- **replay** — `cave replay <rollout>` with `--apply` gate
- **benchmarks** — SWE-bench Verified harness + nightly CI
- **paper** — link to `research/paper/`
- **extensions** — the skills/subagents/hooks trinity (`extensions-trinity.md`)

## Building

The docs site is a Starlight build. `npm run docs:build` produces static
HTML. Deploy workflow is triggered on tag push.
