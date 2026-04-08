# CaveKit Peer Review

A structured review process where a second agent (or a second pass of the same agent) evaluates implementation output against the spec.

## Process

1. Build agent produces output and marks task complete
2. Review agent reads the original AC, not the implementation description
3. Reviewer checks each AC independently using `acceptance_check`
4. Findings are filed as structured `Finding` objects with severity
5. Build agent addresses HIGH/CRITICAL findings before proceeding
