# Build Site: CaveKit Extension Implementation
**Generated:** 2026-04-08
**Source:** /Users/julb/Desktop/GitHub/caveman-cli/context/blueprints
**Total Tasks:** 24
**Tiers:** 6
**Coverage:** 167/167 ACs mapped

## Tier 0 — Foundation (no dependencies)

### T-001: Fork Identity & Branding Setup
**Kit Refs:** fork-identity/R1 (AC-1, AC-2, AC-3), fork-identity/R2 (AC-1, AC-2, AC-3), fork-identity/R6 (AC-1, AC-2)
**Dependencies:** none
**Complexity:** M
**Status:** pending

Establish the fork's unique identity by renaming CLI binary from 'pi' to 'caveman', updating package scope to @caveman-cli/*, and preserving MIT license compliance. This foundational task creates the project's distinct branding while maintaining proper attribution to upstream sources.

### T-002: Extension Framework Core
**Kit Refs:** extension-core/R1 (AC-1, AC-2, AC-3, AC-4), extension-core/R8 (AC-1, AC-2, AC-3)
**Dependencies:** none
**Complexity:** L
**Status:** pending

Create the extension entry point that integrates seamlessly with Pi's extension system. Implement proper extension registration, lifecycle management, and ensure backward compatibility with vanilla Pi installations. This provides the foundation for all CaveKit functionality to plug into the host system.

### T-003: Type System & Configuration Foundation
**Kit Refs:** extension-core/R3 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6), fork-identity/R3 (AC-1, AC-2, AC-3)
**Dependencies:** none
**Complexity:** M
**Status:** pending

Define comprehensive TypeScript interfaces for kit specifications, build sites, task definitions, and tier structures. Establish configuration directory structure at ~/.caveman/ with proper file organization for settings, kits, build sites, and logs. This creates the type safety and configuration foundation for all subsequent development.

### T-004: File Parsers (Kit & Build Site)
**Kit Refs:** extension-commands/R12 (AC-1, AC-2, AC-3), extension-commands/R13 (AC-1, AC-2, AC-3)
**Dependencies:** none
**Complexity:** M
**Status:** pending

Implement robust parsers for kit markdown files and build site specifications. Handle requirement extraction, acceptance criteria parsing, dependency analysis, and validation of file formats. These parsers form the critical input/output layer for the entire CaveKit workflow system.

---

## Tier 1 — Core Infrastructure

### T-005: Command Infrastructure & Context Builder
**Kit Refs:** extension-commands/R14 (AC-1, AC-2, AC-3), extension-commands/R16 (AC-1, AC-2, AC-3, AC-4), extension-core/R2 (AC-1, AC-2, AC-3, AC-4)
**Dependencies:** T-002, T-003, T-004
**Complexity:** L
**Status:** pending

Build the scoped context system that provides relevant kits, build sites, and project information to LLM agents. Implement configuration management with hierarchical settings (global, project, session). Create the infrastructure for registering and dispatching slash commands with proper parameter handling and validation.

### T-006: Cave Mode Core System
**Kit Refs:** cave-mode/R1 (AC-1, AC-2, AC-3, AC-4), cave-mode/R6 (AC-1, AC-2)
**Dependencies:** T-002, T-005
**Complexity:** M
**Status:** pending

Implement the system prompt injection mechanism for Cave Mode, providing compressed communication style through skill integration. Build graceful degradation for when caveman skill is unavailable, falling back to standard communication while logging the limitation. This establishes the foundation for token-efficient agent interactions.

### T-007: Skill Management & Bundling
**Kit Refs:** extension-core/R4 (AC-1, AC-2, AC-3), fork-identity/R4 (AC-1, AC-2, AC-3), fork-identity/R5 (AC-1, AC-2, AC-3)
**Dependencies:** T-001, T-005
**Complexity:** S
**Status:** pending

Package and distribute CaveKit skills (caveman, cavekit workflow) with the extension. Implement startup banner display and upstream remote tracking for fork maintenance. This ensures users have immediate access to required skills and proper project identification upon launch.

