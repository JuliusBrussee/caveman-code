#!/usr/bin/env bash
# Evaluate Cave CLI patches against SWE-bench Verified using the official harness.
#
# Usage:
#   bash research/evals/evaluate-patches.sh [predictions.jsonl] [--workers N]
#
# Prerequisites:
#   pip install swebench
#   Docker running (images built/pulled automatically on first run)
#
# On macOS/ARM, add --namespace '' to build images locally.

set -euo pipefail

PREDICTIONS="${1:-research/results/predictions.jsonl}"
MAX_WORKERS="${2:-4}"
RUN_ID="cave-eval-$(date -u +%Y%m%d-%H%M)"

if [ ! -f "$PREDICTIONS" ]; then
	echo "ERROR: Predictions file not found: $PREDICTIONS"
	echo "Run the benchmark first: npx tsx research/evals/run-swebench.ts"
	exit 1
fi

# Check dependencies
if ! command -v python3 &>/dev/null; then
	echo "ERROR: python3 not found"
	exit 1
fi

if ! python3 -c "import swebench" 2>/dev/null; then
	echo "ERROR: swebench not installed. Run: pip install swebench"
	exit 1
fi

if ! command -v docker &>/dev/null; then
	echo "ERROR: docker not found"
	exit 1
fi

if ! docker info &>/dev/null; then
	echo "ERROR: Docker daemon not running"
	exit 1
fi

INSTANCE_COUNT=$(wc -l < "$PREDICTIONS" | tr -d ' ')
echo "=== SWE-bench Evaluation ==="
echo "Predictions: $PREDICTIONS ($INSTANCE_COUNT instances)"
echo "Run ID:      $RUN_ID"
echo "Workers:     $MAX_WORKERS"
echo ""

# Detect ARM/macOS and suggest namespace flag
ARCH=$(uname -m)
NAMESPACE_FLAG=""
if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
	echo "NOTE: ARM architecture detected. Using --namespace '' for local Docker builds."
	NAMESPACE_FLAG="--namespace ''"
fi

# Run evaluation
echo "Starting evaluation harness..."
eval python3 -m swebench.harness.run_evaluation \
	--dataset_name princeton-nlp/SWE-bench_Verified \
	--predictions_path "$PREDICTIONS" \
	--max_workers "$MAX_WORKERS" \
	--run_id "$RUN_ID" \
	$NAMESPACE_FLAG

# Show results summary
RESULTS_DIR="logs/run_evaluation/${RUN_ID}"
if [ -d "$RESULTS_DIR" ]; then
	echo ""
	echo "=== Evaluation Complete ==="
	echo "Results: $RESULTS_DIR/"

	# Count resolved
	if command -v python3 &>/dev/null; then
		python3 -c "
import json, glob, os
reports = glob.glob(os.path.join('$RESULTS_DIR', '**/report.json'), recursive=True)
resolved = 0
total = 0
for rp in reports:
    with open(rp) as f:
        data = json.load(f)
    for iid, result in data.items():
        total += 1
        if result.get('resolved', False):
            resolved += 1
if total > 0:
    print(f'Resolved: {resolved}/{total} ({resolved/total*100:.1f}%)')
else:
    print('No results found in report files.')
" 2>/dev/null || true
	fi
else
	echo ""
	echo "Results directory not found at $RESULTS_DIR"
	echo "Check logs for errors."
fi
