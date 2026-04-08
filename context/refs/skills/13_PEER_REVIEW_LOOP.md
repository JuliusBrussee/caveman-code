# Peer Review Loop

The **Peer Review Loop** combines Cakekit specifications with Claude's building capabilities and Codex's adversarial review process. This creates a rigorous quality mechanism where two different AI models challenge each other's work.

## Core Mechanism

Claude implements features based on cavekit requirements while Codex conducts independent code reviews. As stated in the documentation, this approach recognizes that "two models catch different classes of issues" compared to single-model iteration.

## Two Invocation Paths

1. **Codex CLI (Primary)** — Direct delegation via `codex-review.sh` script for faster execution without MCP server overhead
2. **MCP Server (Legacy)** — Fallback configuration when CLI unavailable

The build script automatically detects which approach to use based on available tools.

## Iteration Pattern

The loop alternates between build and review phases:
- **Build iterations**: Claude implements cakekit requirements
- **Review iterations**: Codex examines code and reports findings by severity level
- **Fix iterations**: Claude addresses CRITICAL and HIGH severity issues

## Completion Requirements

The process concludes when all of these conditions are met: cakekit requirements implemented, acceptance criteria pass, no unfixed CRITICAL/HIGH findings remain, and at least one clean review cycle completes.

## Key Options

- `--review-interval` — Control review frequency (default: every 2nd iteration)
- `--codex-model` — Specify OpenAI model (gpt-5.4 default)
- `--review-only` — Review existing code without building new features
