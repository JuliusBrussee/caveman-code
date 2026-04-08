# Caveman

Caveman is a Claude Code skill/plugin that reduces token usage by having Claude communicate in minimal, efficient language while preserving technical accuracy.

## Key Features

**Token Savings:**
- Output tokens: ~65% reduction across tasks (range 22-87%)
- Memory file compression: ~45% input token savings
- Benchmarks show average savings of 1,214 → 294 tokens per task

**Usage:**
Install via `npx skills add JuliusBrussee/caveman` and trigger with `/caveman`, "talk like caveman," or "less tokens please."

**Intensity Levels:**
Three modes let users control verbosity:
- Lite: "Drop filler, keep grammar"
- Full: "Default caveman. Drop articles, fragments, full grunt"
- Ultra: "Maximum compression. Telegraphic"

## What It Preserves

Code blocks, technical terminology, error messages, and Git commits remain normal. Only explanatory text gets compressed—articles, pleasantries, and hedging language are eliminated.

## Caveman Compress

A companion tool compresses memory files (like `CLAUDE.md`) that load each session, reducing input tokens without losing the original human-readable version.

## Research Backing

The creators reference a March 2026 paper showing that "constraining large models to brief responses improved accuracy by 26 percentage points" on certain benchmarks, suggesting brevity can enhance rather than diminish performance.
