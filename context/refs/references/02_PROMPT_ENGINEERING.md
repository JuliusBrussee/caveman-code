# Prompt Engineering Reference

This guide establishes best practices for designing AI agent prompts in Cavekit, a system for managing multi-agent collaborative work on software projects.

## Core Tenets

The reference emphasizes that "prompts should be as lightweight and systemic as possible," with detailed information living in separate kits and plans rather than within prompts themselves. Each Hunt phase gets one dedicated prompt.

## Key Components

**Runtime Variables** make prompts reusable across projects. Instead of hardcoding framework-specific details like `npm run build`, prompts use placeholders such as `{BUILD_COMMAND}` that resolve at execution time.

**Agent Team Structure** requires explicit hierarchy with role definitions, isolation modes, branch assignments, and file ownership tables. The team lead operates in "delegate mode" and never writes code directly, forcing proper task decomposition.

**Concurrency Limits** cap concurrent agents at three to prevent resource degradation and communication overhead.

**Exit Criteria Checklists** prevent agents from stopping prematurely or looping endlessly. When all criteria are met, agents emit a distinctive completion signal: `<all-tasks-complete>`

**File Ownership Tables** eliminate merge conflicts by assigning every shared file to exactly one teammate who can modify it.

**Spawn Templates** ensure fresh agent processes receive all necessary context, including branch names, file ownership, task lists, and validation commands—nothing is assumed about prior knowledge.

**Time Guards** establish budgets (10 minutes for mechanical tasks, 20 minutes for investigation) with mandatory stops and documentation when exceeded.

## Anti-Patterns to Avoid

Common failures include prompts that are too lengthy, missing exit criteria, absent file ownership definitions, no time constraints, hardcoded commands instead of variables, and exceeding three concurrent agents.
