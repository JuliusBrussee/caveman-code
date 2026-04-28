---
created: "2026-04-16"
last_edited: "2026-04-16"
initiative: token-efficiency
status: draft
---

# Cavekit: Session Checkpoints

## Scope

Workspace state checkpoints layered below the existing JSONL session/compaction system. Per-tool-call file snapshots in a hidden git repo. Esc-Esc rewind. Resumable session fuzzy picker. Inline hunk-level diff review. Plan mode (read-only, no checkpoints). Explicitly additive — the existing `SessionManager`, JSONL schema, branch tree, and compaction path are untouched (Q5 lock).

## Requirements

### R1: Shadow-git checkpoint layer
**Description:** A hidden git repository at `~/.cave/checkpoints/<session-id>/.git` mirrors the workdir. Each tool call that writes to the workdir produces an auto-commit tagged with the JSONL session entry ID.
**Acceptance Criteria:**
- [ ] A write/edit/bash tool call that modifies files produces a new commit in the shadow repo.
- [ ] The commit message or tag references the JSONL session entry ID.
- [ ] A tool call that does not modify files produces no commit.
- [ ] The shadow repo location is `~/.cave/checkpoints/<session-id>/.git`.
**Dependencies:** none

### R2: Atomic rewind
**Description:** A rewind operation accepts a session entry ID, performs git checkout to the matching shadow commit, truncates JSONL to that point, and reconstructs branch summary state. Either all three succeed or none do.
**Acceptance Criteria:**
- [ ] A rewind to entry N leaves the workdir matching the shadow commit for N, the JSONL truncated after N, and branch summary state consistent.
- [ ] An induced failure at the JSONL truncation step rolls back the git checkout.
- [ ] A rewind to a non-existent entry ID returns an error without any mutation.
**Dependencies:** R1

### R3: Esc-Esc rewind UX
**Description:** A double-Escape keybinding opens an interactive rewind picker showing recent tool calls with their diffs. Selecting an entry triggers R2.
**Acceptance Criteria:**
- [ ] Pressing Esc twice within the keybind window opens the picker.
- [ ] The picker lists recent tool-call entries with a summary diff.
- [ ] Selecting an entry invokes R2 with that entry ID.
**Dependencies:** R2

### R4: Resumable session fuzzy picker
**Description:** `cave resume` opens a fuzzy picker over `~/.cave/sessions/`. Each entry shows timestamp, first user message, last model used, and total cost. Selecting one re-enters the session at its head.
**Acceptance Criteria:**
- [ ] `cave resume` lists all sessions in `~/.cave/sessions/` sorted by recency.
- [ ] Each entry displays all four fields.
- [ ] Fuzzy-filtering by keyword narrows the list.
- [ ] Selecting a session re-enters at its head with the shadow repo attached.
**Dependencies:** R1

### R5: Plan mode
**Description:** A read-only mode where write, edit, and bash tools are disabled. No shadow-git commits are made. The model can still `grep`/`read`/explore. Toggled by command and persisted per turn.
**Acceptance Criteria:**
- [ ] Entering plan mode blocks write/edit/bash invocations with a structured error.
- [ ] Plan mode makes no commits to the shadow repo.
- [ ] `grep`/`read`/`find`/`ls` remain callable in plan mode.
- [ ] Plan mode state persists across turns until explicitly exited.
**Dependencies:** R1

### R6: Hunk-level inline diff review
**Description:** When write/edit/edit_symbol/apply_sr_diff produces changes, a review UI presents hunks one at a time with accept/reject/edit options. Consumes the diff payload from the edit-tools kit. Configurable: auto-accept, review-each, review-batch.
**Acceptance Criteria:**
- [ ] In review-each mode, each hunk is presented one at a time with accept/reject/edit controls.
- [ ] Rejecting a hunk leaves the file byte-identical to pre-edit for that hunk's range.
- [ ] Auto-accept mode applies all hunks without user interaction.
- [ ] The UI consumes the structured diff payload from cavekit-edit-tools R5.
**Dependencies:** cavekit-edit-tools R5

### R7: Checkpoint GC policy
**Description:** Shadow repos older than a configurable retention (default 30 days) are eligible for `git gc --aggressive` and eventual prune. Active sessions are never GC'd.
**Acceptance Criteria:**
- [ ] A shadow repo older than 30 days is eligible for GC.
- [ ] An active session's shadow repo is never GC'd.
- [ ] The retention value is configurable and honored.
**Dependencies:** R1

### R8: No conflict with existing JSONL session code
**Description:** The existing `SessionManager`, `CURRENT_SESSION_VERSION = 3`, branch tree, compaction, and branch_summary entries are not modified by this kit. Checkpoints are an additive layer below the JSONL surface.
**Acceptance Criteria:**
- [ ] The session JSONL schema version remains 3 — no bump required by this kit.
- [ ] The existing session manager tests pass unchanged.
- [ ] Disabling the checkpoint layer leaves session behavior identical to the pre-checkpoint baseline.
**Dependencies:** none

## Out of Scope

- Cross-session checkpoint diffing.
- Shadow-git pushes to remote.
- Conversation-content rewind without workspace rewind (already supported by branch tree).
- Automatic conflict resolution during rewind.

## Cross-References

- See also: cavekit-edit-tools.md (R6 consumes R5 diff payload).
- See also: cavekit-cost-trace.md (rewind events logged to trace JSONL).

## Source

- `context/refs/research-brief-token-efficiency.md` — Session resumability and checkpoint section; Q5 locked decision (shadow-git below JSONL, JSONL untouched).

## Changelog

| Date | Change |
|------|--------|
| 2026-04-16 | Initial draft |