### T-008: LLM Tool Integration Layer
**Kit Refs:** extension-commands/R20 (AC-1, AC-2), extension-commands/R22 (AC-1, AC-2)
**Dependencies:** T-005, T-006
**Complexity:** S
**Status:** pending

Create LLM-callable tool wrappers with proper subagent binary naming and stderr handling. This layer enables reliable communication between the main agent and CaveKit subprocesses, with robust error handling and logging for debugging failed interactions.

---

## Tier 2 — Basic Commands

### T-009: Draft & Help Commands
**Kit Refs:** extension-commands/R1 (AC-1, AC-2, AC-3, AC-4, AC-5), extension-commands/R11 (AC-1, AC-2)
**Dependencies:** T-004, T-005, T-008
**Complexity:** M
**Status:** pending

Implement /ck:draft command for transforming natural language feature descriptions into structured domain kits. Build comprehensive help system showing available commands, usage patterns, and examples. The draft command serves as the entry point to the CaveKit workflow, establishing requirements from user input.

### T-010: Config & Progress Commands  
**Kit Refs:** extension-commands/R9 (AC-1, AC-2, AC-3), extension-commands/R10 (AC-1, AC-2, AC-3)
**Dependencies:** T-005, T-008
**Complexity:** S
**Status:** pending

Create configuration management command for viewing/editing CaveKit settings and progress tracking command for monitoring build site execution status. These utility commands provide essential user control and visibility into system state and ongoing work.

### T-011: Research & Design Commands
**Kit Refs:** extension-commands/R7 (AC-1, AC-2, AC-3), extension-commands/R8 (AC-1, AC-2, AC-3)
**Dependencies:** T-008, T-009
**Complexity:** S
**Status:** pending

Implement research and design workflow commands that gather context and create architectural plans. These commands extend the basic CaveKit workflow with additional planning and analysis capabilities for complex projects requiring upfront investigation.

### T-012: Cave Mode User Interface
**Kit Refs:** cave-mode/R2 (AC-1, AC-2, AC-3, AC-4, AC-5), cave-mode/R3 (AC-1, AC-2, AC-3)
**Dependencies:** T-006, T-010
**Complexity:** M
**Status:** pending

Build user-facing controls for Cave Mode activation/deactivation with intensity levels and settings integration. Provide toggle commands, status display, and configuration options that give users control over when and how aggressively token compression is applied during interactions.

---

## Tier 3 — Build System Core

### T-013: Architect Command & Dependency Analysis
**Kit Refs:** extension-commands/R2 (AC-1, AC-2, AC-3, AC-4, AC-5)
**Dependencies:** T-004, T-005, T-009
**Complexity:** L
**Status:** pending

Implement /ck:architect command that transforms kit requirements into tiered build sites with dependency-ordered tasks. Perform dependency analysis, generate task hierarchies, and create executable build plans. This command bridges requirements and implementation by creating structured execution roadmaps.

### T-014: Build Command & Execution Engine
**Kit Refs:** extension-commands/R3 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7), extension-commands/R21 (AC-1, AC-2)
**Dependencies:** T-004, T-013, T-008
**Complexity:** L
**Status:** pending

Create the core build execution engine that processes build sites tier-by-tier with parallel task execution. Implement safe staging for build commits, proper file handling, and coordination between multiple concurrent subagents. This is the primary execution mechanism for CaveKit-managed development.

### T-015: Convergence Monitoring & Retry Logic
**Kit Refs:** extension-commands/R5 (AC-1, AC-2, AC-3, AC-4, AC-5), extension-commands/R15 (AC-1, AC-2, AC-3, AC-4), extension-commands/R17 (AC-1, AC-2, AC-3)
**Dependencies:** T-004, T-014
**Complexity:** M
**Status:** pending

Implement convergence detection that identifies when builds are stuck in loops versus making progress toward completion. Build retry mechanisms for failed tasks with intelligent backoff and failure analysis. Create convergence command for manual convergence analysis and reporting.

### T-016: Quality Gates & Tier Review
**Kit Refs:** extension-commands/R4 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7)
**Dependencies:** T-014, T-015
**Complexity:** M
**Status:** pending

Build tier gate review system that validates all acceptance criteria before allowing progression to next tier. Implement automated validation, manual review hooks, and rollback capabilities. This ensures quality control and prevents accumulation of defects across build tiers.

