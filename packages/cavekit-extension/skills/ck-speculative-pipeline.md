# CaveKit Speculative Pipeline

Run multiple implementation strategies in parallel (speculatively) and select the best result, rather than committing to one approach upfront.

## When to Use

- High-uncertainty tasks where the right approach is not obvious
- Performance-sensitive code where multiple algorithms should be benchmarked
- UI components where aesthetic judgment requires seeing options side by side

## Process

1. Architect defines N candidate strategies
2. Build agents implement each strategy independently in separate branches
3. Inspect agent evaluates all branches against shared ACs
4. Best-passing branch is merged; others are discarded with a rationale note
