# Cavekit Writing: Key Insights

**Core Philosophy**
Cavekit writing separates specification layers: "Kits = WHAT must be true (framework-agnostic, durable, portable)" while plans describe HOW and code provides implementation. This separation makes specifications portable across technology migrations.

**The Validation-First Rule**
Every requirement demands testable acceptance criteria. If an automated test cannot verify something, it likely won't be delivered. Rather than vague directives like "handle errors gracefully," specify measurable outcomes: "Network failures display retry prompts with exponential backoff (1s, 2s, 4s)."

**Structural Requirements**
- Use hierarchical organization with a central index file linking domain-specific sub-kits
- Cross-reference related domains explicitly to prevent requirements from disappearing at boundaries
- Include mandatory "Out of Scope" sections to prevent agents from over-building

**Pattern for Different Scenarios**
Greenfield projects flow from reference materials → kits → plans → code. Rewrites reverse-engineer existing systems into reference documents first, then extract kits, validating they describe current behavior before implementation.

**Maintenance Strategy**
Compact large files (exceeding ~500 lines) by archiving completed work while preserving active tasks. Run gap analysis regularly by comparing actual implementation against cavekit acceptance criteria to identify missing or over-built features.

The underlying principle: specifications that agents can automatically validate tend to get built correctly.
