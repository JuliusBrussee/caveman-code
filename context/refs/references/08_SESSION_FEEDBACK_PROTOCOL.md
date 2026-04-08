# Session Feedback Protocol

This reference defines how AI agents communicate progress across stateless sessions using two key components:

## Core Components

**Session Feedback XML** reports what happened in a session, with each work item tracked by:
- Status: DONE, PARTIAL, or BLOCKED
- File modifications: true/false
- Summary of accomplishments
- Obstacles and their type (NONE, TEMPORARY, PERMANENT)
- Next-steps guidance

**Work Queue Handoff** (`plan-next-session.md`) provides the next session with prioritized work items, including category, size estimate, priority level, and specific acceptance criteria.

## Key Distinctions

The protocol defines three obstacle types:
- **TEMPORARY**: Expected to resolve autonomously (pending API docs, unreleased dependencies)
- **PERMANENT**: Requires human intervention (architecture decisions, security review, DBA approval)
- **NONE**: Work completed without blockers

## Practical Value

As the overview notes: "Together, they let the next session start producing immediately — no ramp-up time spent figuring out what to work on."

The protocol eliminates discovery overhead by providing explicit continuity across sessions, making it particularly valuable for multi-session projects and iteration loops that involve both human and agent participation.
