---
name: ck-methodology
description: Core CaveKit spec-driven workflow covering Draft, Architect, Build, and Inspect.
---

# CaveKit Core Methodology

CaveKit is a Specification-Driven Development (SDD) lifecycle for AI coding agents. It structures work into four sequential phases: **Draft** (write the spec), **Architect** (design the solution), **Build** (parallel implementation), and **Inspect** (validate against acceptance criteria).

## Key Principles

- Specs are written before any code is produced
- Acceptance criteria (ACs) are explicit and machine-checkable
- Build tasks are decomposed into parallel waves to maximize throughput
- Convergence is monitored continuously to detect and break plateaus
- Every session ends with an Inspect pass before declaring done
