# Validation Gates Reference

This document outlines Cavekit's 6-gate validation pipeline—a structured approach ensuring every requirement is automatically testable before implementation.

## Core Principle

The foundation is straightforward: *"If an agent cannot automatically validate a requirement, that requirement will not be met."* This means validation isn't bolted on afterward; it's designed in from the start.

## The 6 Gates

1. **Compilation Check** – Project builds without errors
2. **Isolated Unit Verification** – Individual components function correctly
3. **Cross-Component Integration** – Parts work together properly
4. **Resource and Speed Benchmarks** – Performance targets are met
5. **Startup Smoke Test** – Application launches and responds
6. **Manual Audit** – Human reviews work quality and provides direction

Gates run sequentially and block downstream progress on failure.

## Key Practices

**Sequential execution matters.** A failure at Gate 1 renders later results meaningless. Always fix the earliest failing gate and restart the pipeline.

**Merge discipline.** When multiple contributors work together, integrate one teammate's changes at a time, running all gates between merges. This isolates integration problems.

**Validation coverage.** Map each cavekit requirement to at least one gate. Unmapped requirements are effectively unvalidated and unlikely to succeed.

**Human as steward.** Gate 6 isn't automation—it's where humans review architecture, catch edge cases, and steer iterations without implementing themselves.

The validation-first approach transforms abstract requirements into concrete, verifiable acceptance criteria, making implementation traceable and failures debuggable.
