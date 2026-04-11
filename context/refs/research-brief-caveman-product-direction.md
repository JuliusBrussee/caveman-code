# Research Brief: Caveman CLI Product Direction

**Generated:** 2026-04-10
**Agents:** 4 codebase, 3 web
**Sources consulted:** 50+ URLs/repos referenced

## Summary

Caveman CLI is a standalone agentic coding CLI (fork of pi-mono) with a genuine technical differentiator in its 3-layer token compression ("cave mode"), but faces significant risks from pre-release toolchain dependencies (tsgo 7.0.0-dev), an incomplete rebrand from the upstream project, and feature sprawl (CaveKit DABI) before core adoption is established. The competitive landscape is crowded and fast-moving — Cursor, Windsurf, Aider, and Copilot all have massive head starts — meaning Caveman's path to traction depends on quantified, reproducible token-savings benchmarks (which do not yet exist in-repo) and a friction-free onboarding experience modeled after Ollama's "just works" pattern.

## Key Findings

### Architecture & Patterns

- **Monorepo, 10 packages, single binary entry (`cave`/`pi` aliases)** — build uses tsgo (TS 7.0.0-dev preview), Biome 2.3.5 for linting, Bun 1.2.20 for binary compilation. [confidence: HIGH] [sources: 4 codebase agents unanimous]
- **Cave mode is 3-layer compression: system prompt injection (lite/full/ultra) + tool output compression (ANSI strip, blank collapse, truncation) + optional RTK binary (200ms timeout, fail-open).** This is the primary differentiator. [confidence: HIGH] [sources: 3]
- **Extensions use jiti-loaded TypeScript with an ExtensionAPI factory pattern exposing 20+ lifecycle events.** No MCP support by design. [confidence: HIGH] [sources: 2]
- **Config discovery walks up the directory tree for .cave/, AGENTS.md, CLAUDE.md with deep-merge semantics.** Dual .pi/.cave directory naming persists from incomplete rebrand. [confidence: HIGH] [sources: 2]
- **CaveKit implements a 4-phase DABI lifecycle with markdown kits, R{N} headings, build sites with tier/task DAGs, and a wave executor.** This is architecturally ambitious but adds substantial maintenance surface. [confidence: HIGH] [sources: 2]
- **Skills use markdown+YAML frontmatter with 3-scope discovery (user/project/explicit).** Consistent with the broader ecosystem pattern (awesome-cursorrules has 39K stars showing curation demand). [confidence: HIGH] [sources: 2]
- **RTK integration has external binary dependency with 200ms timeout and fail-open semantics.** RTK itself has 21.8K GitHub stars and claims 80% token reduction. [confidence: MEDIUM] [sources: 2]

### Library Landscape

- **Recommended: RTK for compression** — 21.8K stars, 80% reduction claimed, already integrated with fail-open semantics. However, prompt compression specifically degrades on code-structured inputs, and no published benchmarks exist for code-specific agentic compression. [confidence: MEDIUM]
- **Recommended: Vitest for testing** — already in use across coding-agent and ai packages, ~150 test files, ~28K lines. Solid foundation but no coverage tooling configured. [confidence: HIGH]
- **Alternative: LLMLingua for compression** — claims 20x compression with only 1.5% performance loss, but this is general NLP, not code-specific agentic use. [confidence: LOW]
- **Avoid: MCP integration at this stage** — the project explicitly chose no-MCP by design. However, this risks isolation from the growing ecosystem standard (9,000+ Claude Code extensions, 101 official). This is a genuine strategic tension, not a clear-cut call. [confidence: MEDIUM]
- **Avoid: Switching from Bun for binaries** — 95-98% Node compat is sufficient for CLI distribution, and the 5-platform binary story works. The remaining 2-5% compat gap is a known risk for edge cases. [confidence: MEDIUM]

### Best Practices

