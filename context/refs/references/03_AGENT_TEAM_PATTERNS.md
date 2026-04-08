# Agent Team Patterns Reference

This guide establishes coordination patterns for multi-agent development, enabling parallel work on complex systems that exceed single-context-window limits.

## Core Principles

**Team Structure:** A lead orchestrator (never writing code) delegates to up to 3 teammates per batch, who may each spawn up to 3 sub-agents. This creates a maximum hierarchy of 13 simultaneous agents.

**Key Rule on Lead Behavior:** "The lead operates exclusively as an orchestrator" and explicitly does NOT write code, modify source files, or make implementation decisions unilaterally.

**Concurrency Cap:** Limiting simultaneous teammates to three prevents resource exhaustion, coordination overhead, and merge conflicts.

## Execution Lifecycle

Work flows through distinct phases:
1. **Plan** - Lead identifies and assigns tasks with explicit file ownership
2. **Spawn** - Teammates dispatch via isolated worktrees
3. **Execute** - Parallel implementation within owned files
4. **Complete** - Status reporting
5. **Shutdown** - Context release between batches
6. **Merge** - Sequential integration with build/test validation
7. **Transition** - Planning next batch

## Critical Safeguards

**File Ownership:** Each modifiable file has exactly one owner, eliminating merge conflicts. Non-owners may read freely but cannot modify.

**Merge Protocol:** Process teammates sequentially in dependency order (foundations first), validating with compile and test steps after each integration.

**Shutdown Between Batches:** Required because context becomes stale post-merge, preventing confusion and enabling fresh planning.
