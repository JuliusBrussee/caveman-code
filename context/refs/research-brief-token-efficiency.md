---
created: "2026-04-16"
last_edited: "2026-04-16"
topic: token-efficiency-and-sota-harness
source: user-provided web research, 6 agents, ~80 sources
---

# Research Brief: Caveman Code — Token Efficiency & SOTA Agent Harness

**Generated:** 2026-04-16
**Agents:** 6 web research agents (prompt compression, prompt caching, coding-agent efficiency, CLI features, harness architecture, DX/ecosystem)
**Sources consulted:** ~80 unique papers, repos, and docs

## Summary

Caveman Code's existing ~65-75% output compression is orthogonal to (and stackable with) every major efficiency technique shipping in 2025 agent CLIs. The highest-leverage path: stack Anthropic prompt caching + architect/editor model routing + tree-sitter repomap (emitted in caveman prose) + Aider-style S/R diffs + executable best-of-N verification. This yields a top-tier SWE-bench Verified score at 30-40% of competitor token budgets — a publishable result and a hiring artifact for OpenAI/Meta inference-time-reasoning teams.

## Key Findings

### Architecture & Patterns (Coding-Agent Harness SOTA)

- **Agentless localization beats agent loops on SWE-bench Verified.** Xia et al. 2024 hit ~50% Verified with zero agent loop via deterministic file→class→line localization. [confidence: HIGH]
- **Planner/executor split with cheap executor is the dominant winning pattern.** Aider architect mode, Lingma SWE-GPT, RepoUnderstander. One big planner call + many cheap execution steps. 3-5x cost reduction at equal accuracy. [confidence: HIGH]
- **AST-addressed edit tools beat unified diff by 8-15pt** on SWE-bench (LocAgent, OpenHands). Symbol-scoped `edit_symbol(file, qualified_name, new_body)` eliminates hunk-apply failures. [confidence: HIGH]
- **Best-of-N with executable verifier** (reproduction test synthesis) beats LLM-judge ranking. Moatless-Tools, SWE-agent 1.0 pattern. [confidence: HIGH]
- **Subagent context isolation** (Claude Code Task tool) collapses 20-40k exploratory tokens into ~500-token summaries. [confidence: HIGH]

### Library Landscape — Compression

- **Recommended: LLMLingua-2** (Microsoft, ACL 2024 Findings) — xlm-roberta token classifier distilled from GPT-4. 2-5x input compression, ONNX-shippable via `onnxruntime-node`. No Python runtime, closed-API compatible. [confidence: HIGH]
- **Recommended: tree-sitter + PageRank repomap** (Aider) — the single most-copied idea in the space. ~1k tokens gives a model a map of 100k-LOC repos. Pure TS reimplementation is straightforward. [confidence: HIGH]
- **Recommended: Provence reranker-pruner** (ICLR 2025) — plug-and-play context pruning for retrieved chunks, 50-80% reduction. Node via ONNX. [confidence: HIGH]
- **Alternative: RECOMP** — extractive+abstractive compressor for RAG paths only. Black-box usable. [confidence: MEDIUM]
- **Avoid for plugin context: Gist Tokens, ICAE, AutoCompressor, Activation Beacon, xRAG, 500xCompressor** — all require model fine-tuning, incompatible with closed APIs. [confidence: HIGH]
- **Avoid for plugin context: KV cache methods (H2O, StreamingLLM, SnapKV, PyramidKV, MInference, Quest)** — infrastructure-level, only relevant if Caveman bundles local inference. [confidence: HIGH]

### Library Landscape — Caching

- **Anthropic prompt caching** — 4 breakpoints, prefix-based (`tools → system → messages`), read cost 0.1x / write 1.25x (5m) / 2x (1h). 90% savings on cached prefix. Min 1024 tokens (Sonnet/Opus). [confidence: HIGH]
- **OpenAI automatic caching** — ≥1024 tokens, 50-75% discount, no API flag, hits reported in `usage.prompt_tokens_details.cached_tokens`. [confidence: HIGH]
- **Gemini context caching** — explicit (`cachedContents.create`, min 32k → 4k on 2.5 Flash) + implicit (May 2025, no code change). ~75% discount. Ideal for repo-wide context. [confidence: HIGH]
- **DeepSeek disk-backed caching** — $0.014/M cached vs $0.14/M miss (~90% off), 64-token granularity, hours TTL. Best cost/token of any frontier model. [confidence: HIGH]
- **Self-hosted: SGLang RadixAttention + vLLM APC** — automatic prefix sharing, 5-10x throughput on agent workloads. Requires session affinity in LB. [confidence: HIGH]

