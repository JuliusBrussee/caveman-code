# Speculative-Pipeline Strategy

**Speculative-pipeline** is a technique for accelerating multi-stage workflows by overlapping execution rather than running stages sequentially.

## Core Concept

Instead of waiting for one stage to finish before starting the next, followers begin after a configurable delay and work from whatever partial output the leader has produced. The key mechanism is **convergence loops**—iterative refinement that re-reads upstream artifacts on each pass, allowing early errors to self-correct as upstream work stabilizes.

The strategy can reduce a 12-hour sequential 3-stage pipeline to approximately 7 hours.

## How It Works

As described in the documentation: "Start downstream work early with partial upstream output. Convergence loops correct the errors introduced by working from incomplete input."

**Practical example timeline:**
- Stage 1 (Specs): Starts immediately, 5 hours
- Stage 2 (Plans): Starts after 1.5-hour delay, reads partial specs, refines through iterations
- Stage 3 (Implement): Starts after 3-hour delay, works from draft specs and plans

By the time Stage 1 finishes, Stages 2 and 3 are already well underway, dramatically compressing total runtime.

## When to Use

**Best suited for:**
- Long pipelines (3+ stages)
- Stages sharing a git repository (followers auto-read commits)
- Work with strong convergence loops
- Specs stabilizing after 1-2 iterations

**Avoid if:**
- Stages have hard dependencies requiring complete upstream output
- No iteration/refinement mechanism exists
- Pipeline is very short (<1 hour per stage)

The approach trades early accuracy for parallelism, relying on iterative correction to reach quality.
