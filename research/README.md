# research/

Reproducible research artifacts for the token-efficiency initiative.

## Layout

- `paper/` — source of the paper (LaTeX/Markdown)
- `evals/` — evaluation harness code and fixtures
- `results/nightly/<date>.json` — nightly CI bench output (50 SWE-bench Verified instances)
- `results/microbench-<date>.json` — MicroBench results
- `baselines/` — external system baselines (Codex, Claude Code) for comparison
- `plots/` — plot generators (e.g. tokens-vs-resolved)

## Benchmarks

### MicroBench (fast, cheap)

25 self-contained coding tasks exercising agent tool use (read/edit/bash).
No repo cloning, no Docker — runs in ~15 min for ~$1.

```bash
npm run bench:micro                          # run all 25 tasks
npm run bench:micro -- --difficulty easy      # filter by difficulty
npm run bench:micro -- --limit 5             # run first 5 only
npm run bench:micro -- --dry-run             # list tasks without running
```

**Latest results (2026-04-16, cave + gpt-5.4 high, ultra compression):**

| Difficulty | Pass Rate | Avg Cost/Task | Avg Duration |
|-----------|-----------|---------------|--------------|
| Easy | 8/8 (100%) | $0.03 | 17s |
| Medium | 6/10 (60%) | $0.04 | 33s |
| Hard | 2/7 (29%) | $0.06 | 55s |
| **Total** | **16/25 (64%)** | **$0.05** | **33s** |

Key metrics:
- **$1.19 total cost** for full suite
- **59k total tokens per resolved task** (non-cached input + cached input + output)
- **75% prompt cache hit rate** (caveman compression)
- **14 min** wall clock

### SWE-bench Verified (thorough, expensive)

500 real GitHub issues from the SWE-bench Verified dataset.
Requires repo cloning + Docker evaluation harness.

```bash
npm run bench:swebench                       # run all instances
npm run bench:nightly                        # run 50-instance nightly subset
npm run bench:eval                           # evaluate patches with Docker harness
```

### Cross-System Comparison

Compare cave's token efficiency against Codex and Claude Code using published baseline data.

```bash
npm run bench:compare -- --cave-results research/results/microbench-2026-04-16.json
npm run bench:compare -- --cave-results research/results/swebench-2026-04-16.json
npm run bench:compare -- --format json --output report.json
```

**Token efficiency comparison (SWE-bench baselines):**

| System | Benchmark | Resolved | Tok/Resolved | $/Resolved | Cache% |
|--------|-----------|----------|-------------|------------|--------|
| cave | microbench | 64.0% | 59k | $0.07 | 75.0% |
| codex | swebench | 74.2% | 1,348k | $3.37 | n/a |
| claude-code | swebench | 51.0% | 2,353k | $7.35 | n/a |

Note: cave microbench vs SWE-bench is not apples-to-apples (different tasks, different difficulty). Run cave on SWE-bench for a direct comparison. Tok/Resolved includes all prompt tokens (cached + non-cached) plus output tokens.

## Regenerating published numbers

```bash
npm run bench:micro                          # ~15 min, ~$1
npm run bench:nightly                        # ~2 hr, ~$250 (50 instances)
npm run bench:compare                        # instant, reads existing results
```

A fresh clone should regenerate every plot and number in the paper by
following the commands above. No hand-edited artifacts.

## Related

- Cavekit: `context/kits/cavekit-bench-research-distro.md`
- Impl: `context/impl/T-te-132.md` .. `T-te-143.md`
