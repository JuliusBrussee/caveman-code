# Documentation Inversion

Documentation inversion flips the traditional model by embedding machine-readable guidance directly in codebases rather than maintaining separate wiki systems that decay over time.

## Core Innovation

Instead of code→wiki→humans, the new flow is: code→CLAUDE.md→skills→agents. As the documentation explains: **"Structure documentation for programmatic navigation -- hierarchical, cross-referenced, with explicit entry points."**

## Three-Level Architecture

1. **CLAUDE.md files** — Co-located with code, auto-loaded per directory. Contains purpose, entry points, conventions, and cross-references.

2. **Navigation skills** — Teach agents *how to explore* rather than what currently exists, keeping guidance valid as code evolves.

3. **Plugin packages** — Distributable collections of skills that agents load on demand.

## Why It Works

The approach solves documentation rot through co-location and structure. CLAUDE.md files must be updated alongside code changes during review, and by describing *processes* rather than snapshots, skills remain accurate through refactoring.

**Key principle:** "The agent reads current source code, guided by the skill -- the source is the documentation."

## Machine vs. Human Structure

Agent-first documentation uses labeled sections, tables, and bullet lists with explicit file paths—not narrative prose. It prioritizes entry points over exhaustive inventories and current state over historical context.

This represents a fundamental shift from assuming human readers who browse contextually to serving automated agents requiring hierarchical, programmatic navigation paths.
