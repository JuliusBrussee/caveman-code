# Raw Findings: Web Pitfalls & Anti-Patterns

Key findings:
- Fork maintenance: 20.5% patches need porting, 36% missed adaptations, 25%+ security patches delayed 3+ months
- Crowded landscape: "Cursor vs Claude Code" searches 10x growth, user confusion between similar tools
- No-MCP stance risks isolation from growing ecosystem standard
- tsgo 7.0.0-dev: not production-ready, Strada API not supported, Microsoft recommends dual-install
- Bun: 95-98% Node compat, remaining 5% can be dealbreaker, native module failures documented
- Prompt compression degrades on code-structured inputs specifically, model-dependent
- No published benchmarks for code-specific agentic compression — credibility risk
- Context drift compounds compression errors: 5.5x failure increase in complex tasks
- Maintainer burnout: 60% unpaid, 44% cite burnout, AI slop PRs exacerbate
- HN: superlatives ("most viral", "best") cause tab-close, evidence-led framing required
- Feature creep: CaveKit's 4-phase DABI spreads maintenance surface before core adoption
- jiti extension loading has RCE vector: malicious git repo → code execution before prompt
- False completion: agents mark tasks done without verification (Kiro documented)
- SDD spec drift: 6-month-stale spec actively misleads agents
- SDD double review tax: spec review + implementation review
- Kiro: 5,000 lines generated for 800-line task (6x over-engineering)
