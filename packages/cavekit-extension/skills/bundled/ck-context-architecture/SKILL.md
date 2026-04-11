---
name: ck-context-architecture
description: Keep agent context focused on design constraints and task-relevant material.
---

# CaveKit Context Architecture

Structure the agent's context window deliberately so the most important information is always in scope and low-value content is excluded.

## Principles

- Load only the files relevant to the current build task
- Keep DESIGN.md injected at the start of every agent turn via the `before_agent_start` hook
- Use hierarchical summaries for large codebases — detail on demand
- Rotate context aggressively during long sessions to avoid stale information polluting reasoning
