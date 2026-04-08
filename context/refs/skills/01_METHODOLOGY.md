# Cavekit Methodology Overview

**Cavekit is a methodology for building software with AI agents that prioritizes specification before implementation.** The core principle is straightforward: "Always define what you want before telling agents how to build it."

## Key Concepts

**Kits as First-Class Citizens**
Kits are structured, human-readable requirement documents that serve as a "living contract" between humans and AI agents. Rather than deriving kits from code, the process inverts: code emerges from well-defined kits. This applies equally to greenfield projects and rewrites of existing systems.

**The Scientific Method Analogy**
Since LLMs are nondeterministic, Cavekit applies scientific rigor—hypotheses (kits), controlled conditions (validation gates), and repeated trials (iteration loops)—to extract reproducible outcomes from probabilistic generation.

## The Hunt Lifecycle

The methodology structures work through five phases:

- **Draft:** Extract requirements into implementation-agnostic kits
- **Architect:** Design framework-specific plans from kits
- **Build:** Generate code with validation gates
- **Inspect:** Identify gaps and revise kits upstream
- **Monitor:** Track convergence and guide next cycles

Each phase has gate conditions before advancing.

## When to Use Cavekit

- **Full:** Projects with 50+ files, evolving requirements, or multi-agent coordination
- **Lightweight:** 5-50 files with focused scope; just write kits and plans
- **Skip:** Single-file tasks or quick fixes that fit one context window

## Core Execution Pattern

The iteration loop is fundamental: run the same prompt repeatedly against the codebase until changes converge. Shrinking diffs across passes signal progress; if diffs don't shrink, the problem is upstream—fix specs and validation, not iteration count.

Human judgment on architecture and kit precision remain irreplaceable; Cavekit amplifies engineering clarity at scale.
