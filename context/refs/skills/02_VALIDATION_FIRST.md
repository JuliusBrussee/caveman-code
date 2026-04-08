# Validation-First Design

This document establishes a systematic approach to AI agent output quality through six ordered validation gates.

## Core Concept

"If an agent cannot validate it, it will not be met" — every specification requirement must include testable acceptance criteria that automated systems can verify.

## The Six Validation Gates

The gates progress from cheapest to most expensive:

1. **Compilation** — Code builds without errors (seconds)
2. **Unit Verification** — Individual functions behave correctly (seconds-minutes)
3. **Integration** — Components work together properly (minutes)
4. **Benchmarks** — Performance meets defined thresholds (minutes)
5. **Smoke Test** — Application launches and responds (seconds)
6. **Manual Audit** — Human reviews for design intent and quality (variable)

## Key Principles

- **Gate cascade:** Run gates in order; fix failures at each level before proceeding
- **Requirement mapping:** Each spec requirement must map to at least one gate, or it remains unvalidated
- **Phase gates:** Mandatory checkpoints between Hunt phases ensure solid foundations before proceeding
- **Merge protocol:** When integrating multiple agent branches, merge and validate one at a time to pinpoint failures
- **Completion signals:** Agents emit specific strings when all exit criteria are met, enabling automation detection

## Integration Point

Validation-first design extends the existing `superpowers:verification-before-completion` skill with SDD's specific 6-gate pipeline and phase gate enforcement system.
