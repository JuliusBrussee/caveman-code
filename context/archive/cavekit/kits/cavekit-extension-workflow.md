---
cavekit: extension-workflow
version: 1.0.0
status: approved
created: 2026-04-11
updated: 2026-04-11
---

# Cavekit: Extension Workflow

## Scope

Behavioral requirements for the CaveKit extension's build orchestration: tier gate review UX, build site discovery, site slug sanitization, wave commit behavior, executor dispatch strategy, and prompt constraints for agent-generated files. These are the invariants that distinguish a correct CaveKit session from one that silently produces incorrect artifacts.

## Requirements

### R1: Two-Pane Tier Gate Review Overlay

**Description:** When a wave's tier gate review is blocked (P0/P1 findings), the extension must present a two-pane review overlay so the user can read findings in context before deciding to approve or abort. A simple yes/no confirm dialog is insufficient.

**Acceptance Criteria:**
- [ ] `packages/cavekit-extension/src/widgets/tier-gate-overlay.ts` exports `showTierGateOverlay(tier, findings, ctx)` returning `"approve" | "abort"`
- [ ] The overlay renders findings with their severity, description, and requirement ref visible
- [ ] The executor checks the return value: if `!== "approve"`, all pending tasks are marked blocked and execution stops
- [ ] A non-interactive fallback path exists (e.g., when `ctx.ui.custom` is unavailable) that defaults to blocking

**Dependencies:** None

### R2: Two-Pane Kit Review Overlay

**Description:** The `/ck:architect` review step must present kit files via the same two-pane overlay pattern (markdown content + metadata) so reviewers can approve or reject each kit individually.

**Acceptance Criteria:**
- [ ] `packages/cavekit-extension/src/widgets/review-pane.ts` exports `showReviewOverlay(items, ctx)` returning a `ReviewResult`
- [ ] `ReviewItem` has fields: `id`, `title`, `markdownContent`, `metadata`, `status`, `filePath?`
- [ ] `ReviewResult` has fields: `items` (array of `{id, status}`), `dismissed` (bool)
- [ ] `kit-reviewer.ts` uses `showReviewOverlay` instead of inline prompts or confirm dialogs
- [ ] `ReviewItem` and `ReviewResult` types are exported from `packages/cavekit-extension/src/types.ts`

**Dependencies:** R1

### R3: Build Site Discovery

**Description:** The `/ck:build` command must locate the active build site by scanning for `build-site.md` or `build-site-*.md` files and selecting the most recently modified one. Hardcoded single-path lookups are insufficient for multi-site workflows.

**Acceptance Criteria:**
- [ ] `findBuildSite(cwd, override?)` scans `context/plans/` and `context/sites/` for files matching `/^build-site(-[\w-]+)?\.md$/`
- [ ] When multiple matches exist, the file with the highest `mtime` is selected
- [ ] An explicit `override` path (absolute or relative) bypasses the scan entirely
- [ ] When no matching file is found in either directory, the function returns `null`
- [ ] The build command shows a warning referencing `context/plans/` (not a hardcoded filename) when no site is found

**Dependencies:** None

### R4: Build Site Slug Sanitization

**Description:** When the `/ck:architect` command receives an argument to name the output build site, dialog responses ("yes", "continue", "ok", etc.) must not be accepted as valid slugs. The slugifier must reject such inputs and fall back to `build-site`.

**Acceptance Criteria:**
- [ ] `sanitizeSiteName(raw)` rejects inputs matching `/^(yes|no|ok|continue|cancel|confirm|y|n)\b/i` → returns `""`
- [ ] Non-rejected strings are slugified: lowercased, non-alphanum runs replaced with `-`, leading/trailing `-` stripped
- [ ] The resulting slug is prefixed with `build-site-` unless it already starts with `build-site`
- [ ] Empty raw input and rejected patterns both cause the caller to fall back to `"build-site"` as the site name

**Dependencies:** None

### R5: Wave Commit Behavior

