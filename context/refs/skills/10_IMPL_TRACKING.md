# Implementation Tracking: A Living Memory System

Implementation tracking documents serve as persistent cross-session memory that prevents duplicate work and preserves knowledge about failed approaches. The core principle is simple: **"Track everything, especially failures."**

## Why This Matters

Without tracking, each agent session restarts from scratch. With it, teams avoid the expensive cycle of rediscovering what doesn't work. The most valuable entries are dead ends—documented failures that answer the question "why shouldn't we try this again?"

## Key Components

**Task Status Table** — Shows what's done, in progress, blocked, or not started. Dependencies clarify what must complete before other work can begin.

**Dead Ends Documentation** — The critical section. Each failed approach must include: what was attempted, the root cause of failure, and what to do instead. This format prevents agents from wasting hours retrying the same approaches across sessions.

**Test Health Snapshot** — Current pass/fail counts and coverage metrics help agents understand system stability at a glance.

**File Manifest** — Complete record of created and modified files, cross-referenced to specification requirements.

## The Handoff Cycle

Each session follows a read-work-update pattern:

1. Read the tracking document for context
2. Identify highest-priority unblocked work
3. Check dead ends to avoid past failures
4. Implement and validate
5. Update all tracking sections before ending

This eliminates the discovery tax that normally begins each session.

## Keeping Documents Manageable

When tracking files exceed ~500 lines, compress them by archiving completed tasks while preserving active work, blocked items, recent dead ends, and the complete file manifest. Never delete information—always archive first.

For structured handoffs between sessions, use the inter-session feedback protocol: XML-formatted reports that describe task status, obstacles, and next steps for the incoming agent.

Implementation tracking transforms institutional knowledge from ephemeral to persistent, compounding team effectiveness across iterations.
