---
created: "2026-04-16"
last_edited: "2026-04-16"
initiative: token-efficiency
status: draft
---

# Cavekit: Edit Tools

## Scope

Two new edit tool modalities supplementing today's single `edit` tool: an Aider-style search/replace (`S/R`) diff format and an AST-addressed `edit_symbol` tool. Both reduce hunk-apply failure rates and produce structured diff payloads the session-checkpoints review UI can consume. The existing line-based `edit` tool is preserved; the model receives all three and selects per task.

## Requirements

### R1: Search/replace diff format
**Description:** A new tool `apply_sr_diff` accepts `(file, search_block, replace_block)`. The search block must match exactly once in the file; ambiguous matches fail with a diagnostic.
**Acceptance Criteria:**
- [ ] On a fixture set of 100 SWE-bench-style edits where the existing `edit` tool fails at a rate of at least 10%, `apply_sr_diff` achieves at least 95% apply success.
- [ ] A search block that matches zero times in the target file returns a structured error with `reason=no_match`.
- [ ] A search block that matches multiple times returns `reason=ambiguous` with all match line ranges.
- [ ] A successful apply leaves exactly the replace block in place of the single matched span.
**Dependencies:** none

### R2: AST-addressed `edit_symbol` tool
**Description:** A new tool `edit_symbol(file, qualified_name, new_body)` replaces the body of a named symbol (function, class, type, method) by AST traversal, using the same tree-sitter grammar set as the repomap.
**Acceptance Criteria:**
- [ ] Replacing the body of a function in each of the 8 supported languages produces a valid parse after the write.
- [ ] Calling `edit_symbol` on a language outside the top-8 returns `reason=unsupported_language`.
- [ ] The qualified name resolves nested symbols (e.g., `ClassA.methodB`).
- [ ] The symbol's signature line is preserved; only the body is replaced.
**Dependencies:** cavekit-repomap R1

### R3: Symbol resolution disambiguation
**Description:** When `qualified_name` matches multiple symbols, the tool returns an error listing all candidates with `file:line`, requiring a more specific name.
**Acceptance Criteria:**
- [ ] A fixture with two same-named methods in different classes returns `reason=ambiguous` listing both `file:line` candidates.
- [ ] Providing a more specific qualified name that matches exactly one symbol succeeds.
- [ ] The error output enumerates every matching candidate, not just the first two.
**Dependencies:** R2

### R4: Atomic write
**Description:** Both tools write atomically via temp file and rename. On parse failure of the resulting file, the write is rolled back and an error is returned with the parse diagnostic.
**Acceptance Criteria:**
- [ ] An induced parse failure (via a replace block that breaks syntax) leaves the original file byte-identical.
- [ ] A successful write replaces the file atomically (no intermediate partial state observable on disk).
- [ ] The parse diagnostic is returned as a structured field, not a free-text string.
**Dependencies:** R1, R2

### R5: Hunk-level diff preview surface
**Description:** Both tools produce a structured diff payload `(file, hunks[])` where each hunk has `before`, `after`, and `lineRange`. The payload is consumed by session-checkpoints hunk-review UI.
**Acceptance Criteria:**
- [ ] A successful `apply_sr_diff` call returns a payload with at least one hunk.
- [ ] Each hunk carries `before`, `after`, and `lineRange` fields.
- [ ] An `edit_symbol` call returns a payload whose hunk line range covers the replaced body.
**Dependencies:** R1, R2

### R6: Coexistence with existing `edit` tool
**Description:** The existing line-based `edit` tool is not removed. The model receives all three tools and chooses. Tool descriptions make the tradeoffs explicit: S/R for unique snippets, `edit_symbol` for named bodies, `edit` for ad-hoc changes.
**Acceptance Criteria:**
- [ ] The tool surface exposed to the model simultaneously contains `edit`, `apply_sr_diff`, and `edit_symbol`.
- [ ] Each tool's description contains the stated intended use ("unique snippets", "named bodies", "ad-hoc").
- [ ] Removing `apply_sr_diff` or `edit_symbol` from the surface does not break calls to `edit`.
**Dependencies:** R1, R2

### R7: Cache-stability of tool schemas
**Description:** Tool definitions for R1 and R2 must satisfy the deterministic serialization requirement of the prompt cache.
**Acceptance Criteria:**
- [ ] A snapshot test asserts byte-identical serialization of `apply_sr_diff` and `edit_symbol` schemas across 1,000 invocations.
- [ ] Changing the description of one tool changes only that tool's bytes, not the others.
- [ ] No absolute path or timestamp appears in either schema.
**Dependencies:** cavekit-prompt-cache R2

## Out of Scope

- Multi-file refactoring.
- Cross-file symbol rename.
- Type-aware refactoring (LSP layer).
- Adding languages beyond the top-8.

## Cross-References

- See also: cavekit-repomap.md (R2 shares the tree-sitter parse layer).
- See also: cavekit-session-checkpoints.md (R5 diff payload consumed by the hunk-level review UI).
- See also: cavekit-prompt-cache.md (R7 — schemas must satisfy R2 deterministic serialization).

## Source

- `context/refs/research-brief-token-efficiency.md` — Edit tool reliability section (Aider S/R, AST editing); Q3 tree-sitter grammar set.

## Changelog

| Date | Change |
|------|--------|
| 2026-04-16 | Initial draft |
