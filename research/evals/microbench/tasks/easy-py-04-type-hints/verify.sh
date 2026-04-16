#!/bin/sh
set -e

FILE="math_ops.py"

# Check each function has a return type hint of -> float
FUNCS="add subtract multiply divide"
for FUNC in $FUNCS; do
  if ! grep "def $FUNC" "$FILE" | grep -q -- '-> float'; then
    echo "FAIL: function $FUNC missing '-> float' return type hint"
    exit 1
  fi
done

# Check that parameter type hints are present (: float) for each function
for FUNC in $FUNCS; do
  # Each function should have 2 float-typed parameters
  HINT_COUNT=$(grep "def $FUNC" "$FILE" | grep -oE '[a-z]+: float' | wc -l | tr -d ' ')
  if [ "$HINT_COUNT" -lt 2 ]; then
    echo "FAIL: function $FUNC should have 2 float-typed params, found $HINT_COUNT"
    exit 1
  fi
done

echo "PASS: All functions have proper type hints"
exit 0
