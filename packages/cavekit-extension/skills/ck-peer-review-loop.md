# CaveKit Peer Review Loop

An iterative review cycle that runs until all findings are resolved and all ACs pass, without human intervention between rounds.

## Loop Structure

```
Build → Review → [findings?] → Revise → Review → ... → Done
```

- Maximum loop iterations are configurable to prevent infinite loops
- Each round's findings are accumulated, not replaced
- A round is clean when zero new HIGH/CRITICAL findings are raised
- The loop exits cleanly or escalates to the user after max iterations
