# Nightly bench results

Each `<date>.json` file holds:

```json
{
  "date": "YYYY-MM-DD",
  "total": 50,
  "resolved": 0,
  "resolvedRate": 0.0,
  "dollarsTotal": 0.0,
  "capFailures": 0,
  "results": []
}
```

The scheduled CI job (`.github/workflows/bench-nightly.yml`) runs
`runBench` over a 50-instance SWE-bench Verified subset and appends a
new file here. The README badge reads the most recent file.
