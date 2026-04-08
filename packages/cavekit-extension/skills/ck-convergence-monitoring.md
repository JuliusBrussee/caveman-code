# CaveKit Convergence Monitoring

Detect and break convergence plateaus — situations where the agent keeps iterating without making measurable progress toward completing acceptance criteria.

## Detection Signals

- Same AC fails validation three turns in a row
- Tool call pattern repeats without change in output
- Turn count exceeds the configured threshold with no new ACs passing

## Intervention Strategies

- Force a `convergence_check` tool call to surface the plateau explicitly
- Switch to a different implementation strategy (document the old one first)
- Escalate to the user with a structured problem statement
