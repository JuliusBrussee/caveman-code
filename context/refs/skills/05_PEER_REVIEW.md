# Peer Review Pattern

This guide presents a systematic approach to quality assurance using a second AI agent to critique the primary builder's work.

## Core Concept

The fundamental principle is clear: **"The peer reviewer's job is to find what the builder missed, not to agree."** Rather than rubber-stamping outputs, the reviewer actively hunts for gaps, vulnerabilities, and oversights that the original agent overlooked.

## Six Review Modes

The pattern identifies distinct strategies for different scenarios:

1. **Diff Critique** — Inspecting completed code changes for defects
2. **Design Challenge** — Critiquing architecture plans before implementation
3. **Threaded Debate** — Extended multi-turn discussions on complex trade-offs
4. **Delegated Scrutiny** — Assigning peer review coordination to a dedicated agent
5. **Deciding Vote** — Using peer review to break ties between competing approaches
6. **Coverage Audit** — Evaluating test quality and identifying untested scenarios

## Implementation via MCP

The setup uses Model Context Protocol servers, allowing any compliant AI model to serve as reviewer through two core tools: session initiation and multi-turn replies. This makes the pattern model-agnostic.

## Convergence Through Iteration

Rather than one-time reviews, the pattern advocates alternating build-review cycles where findings drive improvements until diminishing returns occur—detected when findings drop to negligible severity levels.

## Key Safeguards

The guide explicitly warns against common failures: reviewers becoming passive, rewriting instead of identifying issues, builders dismissing findings, and using identical models with identical prompts for both roles.
