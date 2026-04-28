---
created: "2026-04-16"
last_edited: "2026-04-16"
initiative: token-efficiency
status: draft
---

# Cavekit: Input Compression

## Scope

Optional input-compression middleware applied to long context blocks before they enter the LLM request. LLMLingua-2 via `onnxruntime-node` for general prose chunks; Provence reranker-pruner for retrieved chunks. Compression is opt-in and only activates when a context block exceeds a configurable size. Models are downloaded on first use; the binary does not bundle them.

## Requirements

### R1: LLMLingua-2 compression path
**Description:** A middleware accepting a text block and returning a compressed text block, backed by an LLMLingua-2 ONNX model loaded via `onnxruntime-node`. No Python runtime dependency. Compression ratio configurable, default 2x.
**Acceptance Criteria:**
- [ ] A 4000-token input block produces an output block at approximately half the token count with default config.
- [ ] The middleware runs without any Python process being spawned.
- [ ] The compression ratio is configurable and honored within ±10%.
**Dependencies:** none

### R2: Provence reranker pruner
**Description:** A second middleware accepting `(query, chunks[])` and returning a pruned, ordered chunk list, backed by a Provence ONNX model. Used on retrieved chunk paths only.
**Acceptance Criteria:**
- [ ] Given a query and 20 chunks, the middleware returns a pruned list ordered by relevance.
- [ ] Chunks below a relevance threshold are dropped.
- [ ] Running twice with the same query and chunks returns the same ordering.
**Dependencies:** none

### R3: Activation thresholds
**Description:** Compression middlewares only activate when the input block exceeds a configurable token threshold (default: 4000 tokens for LLMLingua-2, 2000 tokens for Provence). Below threshold, content passes through unchanged.
**Acceptance Criteria:**
- [ ] A 500-token block passes through LLMLingua-2 unchanged (byte-identical output).
- [ ] A 5000-token block is compressed by LLMLingua-2.
- [ ] Threshold values are readable from config and honored.
**Dependencies:** R1, R2

### R4: Cache compatibility
**Description:** Compression output for the same input bytes must be deterministic so the prompt cache is not busted.
**Acceptance Criteria:**
- [ ] Running compression on the same input bytes with the same model and params returns byte-identical output across 100 runs.
- [ ] No system time or randomness affects the output.
- [ ] Swapping models changes the output; swapping back reverts to original output.
**Dependencies:** R1, R2

### R5: Opt-in by surface
**Description:** Off by default. Enabled via config (`compression: { llmlingua: true, provence: true }`) or per-call CLI flag. Never compresses tool definitions, system prompt, or user-typed input — only model-facing context blocks.
**Acceptance Criteria:**
- [ ] With no config, no compression runs regardless of block size.
- [ ] Tool definition bytes are byte-identical with and without compression enabled.
- [ ] System prompt and user-typed input bytes are byte-identical with and without compression.
**Dependencies:** R3

### R6: Bundle policy
**Description:** ONNX model files are not bundled into the binary. They are downloaded on first use into `~/.cave/models/` with a checksum gate. The binary works without compression if the user opts out.
**Acceptance Criteria:**
- [ ] The distributed binary contains no `.onnx` model files.
- [ ] First use with compression enabled downloads the model to `~/.cave/models/` and verifies checksum.
- [ ] A checksum mismatch aborts model load with a clear error.
- [ ] Running `cave` without compression enabled never touches `~/.cave/models/`.
**Dependencies:** R1, R2

### R7: Fallback on failure
**Description:** If model load or inference fails, compression silently falls back to passthrough and emits a warning to the trace.
**Acceptance Criteria:**
- [ ] A missing model file produces passthrough output and a `compression_fallback` trace event.
- [ ] An inference exception produces passthrough output and a trace event.
- [ ] Fallback does not propagate the error to the LLM call path.
**Dependencies:** R6, cavekit-cost-trace R5

## Out of Scope

- Fine-tune-required compression methods (Gist, ICAE, AutoCompressor, xRAG, Activation Beacon, 500xCompressor).
- RECOMP.
- Bundling ONNX models in the binary.
- Compressing model output.

## Cross-References

- See also: cavekit-prompt-cache.md (R4 determinism is a hard prerequisite for cache warmth).
- See also: cavekit-cost-trace.md (R7 logs compression activations and fallbacks).

## Source

- `context/refs/research-brief-token-efficiency.md` — Input compression section (LLMLingua-2, Provence); excluded-methods list.

## Changelog

| Date | Change |
|------|--------|
| 2026-04-16 | Initial draft |