### Best Practices — Caching

- **Freeze tool schema serialization** — sort keys alphabetically, byte-stable output. Any whitespace diff busts the cache. [confidence: HIGH]
- **Layered breakpoints:** tools → system → project context → rolling conversation head. Place most stable content first. [confidence: HIGH]
- **Append-only turns** — never edit past messages. Summarize into a fresh stable block instead of mutating history. [confidence: HIGH]
- **Cache-aware trimming:** drop from the *middle*, not the prefix. [confidence: HIGH]
- **Warmup ping at session start** — fire a 1-token completion to pre-populate 5-min cache before first real query. [confidence: MEDIUM, source: Aider `--cache-keepalive-pings`]
- **Tool result normalization** — strip timestamps and absolute paths before feeding back into context. [confidence: HIGH]

### Best Practices — Agent CLI Features (2025)

- **Skills + subagents + hooks trinity** (Claude Code) is now the default plugin surface. Users can port between agents trivially. [confidence: HIGH]
- **Shadow-git checkpoints** (Cline) — per-tool-call file snapshots + `Esc-Esc` rewind. Now table stakes; every Reddit thread complains when missing. [confidence: HIGH]
- **Sandboxed bash execution** via Landlock (Linux) / Seatbelt (macOS) / Job Objects (Windows). Codex has this; most forks don't. [confidence: HIGH]
- **Resumable sessions with fuzzy picker** (`caveman resume`) — Claude Code's killer adoption feature. JSONL per session. [confidence: HIGH]
- **Inline diff review with hunk-level accept/reject** — Cursor's strength, Aider's weakness. Ink + `diff` lib. Highest-leverage UX win. [confidence: HIGH]
- **MCP as the plugin API** — don't invent a proprietary one. Day-one ecosystem of 200+ servers. [confidence: HIGH]
- **Architect/Editor routing as a first-class feature** — Aider popularized, nobody else ships it cleanly. [confidence: HIGH]

### Existing Art — What to Study