- **Zero-config onboarding is the #1 growth lever.** Ollama grew 261% by "just works" design. Currently, cave mode has no `/cave` toggle command — users must edit settings.json manually. This is a friction point that directly undermines virality.
- **Quantified productivity claims are the #1 viral mechanism for CLI tools.** Oh My Zsh (170K stars) and RTK (single viral post) both demonstrate this. Caveman has zero in-repo benchmarks for token savings despite this being the core value proposition.
- **Output tokens cost 4-6x more than input tokens; prompt caching gives 90% savings on cache hits.** Cave mode's compression layers should be evaluated against this cost asymmetry — compressing outputs may be more valuable than compressing inputs.
- **Show HN is the #1 launch channel for developer tools, but superlatives ("most viral", "best") cause immediate tab-close.** Evidence-led framing with concrete numbers is required. The PRD's "most viral" language needs revision for public-facing copy.
- **Instruction fade-out is real in long agentic sessions.** Event-triggered reminders (already partially implemented via DESIGN.md auto-injection into subagent sessions) are the correct mitigation.
- **Lazy tool discovery (only load relevant tools per task) reduces token overhead.** OpenDev paper documents this pattern.

### Existing Art

- **Aider (43K stars, 88% self-written)** — demonstrates that a CLI-first agentic tool can achieve massive adoption without IDE integration. Its self-hosting story ("88% written by itself") is a powerful credibility signal Caveman could emulate.
- **Cursor (73.6% VS Code market share)** — shows the ceiling for IDE-integrated approaches. Caveman's standalone CLI positioning avoids this competitive moat.
- **awesome-cursorrules (39K stars)** — proves that curation repositories for agentic tool configurations go viral. A curated "awesome-cave-skills" or similar could be a growth flywheel.
- **Kiro (Amazon)** — documented SDD tool that generated 5,000 lines for an 800-line task (6x over-engineering). Validates the SDD opportunity but warns against over-generation. CaveKit's DABI approach should learn from this failure mode.
- **Oh My Zsh (170K stars)** — grew entirely through word-of-mouth with zero marketing budget. Key pattern: trivially easy install + immediately visible benefit.

### Pitfalls to Avoid

- **Fork maintenance debt** — 20.5% of upstream patches typically need porting, 36% of adaptations are missed, and 25%+ of security patches are delayed 3+ months. The incomplete rebrand (.pi/.cave duplication, upstream logo in npm README, shittycodingagent.ai references) signals this is already accumulating. [confidence: HIGH]
- **tsgo 7.0.0-dev is not production-ready** — Microsoft explicitly recommends dual-install, Strada API is not supported. Using a pre-release compiler for a production CLI is a concrete risk. [confidence: HIGH]
- **jiti extension loading has an RCE vector** — a malicious git repo can execute code before any prompt is shown. Combined with CVE-2025-59536 (RCE via hooks in Claude Code), this is a security surface that needs sandboxing or at minimum prominent warnings. [confidence: HIGH]
- **Feature creep before core adoption** — CaveKit's 4-phase DABI, wave executor, tier gates, and codex review add substantial surface area. The visual theme overhaul is specified in a kit but unimplemented. The PRD Phase 6 launch plan exists but is unexecuted. Shipping compression benchmarks and a `/cave` toggle would have more impact than any of these. [confidence: HIGH]
- **No-MCP stance risks ecosystem isolation** — the Claude Code plugin ecosystem has 9,000+ extensions and find-skills has 661K+ installs. Being unable to interoperate with any of these is a growing cost. [confidence: MEDIUM]
- **Context drift compounds compression errors** — 5.5x failure increase in complex tasks when compression is applied. Cave mode needs graceful degradation or user-visible warnings for long sessions. [confidence: MEDIUM]
- **OSS session sharing still points to upstream HuggingFace dataset.** The /share command is disabled but the reference remains — a data leak risk if re-enabled without updating. [confidence: HIGH]

## Contradictions & Open Questions

- **MCP support**: The project explicitly rejects MCP by design (codebase agents confirm), but web research shows MCP is becoming the ecosystem standard with 9,000+ extensions. Assessment: This is a genuine strategic bet. The no-MCP stance reduces complexity and attack surface today, but the cost of isolation grows monthly. Recommend revisiting at 6-month intervals or when user demand is measurable. Needs user input on long-term positioning.

- **Token savings claims**: External sources cite RTK at 80% reduction and LLMLingua at 20x compression, but codebase agents found zero in-repo benchmarks. Web research warns that compression degrades specifically on code-structured inputs. Assessment: The core value proposition is currently unvalidated. This is the single highest-priority gap.

