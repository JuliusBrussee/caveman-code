# Raw Findings: Web Best Practices & Existing Art

Key findings:
- Claude Code hooks: 4 types (command/http/prompt/agent), 30+ events, PreToolUse can rewrite inputs
- Security: CVE-2025-59536 RCE via hooks — quote paths, validate inputs
- Plugin structure: .claude-plugin/plugin.json manifest, commands/agents/skills/hooks/.mcp.json
- Viral launch: HN Show HN is #1 channel, founder must engage 50+ comments
- Zero-config principle: Ollama grew 261% by "just works" approach
- Token optimization: output tokens cost 4-6x more than input, prompt caching gives 90% savings on hits
- Lazy tool discovery: only load relevant tools per task (OpenDev paper)
- Instruction fade-out: real failure mode in long sessions, needs event-triggered reminders
- SDD spec adherence: unsolved problem, hook-layer enforcement is unique opportunity
- Agentic patterns: Anthropic recommends simplest first, Google defines 9 patterns
- Community: Discord + GitHub Discussions, not Slack
- Gamification: Duolingo streaks most impactful single feature, leaderboards +60% stickiness
- Multi-platform distribution mandatory: Homebrew + npm + curl installer + standalone binaries
- awesome-X lists are viral flywheel — get listed within first week
