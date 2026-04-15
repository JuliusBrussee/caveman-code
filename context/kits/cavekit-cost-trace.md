---
created: "2026-04-16"
last_edited: "2026-04-16"
initiative: token-efficiency
status: draft
---

# Cavekit: Cost & Trace

## Scope

Cost governance and local observability. Hard mid-turn cost caps that actually kill a runaway turn. Live `/cost` panel. Local trace JSONL of every LLM call, tool call, and cache event. `cave trace <session>` terminal viewer. `cave replay <rollout.jsonl>` deterministic re-execution. OpenTelemetry and Langfuse exporters are explicitly deferred (Q6 lock).

## Requirements

### R1: Cost accounting struct
**Description:** Every LLM response is converted into a `CostEntry { provider, model, role, input_uncached, input_cached, cache_write, output, dollars_estimated }`. Per-provider pricing tables ship with the binary and are user-overridable.
**Acceptance Criteria:**
- [ ] Every LLM call produces a `CostEntry` with all fields populated.
- [ ] `dollars_estimated` is computed from the pricing table for the `(provider, model)` pair.
- [ ] Overriding the pricing table via user config changes `dollars_estimated` on the next call.
**Dependencies:** cavekit-prompt-cache R8, cavekit-model-routing R1

### R2: Per-turn cost cap
**Description:** Configurable max-cost-per-turn (default unlimited, opt-in). When the cap is approached during streaming, the current LLM call is cancelled mid-stream and a structured cap-reached event is emitted. Subsequent turns require user confirmation to proceed.
**Acceptance Criteria:**
- [ ] Setting the per-turn cap to $0.10 cancels a streaming call once its estimated cost reaches the cap.
- [ ] The cancellation emits a `cost_cap_turn` event with the entry causing the cap.
- [ ] The next turn prompts the user for confirmation before proceeding.
- [ ] With no cap set, calls stream to completion as today.
**Dependencies:** R1

### R3: Per-session cost cap
**Description:** Same as R2 but at session granularity. Includes all sub-agents.
**Acceptance Criteria:**
- [ ] Setting a session cap of $1.00 halts the session once aggregate cost reaches $1.00.
- [ ] Subagent cost is included in the aggregate.
- [ ] Halting emits a `cost_cap_session` event.
**Dependencies:** R1, R2

### R4: Live cost panel
**Description:** A `/cost` slash command renders running totals — tokens in/out, cached vs uncached, dollars, cache hit rate. Updates streaming.
**Acceptance Criteria:**
- [ ] Invoking `/cost` displays all five metrics.
- [ ] The panel updates as new LLM calls complete.
- [ ] Cache hit rate equals `cached_input_tokens / (cached_input_tokens + uncached_input_tokens)`.
**Dependencies:** R1

### R5: Trace JSONL
**Description:** Every LLM call, tool call, cache event, model routing decision, and compression activation is appended to `~/.cave/sessions/<id>.trace.jsonl` as a typed event. The file is append-only and rotation-safe.
**Acceptance Criteria:**
- [ ] A single session produces a JSONL file with one event per line.
- [ ] Every event has a `type` field identifying its kind.
- [ ] The file is never rewritten in place — only appended to.
- [ ] Rotation (on size threshold) produces a new file without truncating the existing one.
**Dependencies:** R1

### R6: `cave trace <session>` viewer
**Description:** A terminal command reads the trace JSONL and renders a timeline: turn boundaries, LLM calls with model and tokens and dollars, tool calls with cache state, cost-cap events. Supports filtering by event type.
**Acceptance Criteria:**
- [ ] `cave trace <session-id>` renders events in timestamp order.
- [ ] `--filter=<type>` shows only events of the given type.
- [ ] LLM call entries display model ID, input/output tokens, and dollar cost.
- [ ] Tool call entries display cache state (hit/miss).
**Dependencies:** R5

### R7: `cave replay <rollout.jsonl>`
**Description:** A deterministic replay command re-executes a recorded session against the same model, same inputs, and same router decisions. Used for benchmarking and regression testing. Replay never writes to the user's workdir unless `--apply` is passed.
**Acceptance Criteria:**
- [ ] Replaying a recorded session produces the same sequence of LLM calls and routing decisions.
- [ ] Without `--apply`, no file in the workdir is modified.
- [ ] With `--apply`, file writes execute against the current workdir.
**Dependencies:** R5, cavekit-model-routing R4

### R8: Auditable memory provenance
**Description:** Any persisted memory or summary entry written by the agent records its source: `(turn_index, source_message_ids)`. Surfaced in the trace viewer.
**Acceptance Criteria:**
- [ ] Every memory entry written by the agent contains both fields.
- [ ] The trace viewer displays provenance for memory/summary entries.
- [ ] A memory entry with unknown source raises a test-visible assertion.
**Dependencies:** R5

## Out of Scope

- OpenTelemetry SDK integration.
- Langfuse exporter.
- Anonymous remote telemetry.
- Long-term cost analytics dashboards.
- Any feature requiring a server.

## Cross-References

- See also: cavekit-prompt-cache.md (R8 hit reporting feeds R1/R4).
- See also: cavekit-tool-result-cache.md (R6 hit events feed R5).
- See also: cavekit-model-routing.md (R5 cap-aware downgrade consumes R3 cap state).
- See also: cavekit-localizer-verifier.md (subagent token cost feeds R3 session aggregate).
- See also: cavekit-input-compression.md (R7 activation/fallback logged via R5).
- See also: cavekit-sandbox-mcp.md (sandbox events logged via R5).
- See also: cavekit-bench-research-distro.md (R2 caps drive nightly eval gating).

## Source

- `context/refs/research-brief-token-efficiency.md` — Cost caps and observability section; Q6 locked decision (local trace + viewer v1; OTel/Langfuse deferred).

## Changelog

| Date | Change |
|------|--------|
| 2026-04-16 | Initial draft |
