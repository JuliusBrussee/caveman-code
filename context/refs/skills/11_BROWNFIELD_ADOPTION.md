# Brownfield Adoption: Adding Cavekit to Existing Codebases

This guide explains how to layer Cavekit onto working codebases without rewriting them. The core idea: "The existing code is not the enemy -- it is the source of truth for cavekit generation."

## When to Use Brownfield

Brownfield adoption works well for:
- Production systems you want to improve incrementally
- Large or critical codebases where full rewrites are too risky
- Teams wanting to onboard AI agents safely to existing projects

It's **not** suitable when migrating frameworks or the codebase is fundamentally broken.

## Brownfield vs. Clean-Slate Rebuild

The decision hinges on code quality and scope. Sound code without framework changes? Go brownfield. Broken code or changing frameworks? Consider a deliberate rewrite.

## The 6-Step Process

**Step 1:** Create a standard context directory (`context/refs`, `context/kits`, `context/plans`, etc.)

**Step 2:** Treat existing source code as reference material

**Step 3:** Write a bootstrap prompt (`000-generate-kits-from-code.md`) that reverse-engineers specs from actual behavior

**Step 4:** Run the prompt through 3-5 iteration cycles until kits stabilize

**Step 5:** Validate kits match real code behavior through testing and review

**Step 6:** Switch to normal Cavekit workflows—all future changes flow through kits first

## Key Principle

Generated kits should describe what the code *actually does*, not what it should do. Document bugs separately; fix them through standard Cavekit cycles.

For large codebases, adopt incrementally by priority (P0: high-risk areas first; P2-P3: touch-based adoption later).
