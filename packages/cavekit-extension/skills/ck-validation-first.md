# CaveKit Validation-First

Write the acceptance criteria and validation tests before writing implementation code. This ensures clarity on what "done" means and prevents scope creep.

## Approach

- Define ACs in DESIGN.md before opening any source file
- Use `acceptance_check` to validate each AC independently
- A feature is not done until all its ACs pass validation
- Failing ACs surface misunderstandings early, when they are cheap to fix
