"""Terminal-Bench adapter for the cave coding agent CLI.

Wraps `cave -p "<prompt>" --output json --model gpt-5.4 --cave-mode full` and
parses cave's `message_end.usage` JSONL events for token accounting. Token
parsing logic mirrors the proven implementation in
packages/coding-agent/test/benchmarks/live-ab.test.ts (lines 141-159) so the
two paths agree by construction.

The adapter conforms to terminal-bench's AbstractInstalledAgent interface:
  * name: agent identifier surfaced in tb's results.
  * setup_commands: shell commands to install/configure the agent in the
    sandbox container (executed once before the agent runs).
  * agent_command: shell command that actually runs the agent against a task
    prompt; tb captures stdout/stderr.
  * parse_log / token_usage: post-run hooks that scrape the captured output
    for tokens, turns, and cost.
"""

from __future__ import annotations

import json
import os
import shlex
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

try:
    from terminal_bench.agents.installed_agents.abstract_installed_agent import (
        AbstractInstalledAgent,
    )
    from terminal_bench.agents.failure_mode import FailureMode
except Exception:  # pragma: no cover — TB not installed at lint time
    AbstractInstalledAgent = object  # type: ignore[assignment,misc]
    FailureMode = object  # type: ignore[assignment,misc]


@dataclass
class CaveUsage:
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    cost: float = 0.0
    turns: int = 0


def parse_cave_jsonl(stream: Iterable[str]) -> CaveUsage:
    """Parse cave's JSONL event stream and aggregate usage.

    Mirrors live-ab.test.ts:141-159 exactly:
      * Iterate over lines (skipping blanks).
      * For each line that JSON-parses to a `message_end` event with
        `message.role == "assistant"`, increment turns and add usage.
    """
    out = CaveUsage()
    for raw in stream:
        line = raw.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("type") != "message_end":
            continue
        message = event.get("message") or {}
        if message.get("role") != "assistant":
            continue
        out.turns += 1
        usage = message.get("usage") or {}
        out.input_tokens += int(usage.get("input") or 0)
        out.output_tokens += int(usage.get("output") or 0)
        out.cache_read_tokens += int(usage.get("cacheRead") or 0)
        out.cache_write_tokens += int(usage.get("cacheWrite") or 0)
        cost = (usage.get("cost") or {}).get("total")
        if isinstance(cost, (int, float)):
            out.cost += float(cost)
    return out


@dataclass
class CaveTbAgent(AbstractInstalledAgent):  # type: ignore[misc]
    """Cave adapter."""

    model: str = "gpt-5.4"
    cave_mode: str = "full"
    thinking: str = "high"
    extra_args: tuple[str, ...] = field(default_factory=tuple)

    # ---- AbstractInstalledAgent interface ---------------------------------

    @property
    def name(self) -> str:  # pragma: no cover — trivial
        return "cave"

    @property
    def setup_commands(self) -> list[str]:
        # Cave is preinstalled in the agent's Dockerfile (see ./Dockerfile).
        # Auth file is mounted from the host (subscription mode) or written
        # from OPENAI_API_KEY here (api-key mode).
        cmds: list[str] = ["mkdir -p ~/.config/cave"]
        if "OPENAI_API_KEY" in os.environ and not Path(os.path.expanduser("~/.config/cave/auth.json")).exists():
            cmds.append(
                "printf '{\"openai\":{\"apiKey\":\"%s\"}}' \"$OPENAI_API_KEY\" > ~/.config/cave/auth.json"
            )
        return cmds

    def agent_command(self, prompt: str) -> str:
        # `--output json` switches cave to JSONL mode where each event is one
        # line — that's the format parse_cave_jsonl expects.
        parts = [
            "cave",
            "-p",
            shlex.quote(prompt),
            "--output",
            "json",
            "--model",
            shlex.quote(self.model),
            "--cave-mode",
            shlex.quote(self.cave_mode),
            "--thinking",
            shlex.quote(self.thinking),
            *map(shlex.quote, self.extra_args),
        ]
        return " ".join(parts)

    # ---- Post-run hooks ---------------------------------------------------

    def parse_log(self, log_text: str) -> CaveUsage:
        return parse_cave_jsonl(log_text.splitlines())

    def token_usage(self, log_text: str) -> dict:
        usage = self.parse_log(log_text)
        return {
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "cache_read_input_tokens": usage.cache_read_tokens,
            "cache_creation_input_tokens": usage.cache_write_tokens,
            "cost": usage.cost,
            "turns": usage.turns,
        }

    def failure_mode(self, log_text: str, exit_code: int) -> "FailureMode | None":
        if exit_code != 0:
            return FailureMode.AGENT_RUNTIME_ERROR  # type: ignore[attr-defined]
        return None