- **tsgo viability**: The project depends on tsgo 7.0.0-dev (TypeScript native compiler preview). No codebase agent flagged build failures, suggesting it works today, but web research flags it as explicitly not production-ready. Assessment: It works until it doesn't. Recommend maintaining a tsc fallback path or pinning to a known-good tsgo commit.

- **Distribution completeness**: npm + Bun binaries via GitHub Releases covers the basics, but web research strongly recommends Homebrew + curl installer for viral CLI adoption. Neither exists. Assessment: Homebrew formula should be a pre-launch requirement.

- **Discord confusion**: Two different Discord invite links exist (upstream vs caveman). Assessment: Consolidate immediately; split community is worse than no community.

## Codebase Context

- **Architecture**: Monorepo with 10 packages under @cavepi/ npm scope. Single binary entry point compiles to `cave` and `pi` aliases. Packages span core CLI, TUI (12 terminal primitives, 35 components), AI provider SDKs (Anthropic/OpenAI/Google/AWS/Mistral), CaveKit (SDD/markdown integration), and web-UI (Lit components).

- **Key patterns**: Strict ESM TypeScript, tab-indented, 120-char lines, Biome-enforced. No `any` types (cultural rule). Extensions use jiti-loaded TypeScript with ExtensionAPI factory pattern (two-phase init, 20+ lifecycle events). Skills are markdown+YAML frontmatter with 3-scope discovery. Compaction uses LLM-generated summarization with chars/4 token estimation.

- **Dependencies**: tsgo 7.0.0-dev (build), Biome 2.3.5 (lint), Bun 1.2.20 (binaries), Vitest (test), TypeBox (schemas), jiti (extension loading), proper-lockfile (settings), puppeteer-core (markdown preview via Chrome to PNG to Kitty terminal images). Five AI provider SDKs.

- **Test coverage**: ~150 test files, ~28K lines across Vitest (coding-agent, ai packages) and Node built-in (tui). No coverage tooling configured. No token savings benchmarks. CI runs on GitHub Actions (push/PR), requires system deps (cairo, pango), runs without API keys. PR gate auto-closes unapproved contributors with an OSS weekend gate.

- **Brand state**: Incomplete rebrand. Dual .pi/.cave config directories. Package gallery at shittycodingagent.ai. Upstream logo in npm README. OSS session sharing points to upstream HuggingFace. Two Discord links.

## Implications for Design

- **Benchmark before you launch.** The single most impactful pre-launch work item is a reproducible token-savings benchmark suite comparing cave mode (all 3 layers) against baseline on real coding tasks. Without this, the core value proposition is marketing copy, not evidence. Every viral mechanism identified in web research depends on quantified claims.

- **Ship a `/cave` toggle command.** Zero-config is the #1 growth pattern. Requiring users to edit settings.json to enable the product's core feature is an anti-pattern. A simple `/cave [lite|full|ultra|off]` command with sensible defaults would eliminate the largest onboarding friction point.

- **Defer CaveKit complexity.** The 4-phase DABI lifecycle, wave executor, and tier gates are architecturally interesting but spread maintenance surface before core adoption exists. Recommend freezing CaveKit at current functionality and focusing engineering time on compression quality, benchmarks, and distribution.

- **Address the security surface.** jiti extension loading from arbitrary git repos and the broader hooks RCE pattern (CVE-2025-59536) represent real attack vectors. At minimum, add a confirmation prompt before loading extensions from untrusted sources. This is a pre-launch blocker for any security-conscious adopter.

- **Complete the rebrand.** The dual .pi/.cave naming, upstream logos, shittycodingagent.ai references, and split Discord links create confusion that undermines trust. This is mechanical work but it compounds reputational cost daily.

- **Add Homebrew distribution.** npm + GitHub Release binaries cover existing users. Homebrew covers discovery. `brew install caveman` is table stakes for CLI tool virality.

- **Plan for fork maintenance.** Establish a regular upstream sync cadence (weekly or bi-weekly) with a documented porting checklist. The 20.5% patch-porting and 25% security-delay statistics from fork research are not hypothetical — they are base rates.

- **Validate tsgo with a fallback.** Either pin to a known-good tsgo commit with CI verification, or maintain a parallel tsc build path. A pre-release compiler failure at launch time would be catastrophic.

