---
created: "2026-04-16"
last_edited: "2026-04-16"
initiative: token-efficiency
status: draft
---

# Cavekit: Localizer & Verifier

## Scope

An Agentless-style deterministic localizer pipeline (file → class → line) before the agent loop; best-of-N sample generation with executable verifier ranking; Reflexion-lite on test failure (depth ≤ 2); and subagent context isolation with hard token budgets and forced caveman compression inside. Feeds the core agent loop and produces structured summaries back to the parent session.

## Requirements

### R1: Localizer pipeline
**Description:** Given an issue or task description, a deterministic pipeline ranks files → ranked classes/symbols → ranked lines, using the repomap plus LLM re-ranking. Output is a top-K candidate list with `(file, symbol, line_range, confidence)`.
**Acceptance Criteria:**
- [ ] On a fixture issue with a known bug location, the localizer returns the correct file in the top-K.
- [ ] The output contains all four fields for every candidate.
- [ ] Running the localizer twice on the same input returns the same ordered list.
**Dependencies:** cavekit-repomap R3

### R2: Localizer feeds agent loop
**Description:** When enabled, the agent loop receives the candidate list as initial focused context, replacing or augmenting the open-ended exploration step. Configurable per session.
**Acceptance Criteria:**
- [ ] With localizer enabled, the first model turn sees the candidate list in its context.
- [ ] With localizer disabled, the agent loop behavior is unchanged from baseline.
- [ ] The localizer mode (replace vs augment) is switchable via config.
**Dependencies:** R1

### R3: Best-of-N sampling
**Description:** For patch-generation tasks, the harness can generate N candidate patches in parallel via N independent subagent runs. N is configurable; default 1 (off), opt-in.
**Acceptance Criteria:**
- [ ] Setting N=3 produces 3 candidate patches from 3 independent subagent runs.
- [ ] The default value of N is 1.
- [ ] Subagents run in parallel, not serially, when N>1.
**Dependencies:** R7

### R4: Executable verifier
**Description:** Each candidate patch is ranked by running a synthesized reproduction test (or a user-provided failing test). The candidate passing the most tests wins. LLM-as-judge ranking is explicitly forbidden as the primary verifier.
**Acceptance Criteria:**
- [ ] Given 3 candidates and 1 failing test, the winner is the candidate that makes the test pass.
- [ ] Tie-breaking among candidates that all pass uses a deterministic secondary key (e.g., smallest diff).
- [ ] The verifier never invokes an LLM-as-judge call as its primary ranking mechanism.
**Dependencies:** R3

### R5: Reproduction test synthesis
**Description:** When no failing test is provided, a separate subagent attempts to synthesize a minimal reproduction test from the issue description. If synthesis fails, best-of-N falls back to N=1.
**Acceptance Criteria:**
- [ ] A fixture issue with a clear failure description produces a reproduction test that fails pre-patch.
- [ ] Synthesis failure triggers a fallback to N=1 with a trace event.
- [ ] The synthesized test is written to a temp location, not the workdir.
**Dependencies:** R4

### R6: Reflexion-lite on test failure
**Description:** When a candidate fails, the failure output (compiler error, test output) is fed back to a single retry pass with the same role as the original. Maximum reflection depth: 2.
**Acceptance Criteria:**
- [ ] A candidate that fails on the first pass is retried exactly once with failure context appended.
- [ ] Maximum reflection depth of 2 is enforced — a third attempt is never made.
- [ ] The retry call carries the same role tag as the original.
**Dependencies:** R4, cavekit-model-routing R1

### R7: Subagent context isolation
**Description:** Each best-of-N sample runs in an isolated subagent context with its own message history. The subagent operates with caveman compression forced (overriding session setting) and a hard input-token budget. On budget breach, the subagent terminates and returns a partial result.
**Acceptance Criteria:**
- [ ] Subagent message history is separate from the parent session's message history.
- [ ] Caveman compression is enabled inside the subagent regardless of parent session compression setting.
- [ ] Exceeding the input-token budget terminates the subagent and returns a partial result with `verdict=budget_exceeded`.
**Dependencies:** cavekit-cost-trace R3

### R8: Subagent summary collapse
**Description:** The parent session receives only a structured summary (≤500 tokens) from each subagent: `(verdict, candidate_diff, test_result, token_cost)`. Full subagent transcripts are written to the trace JSONL for replay.
**Acceptance Criteria:**
- [ ] The parent session message stream contains only the structured summary for each subagent, not full transcripts.
- [ ] The summary is bounded at ≤ 500 tokens.
- [ ] The full subagent transcript is recoverable from the trace JSONL.
**Dependencies:** R7, cavekit-cost-trace R5

## Out of Scope

- Tree search (LATS-style).
- Beam search with intermediate scoring.
- Reflexion depth greater than 2.
- RL-based candidate selection.
- Cross-session candidate caching.

## Cross-References

- See also: cavekit-repomap.md (R1 consumes repomap output as localizer input).
- See also: cavekit-model-routing.md (R6 uses the `verify` role; routing powers per-role model choice inside subagents).
- See also: cavekit-cost-trace.md (R7 hard budgets enforced via cost caps; R8 summaries reference trace JSONL for replay).

## Source

- `context/refs/research-brief-token-efficiency.md` — Agentless localizer, best-of-N sampling, executable verifier, Reflexion-lite, and subagent isolation sections.

## Changelog

| Date | Change |
|------|--------|
| 2026-04-16 | Initial draft |
