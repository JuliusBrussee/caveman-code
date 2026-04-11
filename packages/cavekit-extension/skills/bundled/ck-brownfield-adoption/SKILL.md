---
name: ck-brownfield-adoption
description: Adopt CaveKit incrementally inside existing codebases by retrofitting specs around bounded changes.
---

# CaveKit Brownfield Adoption

Strategy for introducing CaveKit into an existing codebase that was not originally built with SDD.

## Steps

1. **Map** — run `ck:map` to produce a high-level architecture summary
2. **Scope** — select one small, well-bounded feature to pilot CaveKit on
3. **Retrofit spec** — write a kit for the existing behavior as the baseline
4. **Validate baseline** — confirm all baseline ACs pass before making any changes
5. **Iterate** — use CaveKit normally for new work; retrofit specs for areas touched by each PR