---

## Tier 4 — Advanced Features

### T-017: Inspect Command & Analysis
**Kit Refs:** extension-commands/R6 (AC-1, AC-2, AC-3, AC-4, AC-5)
**Dependencies:** T-004, T-008, T-016
**Complexity:** M
**Status:** pending

Implement comprehensive inspection capabilities for gap analysis between implementation and specifications. Provide traceability reporting, coverage analysis, and compliance verification. This command enables quality assurance and verification that delivered code meets original requirements.

### T-018: Cave Mode Advanced Features
**Kit Refs:** cave-mode/R4 (AC-1, AC-2, AC-3, AC-4), cave-mode/R5 (AC-1, AC-2, AC-3, AC-4, AC-5)
**Dependencies:** T-008, T-012
**Complexity:** M
**Status:** pending

Implement caveman-compressed compaction for memory files and tool result compression for efficient context management. These advanced features significantly reduce token usage during extended development sessions by compressing historical context while preserving essential information.

### T-019: UI Dashboard & Overlays
**Kit Refs:** extension-ui/R1 (AC-1, AC-2, AC-3, AC-4), extension-ui/R2 (AC-1, AC-2, AC-3, AC-4), extension-ui/R3 (AC-1, AC-2, AC-3, AC-4)
**Dependencies:** T-014, T-016
**Complexity:** L
**Status:** pending

Create TUI dashboard widget showing build progress, task status, and tier completion. Implement overlay systems for kit review and tier gate status. These visual components provide real-time feedback and status information directly within the Pi interface.

### T-020: Dependency Visualization
**Kit Refs:** extension-ui/R4 (AC-1, AC-2, AC-3)
**Dependencies:** T-004, T-013
**Complexity:** S
**Status:** pending

Build visual dependency graph rendering for build sites and task relationships. Provide interactive navigation and status visualization for complex project structures. This helps users understand project architecture and track progress through dependency chains.

---

## Tier 5 — Integration & Polish

### T-021: UI Keyboard Shortcuts & Integration
**Kit Refs:** extension-ui/R5 (AC-1, AC-2, AC-3), extension-ui/R6 (AC-1, AC-2)
**Dependencies:** T-019, T-020
**Complexity:** S
**Status:** pending

Implement keyboard shortcuts for common CaveKit operations and integrate kit reviewer functionality with the TUI. Provide efficient navigation and operation of CaveKit features through keyboard-driven interfaces that complement the command-based workflow.

### T-022: Robustness & Error Handling  
**Kit Refs:** extension-commands/R18 (AC-1, AC-2), extension-commands/R19 (AC-1, AC-2)
**Dependencies:** T-004, T-013, T-014
**Complexity:** S
**Status:** pending

Implement format consistency validation between kit parsers and draft commands, and path consistency validation for build site file references. Add comprehensive error handling, validation, and user-friendly error messages throughout the system.

### T-023: Compatibility & Protection Hooks
**Kit Refs:** extension-core/R5 (AC-1, AC-2, AC-3), extension-core/R6 (AC-1, AC-2), extension-core/R7 (AC-1, AC-2, AC-3, AC-4)
**Dependencies:** T-007, T-008, T-018
**Complexity:** S
**Status:** pending

Implement compaction protection hooks to preserve essential files during cleanup, resource discovery hooks for skill and configuration detection, and subagent context injection for enhanced agent coordination. These hooks ensure reliable operation across different Pi configurations.

### T-024: Final Integration & Testing
**Kit Refs:** (Integration task covering edge cases and final validation)
**Dependencies:** T-021, T-022, T-023
**Complexity:** M
**Status:** pending

Perform end-to-end integration testing, validate all acceptance criteria, and ensure seamless operation across different Pi environments. This final task ensures all components work together correctly and the system meets all specified requirements.

---

