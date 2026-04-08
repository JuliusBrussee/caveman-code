# Prompt Pipeline Design

This guide outlines how to architect numbered prompt sequences that drive the Hunt lifecycle phases in Cavekit—a systematic design and development framework.

## Core Architecture

**Three-Prompt Greenfield Pattern** (new projects from reference materials):
1. Generate specs from references
2. Generate plans from specs
3. Generate implementation from plans

**Six-Prompt Rewrite Pattern** (legacy code reverse-engineering):
- Adds reference extraction, spec validation, and back-propagation phases

## Key Design Principles

The documentation emphasizes that "Prompts should be as lightweight and systemic as possible. They define the *process*, not the *content*" — specs and plans hold content details.

Each prompt declares explicit inputs/outputs, uses git history for continuity, includes verifiable completion markers, and supports bidirectional flows where implementation learnings feed back into plans.

## Prompt Engineering Standards

**Runtime variables** (`{FRAMEWORK}`, `{BUILD_COMMAND}`) make prompts reusable across projects. **Agent team structures** use ASCII trees with file ownership tables to prevent merge conflicts. **Time guards** (10 min mechanical, 20 min investigation) prevent wasteful iteration.

Every prompt concludes with exit criteria and completion signals (`<all-tasks-complete>`), enabling the iteration loop to detect convergence automatically.
