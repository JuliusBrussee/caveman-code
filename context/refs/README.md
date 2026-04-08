# Cavekit: Specification-Driven AI Code Generation

## Overview

Cavekit is a Claude Code plugin that addresses a fundamental problem with AI-assisted coding: agents often "guess" what developers want rather than building from clear specifications.

The tool's core philosophy is elegant: **"why agent guess when agent can know."** It establishes specifications as the source of truth, with code as a derivative artifact.

## How It Works

Cavekit operates through four distinct phases:

**1. Draft (Sketch)** — Transform natural language descriptions into structured domain kits containing numbered requirements and testable acceptance criteria.

**2. Architect (Map)** — Decompose requirements into tasks, map dependencies, and organize work into tiered build stages where Tier 0 has no dependencies, Tier 1 depends only on Tier 0, and so forth.

**3. Build (Make)** — Execute parallel work packets tier-by-tier with continuous validation against specifications. The system iterates automatically until acceptance criteria pass.

**4. Inspect (Check)** — Perform gap analysis comparing implementation against original specifications, with peer review and traceability.

## Key Features

- **Parallel execution** — Multiple independent tasks run concurrently, organized by dependency graph
- **Dual-model review** — Integrates Codex as adversarial reviewer, catching errors single-model self-review misses
- **Validation gates** — Each tier completion triggers review before advancement
- **Traceability** — Every line of code maps back to specific requirements

## Installation & Usage

```
git clone https://github.com/JuliusBrussee/cavekit.git ~/.cavekit
cd ~/.cavekit && ./install.sh
```

Basic workflow:
```
/ck:sketch          # Define requirements
/ck:map            # Create build plan  
/ck:make           # Execute with validation
/ck:check          # Verify against specs
```

The system emphasizes that specifications prevent context loss, enable validation, support parallelism, and facilitate iteration—eliminating the common failures plaguing single-pass AI code generation.

## Plugin Configuration

- Version: 2.0.0
- Name: ck (with deprecated bp alias)
- Marketplace registration required via install.sh

## Repository Structure

- `/skills/` - 16 capability definitions covering methodology, design systems, code architecture, and peer review practices
- `/references/` - 9 comprehensive guides covering patterns, convergence, git workflows, and validation strategies
- `/context/` - Knowledge base structure (kits, plans, impl, refs)
- `/agents/` - 9 agent specifications for specialized roles
- `/commands/` - 20+ command documentation
- `/scripts/` - Automation and integration scripts
- `/internal/` - Go source code for execution engine and CLI