- **Revisit MCP at a defined milestone.** Set a concrete trigger (e.g., 10 user requests, or 6 months post-launch) to re-evaluate the no-MCP stance. Document the current rationale so the future decision is informed rather than reactive.

## Sources

Web sources referenced across research agents (representative, not exhaustive):

- [RTK](https://github.com/rtk-ai/rtk) — 21.8K stars, token compression baseline and viral case study
- [LLMLingua](https://github.com/microsoft/LLMLingua) — academic compression benchmarks (EMNLP 2023, ACL 2024)
- [Aider](https://github.com/Aider-AI/aider) — 43K star CLI-first agentic tool, adoption patterns
- [awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules) — 39K stars, viral curation repository pattern
- [Ollama growth](https://www.landbase.com/blog/fastest-growing-open-source-dev-tools) — 261% growth case study for zero-config design
- [CVE-2025-59536](https://research.checkpoint.com/2026/rce-and-api-token-exfiltration-through-claude-code-project-files-cve-2025-59536/) — RCE via Claude Code hooks, security precedent
- [Kiro SDD](https://dev.to/aws-builders/what-i-learned-using-specification-driven-development-with-kiro-pdj) — SDD over-generation failure mode
- [Anthropic agent patterns](https://www.anthropic.com/research/building-effective-agents) — simplest-first recommendation
- [Anthropic harness guide](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) — Ralph Loop and false completion patterns
- [Google agent whitepaper](https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system) — 9 agentic design patterns taxonomy
- [OpenDev paper](https://arxiv.org/html/2603.05344v1) — lazy tool discovery for token optimization
- [Claude Code hooks docs](https://code.claude.com/docs/en/hooks) — 4 hook types, 30+ events, extension patterns
- [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces) — 9K+ extensions, distribution model
- [Claude marketplace stats](https://claudemarketplaces.com/) — find-skills at 661K installs
- [SDD at Thoughtworks](https://www.thoughtworks.com/insights/blog/agile-engineering-practices/spec-driven-development-unpacking-2025-new-engineering-practices) — key 2025 practice, 3 maturity levels
- [SDD tools comparison (Martin Fowler)](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) — Kiro/Spec-Kit/Tessl analysis
- [SDD waterfall critique](https://marmelab.com/blog/2025/11/12/spec-driven-development-waterfall-strikes-back.html) — 6x over-engineering, double review tax
- [HN launch guide](https://www.markepear.dev/blog/dev-tool-hacker-news-launch) — evidence-led framing, no superlatives
- [Oh My Zsh origin](https://www.opensourcestories.org/stories/2023/robby-russell-ohmyzsh/) — word-of-mouth viral pattern
- [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — 90% savings on cache hits
- [Token optimization](https://redis.io/blog/llm-token-optimization-speed-up-apps/) — output tokens 4-6x more expensive
- [Fork maintenance research](https://arxiv.org/html/2404.17964v1) — 20.5% patch porting, 36% missed adaptations
- [tsgo status](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/) — not production-ready, dual-install recommended
- [Bun production risks](https://dev.to/wojtekmaj/why-using-bun-in-production-maybe-isnt-the-best-idea-3deb) — 95-98% Node compat
- [Maintainer burnout](https://byteiota.com/open-source-maintainer-crisis-60-unpaid-burnout-hits-44/) — 60% unpaid, 44% burnout
- [Agent drift](https://www.chanl.ai/blog/agent-drift-silent-degradation) — context flooding and compression drift
- [Prompt compression survey (NAACL 2025)](https://arxiv.org/abs/2410.12388) — code-specific degradation patterns
- [Ink](https://github.com/vadimdemedes/ink) — 37.5K stars, React for CLI, used by Claude Code/Codex/Copilot
- [Bubble Tea](https://github.com/charmbracelet/bubbletea) — 41.4K stars, Go TUI reference
- [Gamification stats](https://studiokrew.com/blog/app-gamification-strategies-2025/) — Duolingo streaks, dynamic achievements
- [Developer communities](https://dasroot.net/posts/2025/12/building-online-developer-communities-discord-slack-forums/) — Discord over Slack
