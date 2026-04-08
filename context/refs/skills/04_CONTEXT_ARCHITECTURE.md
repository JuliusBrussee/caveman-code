# Context Architecture: DAG-Based Progressive Disclosure

This document outlines a sophisticated system for organizing project knowledge so AI agents read only what they need.

## Core Concept

The architecture uses a **directed acyclic graph (DAG)** where index files serve as hub nodes. Rather than loading entire documentation trees, agents enter at the root, identify relevant paths, and traverse only necessary branches—keeping context windows lean and focused.

## The Four-Tier Information Flow

The system organizes information hierarchically:

- **Tier 1 (refs/)**: Source material—raw inputs, specifications, read-only reference
- **Tier 2 (kits/)**: Requirements and capabilities—what must be built
- **Tier 3 (plans/)**: Implementation strategy—how to build it, organized as task graphs
- **Tier 4 (impl/)**: Execution records—what was completed, findings, dead ends

Each tier consumes outputs from the previous level, creating natural dependencies.

## Progressive Disclosure in Practice

Agents navigate via a simple protocol:

1. Start at root `CLAUDE.md`
2. Jump to the relevant tier's index file
3. Scan the index table to find applicable domains
4. Load only those domain files
5. Follow cross-references only when necessary

As the document explains: *"An agent reads the index, identifies relevant edges, and follows only those to leaf documents."*

## The CLAUDE.md Hierarchy

These special files extend through both the `context/` directory and source code tree, creating bridges:

- `context/CLAUDE.md` — describes the overall 4-tier structure
- `context/kits/CLAUDE.md` — Tier 2 conventions
- `src/auth/CLAUDE.md` — *"implements cavekit-auth.md R1-R3"*

This bidirectional linkage enables tracing bugs back to specifications and propagating requirement changes forward through implementation.

## Key Design Principles

- **Minimal CLAUDE.md files** — 3-10 lines; reference, don't duplicate
- **Index files as hubs** — domain tables guide agents to what matters
- **Nesting by cohesion** — decompose only when independent concerns warrant separate sections
- **Idempotent bootstrapping** — `/ck:init` safely establishes the full structure

The architecture treats progressive disclosure as a navigation problem, not a storage problem—fundamentally changing how agents interact with documentation at scale.
