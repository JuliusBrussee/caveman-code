---
name: ck-revision
description: Revise implementation systematically from findings, feedback, and failing acceptance criteria.
---

# CaveKit Revision

Structured approach to revising existing implementation in response to review findings, user feedback, or failing ACs.

## Process

1. Read all open findings before touching any code
2. Group findings by affected file or component
3. Revise in order of severity (CRITICAL → HIGH → MEDIUM → LOW)
4. Re-run acceptance checks after each fix — do not batch fixes and check once
5. Update the kit's task status when each finding is resolved
