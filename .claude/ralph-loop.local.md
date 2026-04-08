---
active: true
iteration: 1
session_id: 479aa1fc-aed4-4ebb-affe-810446b1a4c2
max_iterations: 20
completion_promise: "BLUEPRINT COMPLETE"
started_at: "2026-04-08T11:26:08Z"
---

# Blueprint Build

## Your Role
You are implementing tasks from a build site. Each iteration: find the next
unblocked task, read its blueprint, implement it, validate, commit.

## Read These First (every iteration)
1. `context/impl/loop-log.md` — your iteration history (if exists)
2. `context/plans/build-site.md` — the task dependency graph
3. Impl tracking files in `context/impl/` — but ONLY files that are scoped to this build site.
   An impl file is scoped if it contains `Build site: context/plans/build-site.md` (or the matching basename).
   Ignore impl files that declare a different build site. If no scoped files exist, read all impl files.

## Blueprints (read when implementing a specific requirement)

- `context/blueprints/blueprint-cave-mode.md`
- `context/blueprints/blueprint-extension-commands.md`
- `context/blueprints/blueprint-extension-core.md`
- `context/blueprints/blueprint-extension-ui.md`
- `context/blueprints/blueprint-fork-identity.md`
- `context/blueprints/blueprint-overview.md`
false_SECTION
## Each Iteration

### 1. Orient
- Read loop-log.md and impl tracking to know what's done
- Read the build site to find the lowest tier with incomplete tasks

### 2. Pick Task
- Find the next unblocked task (all blockedBy tasks are DONE)
- Among equals, pick the one that unblocks the most downstream work

### 3. Implement
- Read the task's blueprint requirement and acceptance criteria
- Implement it, following existing codebase patterns
- One task per iteration

### 4. Validate
1. **Build** — must compile/pass
2. **Tests** — on changed files, must pass
3. **Acceptance criteria** — each criterion from the spec must be met

If stuck 2+ attempts → document as dead end, move on.

### 5. Track
Update `context/impl/impl-{domain}.md` (create if missing):

```markdown
---
created: "{CURRENT_DATE_UTC}"
last_edited: "{CURRENT_DATE_UTC}"
---
# Implementation Tracking: {domain}

Build site: context/plans/build-site.md

| Task | Status | Notes |
|------|--------|-------|
| T-001 | DONE | what was done |
```

The `Build site:` line is REQUIRED — it scopes this impl file to the correct build site
so task IDs don't collide across different build sites.

Append to `context/impl/loop-log.md` (create if missing):

```markdown
### Iteration N — {timestamp}
- **Task:** T-{id} — {title}
- **Tier:** {n}
- **Status:** DONE / PARTIAL / BLOCKED
- **Files:** {changed files}
- **Validation:** Build {P/F}, Tests {P/F}, Acceptance {n/n}
- **Next:** T-{id} — {next task}
```

### 6. Commit
Descriptive message with task ID and blueprint requirement. Do NOT push.

### 7. Done?
All tasks across all tiers DONE + build passes + tests pass?
→ output: <promise>BLUEPRINT COMPLETE</promise>

Otherwise → next iteration.

## CRITICAL: Do NOT falsely mark tasks as DONE

**NEVER mark a task DONE because 'existing code already handles this'.**
A task is DONE only when you have:
1. Written or modified code specifically for this task's acceptance criteria
2. Verified EACH acceptance criterion individually (not 'it looks like it works')
3. Written or run tests that prove the criteria are met

If existing code partially covers a requirement, implement the MISSING parts.
If it fully covers every criterion, write a test proving it and document exactly
which existing code satisfies which criterion — with file paths and line numbers.

## Rules
1. NEVER output completion promise unless ALL tasks are genuinely DONE
2. ONE task per iteration
3. Stuck 2+ iterations → dead end, move on
4. Re-read build site and tracking every iteration
5. Commit after each task
6. NEVER skip implementation because code 'looks related'
