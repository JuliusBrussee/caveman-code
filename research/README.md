# research/

Reproducible research artifacts for the token-efficiency initiative.

## Layout

- `paper/` — source of the paper (LaTeX/Markdown)
- `evals/` — evaluation harness code and fixtures
- `results/nightly/<date>.json` — nightly CI bench output (50 SWE-bench Verified instances)
- `plots/` — plot generators (e.g. tokens-vs-resolved)

## Regenerating published numbers

```bash
npm run bench:nightly
npm run plots:tokens-vs-resolved
```

A fresh clone should regenerate every plot and number in the paper by
following the two commands above. No hand-edited artifacts.

## Related

- Cavekit: `context/kits/cavekit-bench-research-distro.md`
- Impl: `context/impl/T-te-132.md` .. `T-te-143.md`
