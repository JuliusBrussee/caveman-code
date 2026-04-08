# Hunt Phases Reference

The Cavekit Hunt is a four-phase lifecycle for AI-assisted development:

## The Four Phases

1. **Draft (S)** — Transform requirements into implementation-agnostic kits defining WHAT to build
2. **Architect (M)** — Create framework-specific plans defining HOW to implement
3. **Build (M)** — Generate working code, tests, and tracking documentation
4. **Inspect (C)** — Validate outcomes, trace failures back to kits, and steer revisions

## Core Principle

"Specify before building — never jump from raw requirements directly to implementation." Kits serve as the bridge between intent and code.

## Key Roles

**The Human:** Auditor and decision-maker who reviews kits, validates architecture, monitors execution, and triggers revisions—but does NOT write code.

**The AI Agent:** Extracts requirements, architects solutions, implements features, generates tests, and performs root-cause analysis on failures.

## Critical Insight

When a bug surfaces, the correct fix is to update the cavekit to capture the missing requirement, then allow the execution loop to reproduce the fix autonomously. Code-only patches indicate gaps in kit documentation.

## When to Use

- **Full Hunt:** Multi-module projects, shifting requirements, brownfield systems, production code
- **Lightweight:** Focused non-trivial tasks (skip full phases)
- **Skip Cavekit:** Small, self-contained tasks (~5 files)

The methodology emphasizes **traceability**—every piece of code traces back to a cavekit requirement with testable acceptance criteria.
