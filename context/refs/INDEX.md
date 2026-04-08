# CaveKit Reference Material Index

This directory contains comprehensive reference material from the CaveKit repository, organized for quick lookup and understanding of the specification-driven AI development methodology.

## Quick Navigation

**New to CaveKit?** Start with `/README.md` for an overview, then read the skills in order:
1. Methodology
2. Validation-First Design
3. Context Architecture
4. Prompt Pipeline

**Looking for specific patterns?** See the references directory.

**Understanding how Cavekit works?** See the skills directory for deep dives into each capability.

---

## Directory Structure

### `/` - Main Files
- **README.md** - CaveKit overview and philosophy
- **PLUGIN_INFO.md** - Plugin configuration and CLI commands
- **INDEX.md** - This file

### `/skills/` - 16 Core Capabilities

Each skill is a comprehensive guide to a specific aspect of the methodology:

1. **01_METHODOLOGY.md** - Core Cavekit approach and Hunt lifecycle
2. **02_VALIDATION_FIRST.md** - Six validation gates and testing strategy
3. **03_DESIGN_SYSTEM.md** - DESIGN.md format and visual specifications
4. **04_CONTEXT_ARCHITECTURE.md** - DAG-based information organization
5. **05_PEER_REVIEW.md** - Systematic code review with second AI agent
6. **06_PROMPT_PIPELINE.md** - Designing Hunt phase prompts
7. **07_CONVERGENCE_MONITORING.md** - Detecting when iteration is complete
8. **08_REVISION.md** - Tracing bugs back to specifications
9. **09_DOCUMENTATION_INVERSION.md** - Machine-readable documentation patterns
10. **10_IMPL_TRACKING.md** - Cross-session memory systems
11. **11_BROWNFIELD_ADOPTION.md** - Applying Cavekit to existing codebases
12. **12_SPECULATIVE_PIPELINE.md** - Parallel multi-stage workflows
13. **13_PEER_REVIEW_LOOP.md** - Claude + Codex dual-model validation
14. **14_UI_CRAFT.md** - Interface implementation standards
15. **15_CAVEKIT_WRITING.md** - Writing effective specifications
16. **16_CAVEMAN.md** - Ultra-compressed communication mode

### `/references/` - 9 Foundational Patterns

Reference documents covering the systematic patterns underlying Cavekit:

1. **01_HUNT_PHASES.md** - Four-phase development lifecycle
2. **02_PROMPT_ENGINEERING.md** - Best practices for AI agent prompts
3. **03_AGENT_TEAM_PATTERNS.md** - Multi-agent coordination and delegation
4. **04_VALIDATION_GATES.md** - Six-gate quality assurance pipeline
5. **05_CONVERGENCE_PATTERNS.md** - Recognizing completion signals
6. **06_GIT_AS_MEMORY.md** - Using version control for cross-session context
7. **07_MULTI_REPO_STRATEGY.md** - Managing specifications across frameworks
8. **08_SESSION_FEEDBACK_PROTOCOL.md** - Handoff mechanism between sessions
9. **09_SECURITY.md** - Vulnerability disclosure policy

### `/impl/` - Implementation Examples
(Empty - reserved for implementation guides)

### `/kits/` - Specification Examples
(Empty - reserved for requirement examples)

### `/plans/` - Plan Examples
(Empty - reserved for build plan examples)

---

## Key Concepts Glossary

**Cavekit** - Specification-driven AI development methodology where kits (requirements) drive code generation rather than the reverse.

**Kits** - Implementation-agnostic requirement documents that serve as the source of truth, containing numbered requirements with testable acceptance criteria.

**Plans** - Framework-specific implementation strategies derived from kits, organized as task graphs with dependencies.

**Hunt Lifecycle** - Four-phase process: Draft (extract requirements), Architect (design solution), Build (generate code), Inspect (validate and revise).

**Validation Gates** - Six sequential checkpoints: Compilation, Unit Verification, Integration, Benchmarks, Smoke Tests, Manual Audit.

**Convergence** - Point at which agent output stabilizes with minimal changes per iteration, indicating work is complete.

**Context Architecture** - DAG-based system organizing project knowledge into progressive disclosure tiers (refs, kits, plans, impl).

**Documentation Inversion** - Embedding machine-readable guidance (CLAUDE.md) directly in codebases rather than maintaining separate wikis.

**Peer Review Loop** - Dual-model validation using Claude for building and Codex for adversarial review.

---

## Quick Reference: Commands

From the plugin (accessible via Claude Code):
- `/ck:sketch` - Draft phase (create kits from requirements)
- `/ck:map` - Architect phase (create plans from kits)
- `/ck:make` - Build phase (generate code with validation)
- `/ck:check` - Inspect phase (verify against specs)
- `/ck:progress` - Monitor build status
- `/ck:help` - Display help

---

## How to Use This Reference

1. **For project setup:** Read Methodology, then Context Architecture
2. **For specification writing:** Read Validation-First and Cavekit Writing
3. **For building:** Read Prompt Pipeline and Convergence Monitoring
4. **For reviews:** Read Peer Review and Peer Review Loop
5. **For troubleshooting:** Check Revision and Convergence Patterns
6. **For team coordination:** Read Agent Team Patterns

---

## Repository Info

**Source:** https://github.com/JuliusBrussee/cavekit  
**Plugin Version:** 2.0.0  
**Installation:** `git clone https://github.com/JuliusBrussee/cavekit.git ~/.cavekit && cd ~/.cavekit && ./install.sh`

This reference was retrieved from the main branch of the CaveKit repository.