**Description:** After each wave completes, the executor must commit all changes (tracked modifications AND new untracked files in `context/` and `packages/`) using an explicit `git add`, and must skip the commit entirely when nothing is staged.

**Acceptance Criteria:**
- [ ] `commitWave` uses `git add context/ packages/` (not `git add -u`) so new impl tracking files are included
- [ ] Before committing, `git diff --cached --stat` is checked; if empty, the commit is skipped
- [ ] The commit message follows the pattern `chore(build): wave N — T-001, T-002, ...`
- [ ] The commit does not use `--allow-empty` — only real changes produce a commit

**Dependencies:** None

### R6: Executor Dispatch via Embedded SDK Sessions

**Description:** Wave task dispatch must use `createAgentSession()` from the `cave` peer dependency rather than spawning child `cave` processes. Embedded sessions share RTK hooks, extension hooks, and auth context with the host process.

**Acceptance Criteria:**
- [ ] `WaveExecutor.dispatchTask()` calls `createAgentSession({ cwd, sessionManager })` via dynamic `import("cave")`
- [ ] The session is run with `session.prompt(prompt)` and text output is captured via `session.subscribe()`
- [ ] On failure, `dispatchTask` returns `false` and writes an error impl record — it does not rethrow
- [ ] Child `spawn` calls (the previous Phase 1 dispatch) no longer exist in `executor.ts`
- [ ] The task prompt instructs the agent to "Write all file content directly using the write or edit tool. Do NOT use Python, Node, or external scripts to generate content."

**Dependencies:** R5 (wave commit relies on impl files written by the embedded session)

### R7: Prompt Constraints for Inline File Writing

**Description:** Agent prompts generated by architect, draft, and build commands must explicitly prohibit using external scripts (Python, Node, bash pipelines) to write files. All file content must be composed inline and written via the `write` or `edit` tool.

**Acceptance Criteria:**
- [ ] The architect prompt contains: "Write ALL content directly using the write tool. Do NOT use Python, Node, or any external scripts to generate content."
- [ ] The draft prompt contains the same constraint block
- [ ] The build task prompt contains: "Write all file content directly using the write or edit tool. Do NOT use Python, Node, or external scripts to generate content."
- [ ] These constraint blocks appear before the main task body in each prompt

**Dependencies:** None

## Out of Scope

- RTK rewriting within embedded sessions (covered by cavekit-rtk-integration R4/R5)
- Kit parsing or validation logic (cavekit format is stable)
- Build site schema/format specification (out of scope for this behavioral kit)
- Tier gate finding generation (the inspection phase that produces findings)
- Wave dependency graph calculation (parsing logic, not orchestration behavior)

## Cross-References

- [cavekit-rtk-integration](cavekit-rtk-integration.md): R4/R5 cover RTK hook wiring in both the main agent and extension shell calls
- `packages/cavekit-extension/src/wave/executor.ts` — WaveExecutor implements R5, R6
- `packages/cavekit-extension/src/commands/architect.ts` — implements R4, R7
- `packages/cavekit-extension/src/commands/build.ts` — implements R3, R5
- `packages/cavekit-extension/src/commands/draft.ts` — implements R7
- `packages/cavekit-extension/src/widgets/review-pane.ts` — implements R1, R2
- `packages/cavekit-extension/src/widgets/tier-gate-overlay.ts` — implements R1
- `packages/cavekit-extension/src/widgets/kit-reviewer.ts` — implements R2

## Changelog

### 2026-04-11 — Initial
- **Affected:** R1–R7 (all new)
- **Summary:** New kit created from manual fixes in `c9b51197` and `1c8be759`. No prior kit covered CaveKit extension orchestration behavior. Fixes traced: two-pane review overlay (R1, R2), build site discovery (R3), slug sanitization (R4), wave commit behavior (R5), embedded SDK executor (R6), prompt constraints (R7).
- **Commits:** c9b51197, 1c8be759
