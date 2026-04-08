# Git as Agent Working Memory

This reference document explains how AI agents use git as persistent memory across iteration cycles without conversation history.

## Core Principle

> "Commit often, push only when a human says so."

Since each iteration starts fresh without prior context, git commits serve as checkpoints that preserve project state and document progress through commit messages and diffs.

## Essential Patterns

**Iteration Start Sequence:**
Agents should begin each cycle by reading git status, reviewing recent commits (via `git log --oneline -20`), and examining recent diffs. This provides complete context without relying on conversation memory.

**Commit Strategy:**
Make commits after completing features, fixing bugs, passing tests, or reaching significant checkpoints—especially before attempting uncertain approaches. Commit messages should follow conventional formats (feat, fix, test, refactor, wip) with clear descriptions of what changed and why.

**Experimental Work:**
Create isolated branches (`experiment/{description}`) when trying uncertain approaches. If successful, merge to main; if unsuccessful, delete the branch and document the failure in implementation tracking to prevent future retry attempts.

## Why This Works

Git's local nature allows frequent committing without server overhead. The combination of commit messages, diffs, and status checks gives agents complete project understanding—replacing conversation history as the mechanism for cross-iteration continuity.

The key insight: *Your version control system becomes your agent's working memory.*
