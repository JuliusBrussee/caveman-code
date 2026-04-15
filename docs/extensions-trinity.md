# Cave Extensions: the Skills / Subagents / Hooks Trinity

T-022 / cavekit-sandbox-mcp R8.

Cave exposes three in-process extension surfaces. Together they are the
authoritative way to extend the agent — no new plugin API is introduced.

## Skills

User-authored markdown files loaded from `~/.cave/skills/` and repo-local
`.cave/skills/`. The agent picks a matching skill based on user prompts,
then the skill's content becomes system-prompt-tier context for the turn.

- No code required
- Ships as plain markdown with YAML frontmatter
- Declared capabilities: `name`, `description`, and optional triggers

## Subagents

TypeScript-defined agents that run in an isolated context window with
their own tool allowlist. Loaded from `~/.cave/subagents/` or
`.cave/subagents/`. Parent sessions delegate tasks to a subagent via the
`subagent_type` tool argument.

- Runs with forced caveman compression on parent's budget (T-122, T-123)
- Returns a ≤500-token structured summary to the parent (T-124)
- Full transcripts persist to `~/.cave/sessions/<id>.trace.jsonl` (T-125)

## Hooks

Shell commands triggered by lifecycle events declared in
`~/.cave/settings.json`. Events include `SessionStart`,
`UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`.

- Output feeds the model as a system reminder
- Blocking hooks gate tool execution

## What is intentionally NOT added

Cave does not expose a generic plugin loader or RPC extension API. The
trinity above covers all extension use cases. If you need more than
skills/subagents/hooks can provide, upstream a PR or fork.

This constraint keeps the surface area auditable for sandboxing
(cavekit-sandbox-mcp R1–R4) and keeps the build deterministic.