- **Aider** — repomap (`aider/repomap.py`), architect mode, S/R diff edit format, `--cache-keepalive-pings`, built-in benchmark harness. [confidence: HIGH]
- **Claude Code** — 4-breakpoint Anthropic caching (see reverse-engineered notes at https://github.com/shareAI-lab/analysis_claude_code), skills+subagents+hooks architecture, agentic grep/glob with no embedding index. [confidence: HIGH]
- **Cline** — shadow-git checkpoints, context condensation at 70% window, per-provider `cacheControl` logic in `src/api/providers/anthropic.ts`. [confidence: HIGH]
- **Agentless** (https://github.com/OpenAutoCoder/Agentless) — fixed pipeline beats agents at 1/3 tokens on SWE-bench Verified. [confidence: HIGH]
- **Moatless-Tools** (https://github.com/aorwall/moatless-tools) — best-of-N with executable verifier pattern. [confidence: HIGH]
- **SWE-Gym** (https://arxiv.org/abs/2412.21139) — Reflexion-for-code with test-output conditioning, +5-10% win. [confidence: HIGH]
- **CodeCompressor / RepoCompressor** (2025 arXiv, Tsinghua) — AST-aware code context compression, ~60% reduction with near-zero accuracy loss on SWE-Bench Lite. Highest ROI reference for Caveman. [confidence: MEDIUM]
- **SGLang RadixAttention** (https://github.com/sgl-project/sglang) — prefix-tree KV sharing, default in 2025. [confidence: HIGH]
- **OpenCode (sst/opencode)** — study their launch thread for adoption mechanics. [confidence: MEDIUM]

### Pitfalls to Avoid

- **Treating caveman compression as the only cost lever.** Input tokens dominate in multi-turn sessions; output compression alone leaves 60%+ of the cost on the table. Must stack with caching + input compression + repomap. [confidence: HIGH]
- **Unstable tool schema serialization.** A single whitespace change busts Anthropic's prefix cache. Everyone underestimates this. [confidence: HIGH]
- **KV cache compression research for a plugin-layer product.** H2O/SnapKV/PyramidKV are infrastructure; irrelevant unless Caveman bundles inference. Tempting rabbit hole. [confidence: HIGH]
- **Fine-tune-required compression methods** (Gist, ICAE, AutoCompressor, xRAG, Activation Beacon) — sexy papers, unshippable against closed APIs. [confidence: HIGH]
- **LLM-judge verification for best-of-N.** Executable verification via synthesized repro tests is strictly better and cheaper. [confidence: HIGH]
- **Building a proprietary plugin API.** Fragments ecosystem, zero network effect. MCP is the standard. [confidence: HIGH]
- **Telemetry-less launch.** #1 HN complaint of 2025: "I can't tell what my agent did." Ship OTel + Langfuse export from day one. [confidence: HIGH]
- **Cost counters without hard stops.** Every tool shows post-hoc spend; nobody actually kills a runaway turn mid-flight. [confidence: HIGH]

## Contradictions & Open Questions

- **Embedding index vs agentic retrieval.** Cursor indexes, Claude Code does pure agentic grep. Both work at top tier. Assessment: agentic-first is cheaper for small repos and avoids stale-index bugs; hybrid wins on 1M+ LOC monorepos. Caveman should ship agentic-first with optional index.
- **Does prompt compression degrade multi-turn tool-use accuracy?** No published measurement exists for caveman-style compression on SWE-bench. **This is the open research question and the thesis opportunity.**
- **5-min vs 1-hour Anthropic cache TTL.** 1h costs 2x write but survives user breaks; 5m is free but cold after coffee. Assessment: default 5m with keepalive pings; expose 1h as opt-in for long sessions.
- **Local model viability with caveman compression.** Unvalidated claim: caveman makes Qwen2.5-Coder-7B a usable agent. Needs empirical verification — this is a shippable benchmark.
- **Shared-prefix attention for non-prefix reuse (CacheBlend, PromptCache).** Real production numbers are scarce outside LMCache. Assessment: skip for v1, revisit if self-hosted backend ships.

## Codebase Context (added during /ck:sketch grounding, 2026-04-16)

Repo is NOT a greenfield runtime — it has a working agent-loop already.

- Main loop: `packages/agent/src/agent-loop.ts:155` (`runLoop()`).
- Provider abstraction: function-shaped `StreamFn` (`packages/agent/src/types.ts:25`), 15+ adapters in `packages/ai`.
- Anthropic `cache_control` is partially wired (system prompt + last user message) at `packages/ai/src/providers/anthropic.ts:613-857`. Bedrock has `cachePoint` at `packages/ai/src/providers/amazon-bedrock.ts:516-680`. OpenAI completions adds an Anthropic-style breakpoint when via OpenRouter.
- `CacheRetention` enum (`"none"|"short"|"long"`) propagates via `StreamOptions.cacheRetention` (`packages/ai/src/types.ts:56-74`) but is set session-wide, not per-task.
- Sessions: JSONL at `~/.cave/sessions/<id>.jsonl`. `SessionManager` in `packages/coding-agent/src/core/session-manager.ts`, `CURRENT_SESSION_VERSION = 3`. Branch tree, compaction, branch summarization all already present.
- System prompt: `packages/coding-agent/src/core/system-prompt.ts:97` (`buildSystemPrompt`). CLAUDE.md / AGENTS.md loaded via `resource-loader.ts:59`.
- Compaction path: `packages/coding-agent/src/core/compaction/` with `compaction.ts` and `branch-summarization.ts`. Cave-mode tool compression at `cave-tool-compression.ts` and `cave-structured-compression.ts`.
- Built-in tools: ~7 (`read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`).
- No repomap. No tree-sitter / ctags index.
- No architect/editor split in core loop. CaveKit extension has `PRESET_MODELS` table mapping phases × presets to model IDs (`packages/cavekit-extension/src/config/types.ts:89`).
- Caveman compression is runtime code, not a standalone skill. `cavemanLevel` config field, `cavemanForSubagents: true` default.
- Plain `cave` CLI is single-model per session.

## Implications for Design

**Phase 1 — Cost curve wins (ship in 2 weeks, pure infra, no research):**
1. Anthropic 4-breakpoint caching (tools → system → project → rolling) with keepalive pings
2. Deterministic tool schema serialization (sorted keys, byte-stable) — unlocks #1
3. Architect/Editor model split (Opus plan → Haiku/Sonnet edit)
4. Aider-style search/replace diff edit format
5. Tool-result semantic cache keyed by `(path, git-sha, mtime)` — nobody has published numbers here

**Phase 2 — SWE-bench-winning harness (1 month):**
6. Agentless-style localizer (repo-map → embedding retrieve → LLM re-rank) before agent loop
7. Tree-sitter repomap + PageRank, emitted in caveman prose — stacks compressions
8. AST-addressed edit tool (`edit_symbol`)
9. Best-of-N with executable verifier (synthesize repro test from issue)
10. Reflexion-lite on test failure (max depth 2)
11. Subagent context isolation with hard token budget + caveman-mode forced inside — novel

**Phase 3 — The research paper ("Compressed-Trajectory Agents"):**
- Thesis: caveman-compressed intermediate reasoning enables 3-5x more best-of-N samples at same compute, with executable verification recovering compression loss.
- Headline result target: *same SWE-bench Verified at 35% tokens, or +6pt at same budget*.
- Framing: test-time compute scaling with a new axis (token density of scratchpad).
- Venue: NeurIPS Efficient NLP workshop or MLSys.
- Also ship LLMLingua-2 via onnxruntime-node as input middleware (40-60% cut on long prompts).

**Phase 4 — CLI parity + greenfield differentiators:**
- Parity (table stakes): shadow-git checkpoints, resumable sessions, inline hunk-level diff review, plan mode, hooks, MCP client+server, `caveman exec`, live `/cost`, sandboxed bash (Landlock/Seatbelt).
- Greenfield (nobody ships these): hard-stop cost caps mid-turn, `caveman replay <rollout.jsonl>`, auditable memory with provenance, in-CLI OTel trace viewer + Langfuse export, public nightly evals dashboard with $5 cap, "$ saved" opt-in telemetry counter, ACP support (Zed embeddability).

**Phase 5 — Distribution & community:**
- Bun-compiled single binary, npm, brew, `curl|sh`, scoop, Docker
- Starlight docs, RFC process in `rfcs/`, Discord + 20 seeded good-first-issues
- Plugin API = MCP (not proprietary)
- First-class Ollama/llama.cpp support

**The 60-second recruiter skim optimization:**
1. SWE-bench Verified number + $/solved in README header
2. Token efficiency plot (caveman vs Aider vs Claude Code at equal accuracy)
3. arXiv paper link
4. Nightly eval dashboard with cost caps
5. Active RFC process + >50 contributors

## Locked design decisions for /ck:sketch (2026-04-16)

| # | Decision |
|---|---|
| Q1 | Plugin-layer only. No self-host, no SGLang/vLLM kits. No bundled local inference server. |
| Q2 | Architect/editor split lives in core agent loop (`packages/agent`), not just CaveKit preset table. |
| Q3 | Tree-sitter top-8 grammars: TS, JS, Python, Go, Rust, Java, C, C++. |
| Q4 | Sandbox: macOS Seatbelt + Linux Landlock. Windows = unsupported (warn, run permissive). |
| Q5 | Shadow-git checkpoints as a separate layer below existing JSONL session/compaction. JSONL untouched. |
| Q6 | Local trace JSONL + `cave trace` viewer at v1. OTel/Langfuse exporter deferred to follow-up kit. |
| Q7 | Research artifacts in-repo under `research/` (paper, evals, results, plots colocated). |

## Sources

### Compression
- [LLMLingua / LLMLingua-2 / LongLLMLingua](https://github.com/microsoft/LLMLingua) — token-classifier prompt compression, ONNX-shippable
- [LLMLingua-2 paper](https://arxiv.org/abs/2403.12968) — ACL 2024 Findings
- [Gist Tokens](https://arxiv.org/abs/2304.08467) — NeurIPS 2023, fine-tune-only
- [ICAE](https://github.com/getao/icae) — ICLR 2024 autoencoder compression
- [RECOMP](https://github.com/carriex/recomp) — ICLR 2024 RAG compressor
- [Provence reranker](https://huggingface.co/naver/provence-reranker-debertav3-v1) — ICLR 2025 context pruner
- [H2O](https://github.com/FMInference/H2O), [StreamingLLM](https://github.com/mit-han-lab/streaming-llm), [SnapKV](https://github.com/FasterDecoding/SnapKV), [PyramidKV](https://github.com/Zefan-Cai/PyramidKV), [MInference](https://github.com/microsoft/MInference), [Quest](https://github.com/mit-han-lab/Quest) — KV cache compression (infra-level)

### Caching
- [Anthropic prompt caching docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — 4-breakpoint, 5m/1h TTL, 90% savings
- [OpenAI prompt caching](https://platform.openai.com/docs/guides/prompt-caching) — automatic, 50-75% discount
- [Gemini context caching](https://ai.google.dev/gemini-api/docs/caching) — explicit + implicit
- [DeepSeek KV cache](https://api-docs.deepseek.com/guides/kv_cache) — disk-backed, 90% discount
- [vLLM automatic prefix caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching.html) — block-hash LRU
- [SGLang RadixAttention](https://github.com/sgl-project/sglang) — prefix-tree KV sharing
- [LMCache / CacheBlend](https://github.com/LMCache/LMCache) — selective KV recompute for non-prefix reuse
- [Claude Code internals analysis](https://github.com/shareAI-lab/analysis_claude_code) — reverse-engineered cache layout

### Harness & Coding Agents
- [Agentless](https://github.com/OpenAutoCoder/Agentless) — Xia et al. 2024, beats agents at 1/3 tokens
- [Agentless paper](https://arxiv.org/abs/2407.01489)
- [SWE-agent](https://arxiv.org/abs/2405.15793)
- [Moatless-Tools](https://github.com/aorwall/moatless-tools) — best-of-N with executable verifier
- [OpenHands](https://github.com/All-Hands-AI/OpenHands) — full-stack agent runtime
- [LocAgent](https://arxiv.org/abs/2503.09089) — AST-addressed edits
- [SWE-Gym](https://arxiv.org/abs/2412.21139) — execution-feedback Reflexion
- [LATS](https://arxiv.org/abs/2310.04406) — tree search for code
- [Lingma SWE-GPT](https://arxiv.org/abs/2411.00622) — planner/executor split
- [RepoUnderstander](https://arxiv.org/abs/2406.01304)
- [Multi-SWE-bench](https://arxiv.org/abs/2504.02605) — multilingual leaderboard
- [r2e](https://r2e.dev) — real-world code execution env

### CLI Tools to Study
- [Aider](https://github.com/Aider-AI/aider) — repomap, architect mode, cache-keepalive, S/R diff
- [Aider repomap docs](https://aider.chat/docs/repomap.html)
- [Claude Code docs](https://docs.claude.com/claude-code) — skills, subagents, hooks, checkpoints
- [Cline](https://github.com/cline/cline) — shadow-git checkpoints, context condensation
- [OpenCode](https://github.com/sst/opencode) — TUI-first, LSP-aware, provider-agnostic
- [Codex CLI](https://github.com/openai/codex) — Seatbelt/Landlock sandbox, rollout replay
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) — extensions system
- [Continue.dev](https://github.com/continuedev/continue) — config-driven model stacks

### DX / Ecosystem
- [MCP servers registry](https://github.com/modelcontextprotocol/servers) + [smithery.ai](https://smithery.ai) — 200+ plugins day one
- [Agent Client Protocol (Zed)](https://github.com/zed-industries/agent-client-protocol) — editor embedding standard
- [Langfuse OTel](https://langfuse.com/docs/opentelemetry) — in-CLI trace export
- [Ink](https://github.com/vadimdemedes/ink) — React-in-terminal, Claude Code/Gemini CLI DNA
- [Bun compile](https://bun.sh/docs/bundler/executables) — 50MB single binary distribution
- [Starlight](https://starlight.astro.build) — 2025-default docs framework
- [SWE-bench harness](https://github.com/princeton-nlp/SWE-bench) — nightly CI eval target
