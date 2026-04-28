---
created: "2026-04-16"
last_edited: "2026-04-16"
initiative: token-efficiency
status: draft
---

# Cavekit: Repomap

## Scope

A tree-sitter-based symbol map of the repository, ranked by PageRank over the symbol-reference graph and rendered into ~1k tokens that the model sees as a stable project-context block. Closes the current "no repomap" gap in the agent's project awareness. Emitted in caveman compression style by default to maximize symbol density per token. Lands as an additional block in the system prompt assembly, slotted into the project context layer defined by cavekit-prompt-cache.

## Requirements

### R1: Tree-sitter top-8 grammar coverage
**Description:** The repomap parses TypeScript, JavaScript, Python, Go, Rust, Java, C, and C++. Files in unsupported languages contribute filename and line count only.
**Acceptance Criteria:**
- [ ] A fixture repo containing all 8 languages produces symbol entries for each.
- [ ] A file in an unsupported language (e.g., Ruby) contributes exactly one entry with `(path, line_count)` and no symbols.
- [ ] Adding a new TypeScript file to the fixture adds TypeScript symbols on the next refresh.
**Dependencies:** none

### R2: Symbol graph construction
**Description:** Each parsed file contributes `(symbol, kind, file:line, signature)` nodes and reference edges where another symbol uses it. Symbol kinds include at minimum function, class/struct, type/interface, and exported constant.
**Acceptance Criteria:**
- [ ] For a fixture with function A calling function B, the graph contains both nodes and an edge A → B.
- [ ] All four required kinds are emitted for a fixture containing each.
- [ ] A symbol node carries `file`, `line`, `kind`, and `signature` fields.
**Dependencies:** R1

### R3: PageRank ranking
**Description:** The symbol graph is PageRanked. The top-K symbols are emitted, with K dynamically scaled to fit the token budget.
**Acceptance Criteria:**
- [ ] Running PageRank on a fixture graph produces a deterministic ranked list.
- [ ] Reducing the token budget lowers K and drops the lowest-ranked symbols first.
- [ ] A symbol with many incoming references ranks higher than one with none, given equal damping.
**Dependencies:** R2

### R4: Caveman-rendered emission
**Description:** The emitted map uses caveman compression style (terse, fragments, no articles) by default, with full prose available behind a style flag.
**Acceptance Criteria:**
- [ ] Caveman style fits at least 30% more symbols than full style in the same token budget on a fixture repo.
- [ ] Setting `--repomap-style=full` produces prose-form output.
- [ ] Both styles produce byte-stable output given the same input (see R5).
**Dependencies:** R3

### R5: Stable rendering across runs
**Description:** Given the same git state, the repomap renders byte-identically on every invocation. Symbol ordering is deterministic, paths are repo-relative, and no timestamps are embedded.
**Acceptance Criteria:**
- [ ] Invoking the repomap twice in a row on a clean git tree produces two byte-identical outputs.
- [ ] No absolute filesystem path appears in the rendered output.
- [ ] No wall-clock timestamp appears in the rendered output.
- [ ] Ties in PageRank are broken by a deterministic secondary key (e.g., sorted symbol name).
**Dependencies:** R3, R4

### R6: Incremental refresh
**Description:** The repomap is regenerated when git HEAD changes, when uncommitted file changes touch parsed files, or after a configurable interval. Otherwise it is served from session-scoped cache.
**Acceptance Criteria:**
- [ ] Two back-to-back invocations with no file changes serve from cache (no re-parse).
- [ ] Changing git HEAD invalidates the cache on the next call.
- [ ] Modifying a parsed file on disk invalidates the cache on the next call.
- [ ] Reaching the configured interval invalidates the cache.
**Dependencies:** R5

### R7: Token budget respected
**Description:** The budget is a configurable parameter (default ~1000 tokens, bounded maximum). Emission truncates by dropping lowest-rank symbols first, never by mid-symbol cut.
**Acceptance Criteria:**
- [ ] Setting budget=500 produces output within 500 tokens.
- [ ] Truncation never splits a symbol entry mid-string.
- [ ] The default budget is approximately 1000 tokens.
**Dependencies:** R3

### R8: Inclusion in project context layer
**Description:** The repomap is injected into the system prompt assembly as a project-context block, separate from CLAUDE.md content, in a stable order (CLAUDE.md → repomap → user-provided context). It lands in the project context layer of the prompt cache breakpoint structure.
**Acceptance Criteria:**
- [ ] The project context layer contains CLAUDE.md content before the repomap and the repomap before any user-provided context.
- [ ] Removing the repomap from the project context layer does not change the bytes of the tools or system layers.
- [ ] The repomap block is a separate, identifiable section within the project context layer.
**Dependencies:** cavekit-prompt-cache R1

## Out of Scope

- Embedding-based retrieval.
- LSP integration.
- Cross-repo symbol resolution.
- Languages outside the top-8 grammar set.
- Semantic symbol search.

## Cross-References

- See also: cavekit-prompt-cache.md (R8 lands in R1's project context layer; R5 stability is a hard prerequisite for cache warmth).
- See also: cavekit-edit-tools.md (shares the tree-sitter parse layer from R1/R2).
- See also: cavekit-localizer-verifier.md (R1 localizer consumes this repomap as input).

## Source

- `context/refs/research-brief-token-efficiency.md` — Repomap / Aider-style symbol ranking section; Q3 (tree-sitter top-8 grammars) locked decision.

## Changelog

| Date | Change |
|------|--------|
| 2026-04-16 | Initial draft |
