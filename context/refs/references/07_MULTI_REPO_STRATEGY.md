# Multi-Repo Strategy Reference

This document outlines a system for managing shared specifications across multiple framework implementations using git submodules.

## Core Structure

The approach uses a **3-tier hierarchy**:

1. **Tier 1 (Shared Context - Reference)**: Framework-agnostic documentation describing the current system state
2. **Tier 2 (Shared Context - Specifications)**: Implementation-agnostic requirements defining what the system must do
3. **Tier 3 (Application Context)**: Framework-specific plans, tracking, and code

## Key Mechanism

A dedicated shared context repository contains reference materials and specifications. Multiple framework repositories link to it via git submodules, enabling identical specs to drive different implementations.

## Primary Benefits

**Consistent Specifications Across Frameworks**: As stated, this approach ensures "same specs driving different implementations" and enables fair framework comparison using identical acceptance criteria.

**Spec Propagation**: When specifications are updated in the shared repository, all framework implementations receive the updates through submodule references, preventing divergence.

**Independent Implementation**: Despite sharing specs, each framework can maintain its own architectural approach, plans, and testing strategies without affecting others.

## Practical Application

The strategy works well for framework evaluation, migration projects, and multi-platform development. It prevents scope creep by maintaining clear separation between specifications (what must be built) and implementation details (how to build it for a specific framework).

The document emphasizes that "framework-specific content" should never appear in the shared context, maintaining clear boundaries between shared and framework-specific materials.
