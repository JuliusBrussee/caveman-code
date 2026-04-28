---
created: "2026-04-16"
last_edited: "2026-04-16"
initiative: token-efficiency
status: draft
---

# Cavekit: Tool Result Cache

## Scope

Caching of tool outputs independently of the LLM prefix cache. File-touching tools (`read`, `grep`, `find`, `ls`) deduplicate within a session and replay cached results when the underlying file fingerprint is unchanged. Output normalization ensures that repeat invocations of the same tool do not produce drifting bytes that would bust the prefix cache layered by cavekit-prompt-cache.

## Requirements

### R1: Result cache key
**Description:** Tool outputs are cached by `(tool_name, normalized_args, fingerprint)` where `fingerprint = git_blob_sha + mtime + size` for file-touching tools and is null (no caching) for non-deterministic tools. Cache is scoped to one session ID.
**Acceptance Criteria:**
- [ ] Two identical `read` calls within one session produce one cache write and one cache hit.
- [ ] A `read` call with the same logical path but different argument ordering (where semantically identical) hits the same cache entry.
- [ ] The fingerprint changes when any of `git_blob_sha`, `mtime`, or `size` changes, and the next call is a miss.
- [ ] Two sessions do not share cache entries.
**Dependencies:** none

### R2: Tool output normalization
**Description:** Before a tool result enters the LLM message stream, absolute paths are rewritten to repo-relative, trailing whitespace is collapsed, ANSI escapes are stripped, and embedded timestamps are redacted.
**Acceptance Criteria:**
- [ ] Two `read` calls on the same file at different wall-clock times produce byte-identical message blocks.
- [ ] A grep output containing ANSI color codes emits a message block with zero ANSI escape sequences.
- [ ] An absolute path matching the workdir prefix is rewritten to a repo-relative path.
- [ ] An ISO-8601 timestamp embedded in tool output is redacted to a stable placeholder.
**Dependencies:** none

### R3: Read-cache invalidation
**Description:** When `write` or `edit` modifies a file, cache entries for that file's `read` and `grep` results are invalidated. When `bash` runs, the entire file-touching cache layer is invalidated unless the bash command is on a known-pure allowlist.
**Acceptance Criteria:**
- [ ] After `write` on file F, the next `read(F)` is a cache miss.
- [ ] After `edit` on file F, cached `grep` results referencing F are invalidated.
- [ ] After an arbitrary `bash` command not on the allowlist, the next `read` on any file is a miss.
- [ ] A bash command on the pure allowlist (e.g., `echo`, `true`) does not invalidate the cache.
**Dependencies:** R1

### R4: Bypass for non-deterministic tools
**Description:** `bash`, network tools, and time-dependent tools are never cached. Bypass is allowlist-driven by tool name, not opt-in per call.
**Acceptance Criteria:**
- [ ] Two identical `bash` calls produce two cache misses and no cache write.
- [ ] The bypass allowlist is read from config and enforced at the cache layer, not in individual tool handlers.
- [ ] A call-site flag cannot force caching for a tool on the bypass list.
**Dependencies:** R1

### R5: Cache size bound
**Description:** Per-session cache is bounded by token count, not entry count. When the bound is exceeded, LRU eviction runs. Eviction does not modify previously-emitted message blocks.
**Acceptance Criteria:**
- [ ] Setting the bound to N tokens and filling past N evicts least-recently-used entries until the total is ≤ N.
- [ ] After eviction, past message blocks in the LLM stream are byte-identical to pre-eviction.
- [ ] Eviction is a no-op on entries used within the current turn.
**Dependencies:** R1

### R6: Hit accounting
**Description:** Each cache hit increments a `cached_tool_results` counter and an estimated saved-tokens delta, surfaced through the local trace JSONL.
**Acceptance Criteria:**
- [ ] A cache hit appends a typed `tool_cache_hit` event to the trace JSONL with the saved-tokens estimate.
- [ ] A cache miss appends a typed `tool_cache_miss` event.
- [ ] The running `cached_tool_results` counter is readable from the cost panel.
**Dependencies:** cavekit-cost-trace R5 (trace JSONL surface)

## Out of Scope

- Cross-session persistent tool result cache.
- Network or HTTP response caching.
- Bash output caching.
- LLM-driven cache invalidation heuristics.

## Cross-References

- See also: cavekit-prompt-cache.md (R2 normalization is required for the prefix cache R4 append-only guarantee).
- See also: cavekit-cost-trace.md (R6 hit accounting feeds the trace and cost panel).

## Source

- `context/refs/research-brief-token-efficiency.md` — Tool output caching and normalization section.

## Changelog

| Date | Change |
|------|--------|
| 2026-04-16 | Initial draft |
