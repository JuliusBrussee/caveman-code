# Convergence Monitoring

This document explains when to stop iterating on AI agent development—the answer is **convergence**, not a fixed iteration count.

## Core Concept

**Convergence** means agent output stabilizes with each iteration producing fewer, smaller changes. The goal isn't a zero-diff; it's reaching a point where "remaining modifications are inconsequential."

## Main Signals

**Healthy convergence shows:**
- Lines changed decreasing exponentially per iteration
- Changes becoming cosmetic (formatting, comments)
- Test pass rates approaching 100%
- No new files created
- Implementation tracking updates shrinking

## Critical Distinction: Ceiling vs. Convergence

Both produce small diffs, but differ fundamentally:

| Aspect | Convergence | Ceiling |
|--------|------------|---------|
| Status | Work is done | Agent stuck |
| Test trend | Pass rate climbing | Pass rate plateaued |
| Agent behavior | Wrapping up | Retrying same strategies |

**Diagnosis**: Check if tests pass and improve (convergence) or if the agent is retrying failed approaches despite small changes (ceiling).

## Non-Convergence Recovery

When changes remain flat or oscillate without decreasing:
1. Stop iterating (more passes won't help)
2. Diagnose root cause (fuzzy specs, weak validation, file conflicts, scope creep, missing dependencies)
3. Fix upstream issues
4. Resume the loop

**Key principle**: "Running more iterations when the system is not converging wastes time and compute."
