---
created: "2026-04-16"
last_edited: "2026-04-16"
initiative: token-efficiency
status: draft
---

# Cavekit: Bench, Research & Distribution

## Scope

The benchmark harness, research artifact home, and distribution surface — grouped because they are downstream of every other kit and share the recruiter-skim narrative. Nightly SWE-bench Verified evals with hard $5 per-instance caps. Token-efficiency plot generation. In-repo `research/` directory with paper, eval scripts, results, and plots colocated (Q7 lock). Bun-compiled single binary. Multi-channel install. Starlight docs. RFC process. Community onboarding.

## Requirements

### R1: SWE-bench Verified harness adapter
**Description:** A test runner that takes a SWE-bench Verified instance, sets up the environment, runs `cave` on the issue with a fixed config, and scores the result with the official harness. Reproducible: same instance + same config = same result.
**Acceptance Criteria:**
- [ ] Running the adapter on a fixture instance produces a pass/fail score consistent with the official harness.
- [ ] Two runs on the same instance with the same config produce the same score.
- [ ] The adapter writes a structured result JSON per instance.
**Dependencies:** cavekit-cost-trace R7

### R2: Per-instance hard cost cap
**Description:** Every benchmark run is wrapped with cost-trace caps at $5 (configurable). Caps that fire are logged as cap-failures, not silently skipped. Aggregate cost per benchmark run never exceeds cap × instance count.
**Acceptance Criteria:**
- [ ] A run exceeding $5 on a single instance records a `cost_cap_failure` for that instance.
- [ ] Aggregate cost across a run is never greater than (cap × number of instances).
- [ ] The cap value is configurable per run.
**Dependencies:** R1, cavekit-cost-trace R2, cavekit-cost-trace R3

### R3: Nightly CI evaluation
**Description:** A CI workflow runs the benchmark against a configurable subset (default 50 instances) nightly, posts results to `research/results/nightly/<date>.json`, and updates the README badge.
**Acceptance Criteria:**
- [ ] A scheduled CI job runs the harness on a 50-instance subset daily.
- [ ] Results are written to `research/results/nightly/<date>.json`.
- [ ] The README badge reflects the latest nightly score.
- [ ] The instance count is configurable per run.
**Dependencies:** R1, R2

### R4: Token-efficiency plot generator
**Description:** A script in `research/plots/` reads result JSONs and emits a `tokens-vs-resolved` chart (caveman vs Aider vs other harnesses) at fixed accuracy targets. Regenerable from saved results.
**Acceptance Criteria:**
- [ ] Running the script on saved result JSONs produces a `tokens-vs-resolved` chart file.
- [ ] The chart includes at least two comparison systems alongside caveman.
- [ ] The chart can be regenerated deterministically from the same input JSONs.
**Dependencies:** R3, cavekit-cost-trace R5

### R5: `research/` layout
**Description:** The `research/` directory contains `paper/` (LaTeX or markdown source), `evals/` (harness adapters), `results/` (JSON snapshots), and `plots/` (chart generators). A single `git clone` reproduces every published number.
**Acceptance Criteria:**
- [ ] All four subdirectories exist at the root of `research/`.
- [ ] A fresh clone can regenerate published plots by running the `plots/` scripts against `results/`.
- [ ] The paper source lives in `research/paper/`.
**Dependencies:** R4

### R6: Bun-compiled single binary
**Description:** A release pipeline produces a single-file binary via `bun build --compile` for darwin-arm64, darwin-x64, linux-x64, and linux-arm64. The binary is ≤ 80MB. A smoke test invokes `cave --version` on each artifact.
**Acceptance Criteria:**
- [ ] The release pipeline emits artifacts for all four target triples.
- [ ] Each artifact is ≤ 80MB.
- [ ] A smoke test invokes `cave --version` on each artifact and asserts successful exit.
**Dependencies:** none

### R7: Distribution channels
**Description:** Install paths: `npm install -g cave`, `brew install cave`, `curl https://.../install.sh | sh`, `scoop install cave` (Windows, no sandbox), and a Docker image. Each channel is verified by a release-time smoke test.
**Acceptance Criteria:**
- [ ] Each of the five channels has a configured publishing step in release CI.
- [ ] Each channel has a smoke test running `cave --version` post-install.
- [ ] A failing smoke test on any channel fails the release.
**Dependencies:** R6

### R8: Starlight docs site
**Description:** A docs site under `docs/` built with Starlight covers getting started, model routing, caching, cost caps, sandbox setup, MCP servers, replay, benchmarks, and research paper. Auto-deployed on tag.
**Acceptance Criteria:**
- [ ] All listed sections exist in the docs site.
- [ ] `npm run build` in `docs/` produces a static site.
- [ ] A tag push triggers the docs deploy workflow.
**Dependencies:** none

### R9: RFC process
**Description:** An `rfcs/` directory with a numbered template, a CONTRIBUTING note explaining the process, and a sample RFC for one of the kits in this initiative.
**Acceptance Criteria:**
- [ ] `rfcs/` exists with a numbered template file.
- [ ] CONTRIBUTING.md references the RFC process.
- [ ] At least one sample RFC lives in `rfcs/` corresponding to a kit in this initiative.
**Dependencies:** none

### R10: Community onboarding
**Description:** A Discord invite link in README, 20 seeded `good-first-issue` GitHub issues at launch, and a CONTRIBUTING.md pointing new contributors at the kits → plans → impl flow.
**Acceptance Criteria:**
- [ ] README contains a working Discord invite link.
- [ ] At least 20 GitHub issues labeled `good-first-issue` exist at initiative launch.
- [ ] CONTRIBUTING.md explicitly references the kits → plans → impl flow.
**Dependencies:** none

### R11: README header optimization
**Description:** README opens with SWE-bench Verified score + $/solved, the token-efficiency plot, a research paper link (or "in preparation"), the nightly eval dashboard link, and the install one-liner. The 60-second recruiter skim is the explicit design target.
**Acceptance Criteria:**
- [ ] The README first screenful contains all five elements in order.
- [ ] The SWE-bench score is updated by the nightly CI job.
- [ ] The install one-liner is one of the channels from R7.
**Dependencies:** R3, R4, R7

## Out of Scope

- Multi-SWE-bench (multilingual) — deferred to a future kit.
- arXiv submission logistics.
- Conference travel.
- Discord bot infrastructure.
- Sponsorships.

## Cross-References

- See also: cavekit-cost-trace.md (R2 uses cost caps; R4 reads trace JSONL; R1 uses replay).
- See also: every kit 1–10 (this kit depends on them producing real efficiency numbers).

## Source

- `context/refs/research-brief-token-efficiency.md` — Benchmark, research, and distribution sections; Q7 locked decision (research artifacts colocated in-repo under `research/`).

## Changelog

| Date | Change |
|------|--------|
| 2026-04-16 | Initial draft |
