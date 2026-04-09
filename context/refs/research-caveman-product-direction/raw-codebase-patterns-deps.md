# Raw Findings: Codebase Patterns & Dependencies

Key findings:
- TypeScript strict ESM, tab-indented, 120-char, Biome-enforced
- No `any` types (cultural rule), no inline imports, configurable keybindings
- Skills: markdown+YAML frontmatter, 3-scope discovery (user/project/explicit)
- Extensions: jiti-loaded TS, ExtensionAPI with 20+ typed lifecycle events, two-phase init
- Cave mode: system prompt injection (lite/full/ultra) + tool output compression (ANSI strip, blank collapse, truncation) + RTK external binary (200ms timeout, fail-open)
- Compaction: LLM-generated summarization, chars/4 token estimation, structured summary format
- CaveKit: 4-phase DABI lifecycle, markdown kits with R{N} headings, build sites with tier/task DAG, wave executor with child process dispatch, tier gates with codex review
- Dependencies: Anthropic/OpenAI/Google/AWS/Mistral SDKs, TypeBox for schemas, jiti for extension loading, proper-lockfile for settings
- Markdown preview: puppeteer-core → Chrome → PNG → Kitty terminal images
- DESIGN.md auto-injected into all subagent sessions
