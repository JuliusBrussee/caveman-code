# Convergence Patterns Reference

This guide explains how to recognize when an iterative AI workflow is approaching completion versus hitting an obstacle.

## Key Concepts

**Convergence** occurs when an agent's output stabilizes with negligible changes per iteration. The goal isn't a perfect zero-diff but rather "modifications shrinking in both volume and significance."

**Ceiling** describes stagnation—the agent repeats the same failed approach without progress, indicating external blockers rather than completion.

## Primary Signals

The most reliable convergence indicator is **test pass rate**, since it's objective and quantifiable. Track alongside:
- Change volume per iteration (should decline exponentially)
- Task completion status from implementation tracking
- Overall forward progress as percentage of requirements with passing criteria

## Root Causes of Non-Convergence

When changes don't decrease iteration-over-iteration, examine:
1. **Ambiguous specifications** — requirements open to multiple interpretations
2. **Insufficient validation** — weak tests that can't distinguish progress
3. **Conflicting agents** — competing changes that undo each other
4. **Missing dependencies** — unavailable tools, services, or packages

The critical insight: "adding more iterations won't help — the problem is in the kits, validation, or coordination."

## Practical Thresholds

Enter the convergence zone when diffs drop below roughly 15-20 lines per iteration with superficial changes only. For larger projects, establish iteration limits based on scope, then diagnose root causes if convergence isn't achieved.
