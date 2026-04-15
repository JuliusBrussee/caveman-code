---
created: "2026-04-16"
last_edited: "2026-04-16"
initiative: token-efficiency
status: draft
---

# Cavekit: Prompt Cache

## Scope

Outbound LLM request layering for prefix caching across all provider adapters in `packages/ai`. Hardens the existing partial Anthropic `cache_control` implementation and generalizes the surface across every provider that supports caching (Anthropic explicit breakpoints, Bedrock `cachePoint`, OpenAI implicit accounting, Gemini explicit cache, DeepSeek disk cache). Lands on the `StreamFn` abstraction so every adapter exposes the same cache contract upstream.

## Requirements

### R1: Layered breakpoint structure
**Description:** All cache-capable providers serialize requests with up to 4 ordered, stable layers — `tools → system → project context → rolling conversation` — most stable content first. Each layer is a single cache breakpoint where the provider supports breakpoints. The project context layer is its own distinct slot, not merged into system or into messages.
**Acceptance Criteria:**
- [ ] A request-assembly test asserts the layers are emitted in exact order: tools, system, project context, messages.
- [ ] At most one breakpoint is emitted per layer on providers that support explicit breakpoints.
- [ ] Removing the project context layer does not alter the bytes of the tools or system layers.
- [ ] A provider without breakpoint support receives the same 4-layer payload without breakpoint markers and the request still succeeds.
**Dependencies:** none

### R2: Deterministic tool schema serialization
**Description:** Tool schemas are sorted alphabetically by key, byte-stable, no whitespace drift, no timestamps or absolute paths embedded. The same tool surface produces the same bytes on every turn.
**Acceptance Criteria:**
- [ ] A snapshot test asserts identical SHA256 across 1,000 invocations of the same tool surface.
- [ ] Changing one tool's description changes only the tools-layer hash; system, project context, and message layer hashes remain identical.
- [ ] Reordering tools at the call site does not change the serialized bytes.
- [ ] No absolute filesystem path or wall-clock timestamp appears in the serialized tool layer.
**Dependencies:** none

### R3: Per-task cache retention
**Description:** The existing `CacheRetention` enum (`none|short|long`) is exposed at the agent-loop call site, not just at session level. Architect-role calls default to `long`; editor-role calls default to `short`. CaveKit phase config can override per phase. Plain CLI exposes `--cache=long|short|none`.
**Acceptance Criteria:**
- [ ] A call tagged role=`plan` in the default profile serializes with `long` retention.
- [ ] A call tagged role=`edit` in the default profile serializes with `short` retention.
- [ ] Passing `--cache=none` on the CLI forces retention=`none` on every call regardless of role.
- [ ] A CaveKit phase override for role=`edit` → `long` is honored and takes precedence over the default.
**Dependencies:** cavekit-model-routing R1 (role tagging)

### R4: Append-only message history
**Description:** Past assistant and user messages are never edited in place. Compaction summaries are written as fresh stable blocks, not by mutating prior turns.
**Acceptance Criteria:**
- [ ] An integration test runs a 20-turn session with a forced compaction at turn 15, then asserts that no message at index < 15 has changed bytes after the compaction.
- [ ] Attempting to mutate a historical message block surfaces a test-visible assertion failure.
- [ ] Compaction summaries appear as new entries with monotonically increasing indices.
**Dependencies:** none

### R5: Cache-aware trimming
**Description:** When the rolling conversation exceeds budget, content is dropped from the middle of the message history, never from the prefix layers and never from the most recent N turns. The dropped span is replaced with a stable summary block.
**Acceptance Criteria:**
- [ ] A trimming test with a 30-turn history, N=5 recent-turn floor, drops only turns 1..24 and preserves 25..30.
- [ ] The tools, system, and project context layers are byte-identical before and after a trim.
- [ ] The stable summary block replacing a dropped span is deterministic: same input turns produce same summary bytes.
**Dependencies:** R4

### R6: Keepalive pings
**Description:** Optional background 1-token completion at a configurable interval (default off, opt-in). Skips when the session has been fully idle past 2× the interval. Does not run when cache retention is `none`.
**Acceptance Criteria:**
- [ ] With `--cache-keepalive=300` set and retention=`long`, a 1-token ping is issued after 300 seconds of inactivity.
- [ ] With retention=`none`, no keepalive ping is issued regardless of configuration.
- [ ] When the session has been idle for more than 2× the interval, keepalive stops until the next user interaction.
- [ ] Keepalive is off by default (no flag = no pings).
**Dependencies:** R3

### R7: Cross-provider parity surface
**Description:** A single `CachePolicy` shape is consumed by all `StreamFn` adapters in `packages/ai`. Anthropic, Bedrock, OpenAI (implicit accounting), Gemini explicit cache, and DeepSeek disk cache all map to and from this shape. Providers without cache support pass through cleanly and report `cached_tokens=0`.
**Acceptance Criteria:**
- [ ] Every adapter in `packages/ai/src/providers/` accepts an identical `CachePolicy` input without adapter-specific surface leaking into callers.
- [ ] A provider parity test runs the same 4-layer request against all cache-capable adapters and asserts each reports a valid usage struct.
- [ ] An adapter with no cache support returns `cached_input_tokens=0` without error.
**Dependencies:** R1

### R8: Cache hit reporting
**Description:** Every LLM response surfaces `cached_input_tokens`, `cache_write_tokens`, and `uncached_input_tokens` in the unified usage struct regardless of provider.
**Acceptance Criteria:**
- [ ] Every `StreamFn` response exposes all three fields as numbers (0 permitted where unsupported).
- [ ] A replay of the same request twice in a row reports `cached_input_tokens > 0` on the second call for cache-capable providers.
- [ ] Aggregate of `cached_input_tokens + uncached_input_tokens` equals total input tokens for the call.
**Dependencies:** R7

## Out of Scope

- KV-cache compression.
- Self-hosted backend prefix sharing.
- SGLang / vLLM integration.
- CacheBlend or non-prefix reuse techniques.
- Anything that requires running our own inference.

## Cross-References

- See also: cavekit-tool-result-cache.md (R2 normalization keeps the prefix cache warm by stabilizing tool output bytes).
- See also: cavekit-repomap.md (R5/R8 land in the project context layer of this kit's breakpoint structure).
- See also: cavekit-edit-tools.md (R7 — new edit tools must satisfy R2 deterministic serialization).
- See also: cavekit-model-routing.md (R1 role tags drive R3 per-task retention).
- See also: cavekit-cost-trace.md (consumes R8 hit reporting for the cost panel).
- See also: cavekit-sandbox-mcp.md (R5 — MCP-registered tool schemas must satisfy R2).

## Source

- `context/refs/research-brief-token-efficiency.md` — Prompt caching section; Q1 (plugin-layer only) and Q2 (architect/editor split in core agent loop) locked decisions.

## Changelog

| Date | Change |
|------|--------|
| 2026-04-16 | Initial draft |
