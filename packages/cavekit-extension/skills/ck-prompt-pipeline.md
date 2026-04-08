# CaveKit Prompt Pipeline

A structured sequence of prompts that guides the agent through a predictable workflow, reducing hallucination and ensuring consistent output quality.

## Pipeline Stages

1. **Clarify** — restate the task in the agent's own words and confirm understanding
2. **Plan** — enumerate the steps before executing any of them
3. **Execute** — carry out each step, emitting structured progress
4. **Verify** — run acceptance checks after each logical unit of work
5. **Summarize** — produce a concise completion report for the orchestrator
