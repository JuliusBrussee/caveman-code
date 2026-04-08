# Revision: Tracing Bugs Back to Kits

Revision is a structured process for ensuring bug fixes persist across iteration cycles by tracing defects upstream to their root causes in kits and prompts.

## Core Concept

Rather than patching code in isolation, revision means updating the specification documents (kits) that govern how the iteration loop generates code. As the guide explains: "When a fix lives only in code with no corresponding cavekit update, the next iteration loop may reintroduce the same defect."

## The 6-Step Process

1. **Identify and fix** the defect through normal debugging
2. **Analyze the cavekit gap** using five dimensions: WHAT changed, WHY it failed, VISUAL design implications, the governing RULE, and which LAYER should have caught it
3. **Update the cavekit** with the missing requirement and acceptance criteria
4. **Propagate changes** through plans and tracking documents
5. **Apply systemic improvements** if the bug represents a recurring pattern
6. **Verify autonomously** by re-running the iteration loop without manual fixes, plus generate regression tests

## Why It Matters

The key insight: "Bug fixes become cavekit improvements that persist across all future iterations." This transforms one-off patches into permanent learnings that make the iteration loop self-correcting. Over successive cycles, manual interventions should decline as kits grow more complete.

The process prevents **revision debt**—accumulated unfixed gaps that cause the same categories of bugs to resurface repeatedly.