## Coverage Matrix
| Req | AC | Task |
|-----|----|------|
| cave-mode/R1 | AC-1 | T-006 |
| cave-mode/R1 | AC-2 | T-006 |
| cave-mode/R1 | AC-3 | T-006 |
| cave-mode/R1 | AC-4 | T-006 |
| cave-mode/R2 | AC-1 | T-012 |
| cave-mode/R2 | AC-2 | T-012 |
| cave-mode/R2 | AC-3 | T-012 |
| cave-mode/R2 | AC-4 | T-012 |
| cave-mode/R2 | AC-5 | T-012 |
| cave-mode/R3 | AC-1 | T-012 |
| cave-mode/R3 | AC-2 | T-012 |
| cave-mode/R3 | AC-3 | T-012 |
| cave-mode/R4 | AC-1 | T-018 |
| cave-mode/R4 | AC-2 | T-018 |
| cave-mode/R4 | AC-3 | T-018 |
| cave-mode/R4 | AC-4 | T-018 |
| cave-mode/R5 | AC-1 | T-018 |
| cave-mode/R5 | AC-2 | T-018 |
| cave-mode/R5 | AC-3 | T-018 |
| cave-mode/R5 | AC-4 | T-018 |
| cave-mode/R5 | AC-5 | T-018 |
| cave-mode/R6 | AC-1 | T-006 |
| cave-mode/R6 | AC-2 | T-006 |
| extension-commands/R1 | AC-1 | T-009 |
| extension-commands/R1 | AC-2 | T-009 |
| extension-commands/R1 | AC-3 | T-009 |
| extension-commands/R1 | AC-4 | T-009 |
| extension-commands/R1 | AC-5 | T-009 |
| extension-commands/R2 | AC-1 | T-013 |
| extension-commands/R2 | AC-2 | T-013 |
| extension-commands/R2 | AC-3 | T-013 |
| extension-commands/R2 | AC-4 | T-013 |
| extension-commands/R2 | AC-5 | T-013 |
| extension-commands/R3 | AC-1 | T-014 |
| extension-commands/R3 | AC-2 | T-014 |
| extension-commands/R3 | AC-3 | T-014 |
| extension-commands/R3 | AC-4 | T-014 |
| extension-commands/R3 | AC-5 | T-014 |
| extension-commands/R3 | AC-6 | T-014 |
| extension-commands/R3 | AC-7 | T-014 |
| extension-commands/R4 | AC-1 | T-016 |
| extension-commands/R4 | AC-2 | T-016 |
| extension-commands/R4 | AC-3 | T-016 |
| extension-commands/R4 | AC-4 | T-016 |
| extension-commands/R4 | AC-5 | T-016 |
| extension-commands/R4 | AC-6 | T-016 |
| extension-commands/R4 | AC-7 | T-016 |
| extension-commands/R5 | AC-1 | T-015 |
| extension-commands/R5 | AC-2 | T-015 |
| extension-commands/R5 | AC-3 | T-015 |
| extension-commands/R5 | AC-4 | T-015 |
| extension-commands/R5 | AC-5 | T-015 |
| extension-commands/R6 | AC-1 | T-017 |
| extension-commands/R6 | AC-2 | T-017 |
| extension-commands/R6 | AC-3 | T-017 |
| extension-commands/R6 | AC-4 | T-017 |
| extension-commands/R6 | AC-5 | T-017 |
| extension-commands/R7 | AC-1 | T-011 |
| extension-commands/R7 | AC-2 | T-011 |
| extension-commands/R7 | AC-3 | T-011 |
| extension-commands/R8 | AC-1 | T-011 |
| extension-commands/R8 | AC-2 | T-011 |
| extension-commands/R8 | AC-3 | T-011 |
| extension-commands/R9 | AC-1 | T-010 |
| extension-commands/R9 | AC-2 | T-010 |
| extension-commands/R9 | AC-3 | T-010 |
| extension-commands/R10 | AC-1 | T-010 |
| extension-commands/R10 | AC-2 | T-010 |
| extension-commands/R10 | AC-3 | T-010 |
| extension-commands/R11 | AC-1 | T-009 |
| extension-commands/R11 | AC-2 | T-009 |
| extension-commands/R12 | AC-1 | T-004 |
| extension-commands/R12 | AC-2 | T-004 |
| extension-commands/R12 | AC-3 | T-004 |
| extension-commands/R13 | AC-1 | T-004 |
| extension-commands/R13 | AC-2 | T-004 |
| extension-commands/R13 | AC-3 | T-004 |
| extension-commands/R14 | AC-1 | T-005 |
| extension-commands/R14 | AC-2 | T-005 |
| extension-commands/R14 | AC-3 | T-005 |
| extension-commands/R15 | AC-1 | T-015 |
| extension-commands/R15 | AC-2 | T-015 |
| extension-commands/R15 | AC-3 | T-015 |
| extension-commands/R15 | AC-4 | T-015 |
| extension-commands/R16 | AC-1 | T-005 |
| extension-commands/R16 | AC-2 | T-005 |
| extension-commands/R16 | AC-3 | T-005 |
| extension-commands/R16 | AC-4 | T-005 |
| extension-commands/R17 | AC-1 | T-015 |
| extension-commands/R17 | AC-2 | T-015 |
| extension-commands/R17 | AC-3 | T-015 |
| extension-commands/R18 | AC-1 | T-022 |
| extension-commands/R18 | AC-2 | T-022 |
| extension-commands/R19 | AC-1 | T-022 |
| extension-commands/R19 | AC-2 | T-022 |
| extension-commands/R20 | AC-1 | T-008 |
| extension-commands/R20 | AC-2 | T-008 |
| extension-commands/R21 | AC-1 | T-014 |
| extension-commands/R21 | AC-2 | T-014 |
| extension-commands/R22 | AC-1 | T-008 |
| extension-commands/R22 | AC-2 | T-008 |
| extension-core/R1 | AC-1 | T-002 |
| extension-core/R1 | AC-2 | T-002 |
| extension-core/R1 | AC-3 | T-002 |
| extension-core/R1 | AC-4 | T-002 |
| extension-core/R2 | AC-1 | T-005 |
| extension-core/R2 | AC-2 | T-005 |
| extension-core/R2 | AC-3 | T-005 |
| extension-core/R2 | AC-4 | T-005 |
| extension-core/R3 | AC-1 | T-003 |
| extension-core/R3 | AC-2 | T-003 |
| extension-core/R3 | AC-3 | T-003 |
| extension-core/R3 | AC-4 | T-003 |
| extension-core/R3 | AC-5 | T-003 |
| extension-core/R3 | AC-6 | T-003 |
| extension-core/R4 | AC-1 | T-007 |
| extension-core/R4 | AC-2 | T-007 |
| extension-core/R4 | AC-3 | T-007 |
| extension-core/R5 | AC-1 | T-023 |
| extension-core/R5 | AC-2 | T-023 |
| extension-core/R5 | AC-3 | T-023 |
| extension-core/R6 | AC-1 | T-023 |
| extension-core/R6 | AC-2 | T-023 |
| extension-core/R7 | AC-1 | T-023 |
| extension-core/R7 | AC-2 | T-023 |
| extension-core/R7 | AC-3 | T-023 |
| extension-core/R7 | AC-4 | T-023 |
| extension-core/R8 | AC-1 | T-002 |
| extension-core/R8 | AC-2 | T-002 |
| extension-core/R8 | AC-3 | T-002 |
| extension-ui/R1 | AC-1 | T-019 |
| extension-ui/R1 | AC-2 | T-019 |
| extension-ui/R1 | AC-3 | T-019 |
| extension-ui/R1 | AC-4 | T-019 |
| extension-ui/R2 | AC-1 | T-019 |
| extension-ui/R2 | AC-2 | T-019 |
| extension-ui/R2 | AC-3 | T-019 |
| extension-ui/R2 | AC-4 | T-019 |
| extension-ui/R3 | AC-1 | T-019 |
| extension-ui/R3 | AC-2 | T-019 |
| extension-ui/R3 | AC-3 | T-019 |
| extension-ui/R3 | AC-4 | T-019 |
| extension-ui/R4 | AC-1 | T-020 |
| extension-ui/R4 | AC-2 | T-020 |
| extension-ui/R4 | AC-3 | T-020 |
| extension-ui/R5 | AC-1 | T-021 |
| extension-ui/R5 | AC-2 | T-021 |
| extension-ui/R5 | AC-3 | T-021 |
| extension-ui/R6 | AC-1 | T-021 |
| extension-ui/R6 | AC-2 | T-021 |
| fork-identity/R1 | AC-1 | T-001 |
| fork-identity/R1 | AC-2 | T-001 |
| fork-identity/R1 | AC-3 | T-001 |
| fork-identity/R2 | AC-1 | T-001 |
| fork-identity/R2 | AC-2 | T-001 |
| fork-identity/R2 | AC-3 | T-001 |
| fork-identity/R3 | AC-1 | T-003 |
| fork-identity/R3 | AC-2 | T-003 |
| fork-identity/R3 | AC-3 | T-003 |
| fork-identity/R4 | AC-1 | T-007 |
| fork-identity/R4 | AC-2 | T-007 |
| fork-identity/R4 | AC-3 | T-007 |
| fork-identity/R5 | AC-1 | T-007 |
| fork-identity/R5 | AC-2 | T-007 |
| fork-identity/R5 | AC-3 | T-007 |
| fork-identity/R6 | AC-1 | T-001 |
| fork-identity/R6 | AC-2 | T-001 |

