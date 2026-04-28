---
created: 2026-04-08
last_edited: 2026-04-08
status: draft
domain: cave-mode
depends_on:
  - fork-identity
---

# Blueprint: Cave Mode

## Scope

This blueprint covers all behavioral modifications to the forked agent that reduce token consumption: caveman communication rules injected into the system prompt, a user-facing command to toggle intensity, a settings manager entry for cave mode configuration, caveman-compressed compaction summaries, and tool result compression. These are the 3-4 source file modifications that constitute the "thin fork."

## Requirements

### R1: System Prompt Injection

**Description:** The agent's system prompt includes caveman communication rules that instruct the model to respond in a terse, token-efficient style. The rules are sourced from the caveman skill (three intensity levels: lite, full, ultra) and are active by default.

**Acceptance Criteria:**
- [ ] AC-1: When cave mode is enabled (default), the system prompt sent to the model contains the caveman communication rules including the three intensity levels and their definitions.
- [ ] AC-2: When cave mode is disabled via settings, the system prompt contains no caveman communication rules and matches the upstream Pi system prompt.
- [ ] AC-3: The injected rules specify that code blocks, commit messages, and PR descriptions are written in normal English.
- [ ] AC-4: The injected rules specify auto-clarity exceptions for security warnings and destructive operations.

### R2: Intensity Toggle Command

**Description:** A slash command allows the user to switch between caveman intensity levels (lite, full, ultra) or disable caveman mode entirely during a session.

**Acceptance Criteria:**
- [ ] AC-1: A registered slash command accepts intensity level arguments (lite, full, ultra, off).
- [ ] AC-2: Running the command with an intensity argument updates the active intensity for the current session.
- [ ] AC-3: Running the command with "off" disables caveman rules in the system prompt for the remainder of the session.
- [ ] AC-4: Running the command without arguments displays the current intensity level.
- [ ] AC-5: The command is registered following the same pattern as existing built-in commands (e.g., `/settings`, `/compact`).

### R3: Settings Manager Entry

**Description:** Cave mode settings are persisted through the existing settings manager, controlling whether cave mode is enabled, which intensity level is active, and whether tool compression is on.

**Acceptance Criteria:**
- [ ] AC-1: The settings schema includes a cave mode section with fields for: enabled (boolean, default true), intensity (lite/full/ultra, default full), and tool compression (boolean, default true).
- [ ] AC-2: Changing cave mode settings via the settings interface persists the values across sessions.
- [ ] AC-3: The settings are readable by other components (compaction, tool executor) to gate their behavior.

### R4: Caveman-Compressed Compaction

**Description:** When cave mode is enabled, the compaction system uses a modified prompt that instructs the model to produce terse, high-density summaries following caveman compression principles. This applies to both conversation compaction and branch summarization.

**Acceptance Criteria:**
- [ ] AC-1: When cave mode is enabled, the compaction prompt instructs the model to drop articles, filler, and pleasantries while preserving all technical substance, file paths, decisions, and next steps.
- [ ] AC-2: When cave mode is disabled, the compaction prompt is identical to upstream Pi's unmodified compaction prompt.
- [ ] AC-3: Branch summarization uses the same cave-mode-aware prompt modification as conversation compaction.
- [ ] AC-4: A compaction triggered during an active cave mode session produces a summary that is at least 20% shorter (in character count) than the same compaction with cave mode off, given identical input.

### R5: Tool Result Compression

**Description:** When cave mode's tool compression setting is enabled, tool execution output is post-processed to reduce token consumption before being added to the conversation history. Compression applies heuristics such as stripping ANSI codes, collapsing blank lines, extracting summary lines from verbose commands, and truncating long outputs.

**Acceptance Criteria:**
- [ ] AC-1: When tool compression is enabled, ANSI color/formatting codes are stripped from tool output before it enters the conversation.
- [ ] AC-2: When tool compression is enabled, consecutive blank lines in tool output are collapsed to a single blank line.
- [ ] AC-3: When tool compression is enabled, outputs exceeding a configured character threshold are truncated with head and tail preservation (showing the beginning and end while omitting the middle).
- [ ] AC-4: When tool compression is disabled, tool output passes through unmodified (matching upstream Pi behavior).
- [ ] AC-5: Tool compression never alters the exit code or error status of the underlying command.

### R6: Graceful Degradation

**Description:** All cave mode features are independently disablable and fail gracefully. Disabling cave mode produces behavior identical to upstream Pi.

**Acceptance Criteria:**
- [ ] AC-1: With cave mode fully disabled (enabled=false), the agent's behavior in system prompt, compaction, and tool output is identical to upstream Pi.
- [ ] AC-2: If the tool compression post-processor encounters an error, the original unmodified output is used as a fallback.

## Out of Scope

- RTK binary integration (external dependency management) -- the blueprint specifies built-in heuristic compression only
- CaveKit extension's use of caveman in subagent prompts -- see blueprint-extension-commands
- The caveman-cn (Chinese) variant
- Morphe Compact API integration

## Cross-References

- blueprint-fork-identity: Provides the CLI binary, settings infrastructure, and package identity that cave mode builds on
- blueprint-extension-core: The extension's compaction hook (R5 in extension-core) interacts with cave mode's compaction modifications
- blueprint-extension-commands: The /ck:build command can apply caveman to subagent prompts independently of the fork's native cave mode
- PRD reference: Part 1 sections 1.2, 1.3, 1.4
- Caveman SKILL.md: Source of truth for intensity levels and communication rules
- RTK Architecture: Source of truth for compression strategies (heuristic subset adopted here)

## Changelog

| Date | Change |
|------|--------|
| 2026-04-08 | Initial draft |