---

## Tier 0

- T-001: Fork Identity & Branding Setup --> fork-identity/R1, fork-identity/R2, fork-identity/R6
- T-002: Extension Framework Core --> extension-core/R1, extension-core/R8
- T-003: Type System & Configuration Foundation --> extension-core/R3, fork-identity/R3
- T-004: File Parsers (Kit & Build Site) --> extension-commands/R12, extension-commands/R13

## Tier 1

- T-005: Command Infrastructure & Context Builder (blockedBy: T-002, T-003, T-004) --> extension-commands/R14, extension-commands/R16, extension-core/R2
- T-006: Cave Mode Core System (blockedBy: T-002, T-005) --> cave-mode/R1, cave-mode/R6
- T-007: Skill Management & Bundling (blockedBy: T-001, T-005) --> extension-core/R4, fork-identity/R4, fork-identity/R5
- T-008: LLM Tool Integration Layer (blockedBy: T-005, T-006) --> extension-commands/R20, extension-commands/R22

## Tier 2

- T-009: Draft & Help Commands (blockedBy: T-004, T-005, T-008) --> extension-commands/R1, extension-commands/R11
- T-010: Config & Progress Commands (blockedBy: T-005, T-008) --> extension-commands/R9, extension-commands/R10
- T-011: Research & Design Commands (blockedBy: T-008, T-009) --> extension-commands/R7, extension-commands/R8
- T-012: Cave Mode User Interface (blockedBy: T-006, T-010) --> cave-mode/R2, cave-mode/R3

## Tier 3

- T-013: Architect Command & Dependency Analysis (blockedBy: T-004, T-005, T-009) --> extension-commands/R2
- T-014: Build Command & Execution Engine (blockedBy: T-004, T-013, T-008) --> extension-commands/R3, extension-commands/R21
- T-015: Convergence Monitoring & Retry Logic (blockedBy: T-004, T-014) --> extension-commands/R5, extension-commands/R15, extension-commands/R17
- T-016: Quality Gates & Tier Review (blockedBy: T-014, T-015) --> extension-commands/R4

## Tier 4

- T-017: Inspect Command & Analysis (blockedBy: T-004, T-008, T-016) --> extension-commands/R6
- T-018: Cave Mode Advanced Features (blockedBy: T-008, T-012) --> cave-mode/R4, cave-mode/R5
- T-019: UI Dashboard & Overlays (blockedBy: T-014, T-016) --> extension-ui/R1, extension-ui/R2, extension-ui/R3
- T-020: Dependency Visualization (blockedBy: T-004, T-013) --> extension-ui/R4

## Tier 5

- T-021: UI Keyboard Shortcuts & Integration (blockedBy: T-019, T-020) --> extension-ui/R5, extension-ui/R6
- T-022: Robustness & Error Handling (blockedBy: T-004, T-013, T-014) --> extension-commands/R18, extension-commands/R19
- T-023: Compatibility & Protection Hooks (blockedBy: T-007, T-008, T-018) --> extension-core/R5, extension-core/R6, extension-core/R7
- T-024: Final Integration & Testing (blockedBy: T-021, T-022, T-023) --> (Integration validation)