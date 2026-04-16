#!/bin/sh
set -e

FILE="helpers.py"

# Each function must have a docstring (triple quotes) on the line after def
FUNCS="parse_csv format_date slugify"
for FUNC in $FUNCS; do
  # Get the line number of the def, then check the next line has triple quotes
  DEF_LINE=$(grep -n "def $FUNC" "$FILE" | head -1 | cut -d: -f1)
  if [ -z "$DEF_LINE" ]; then
    echo "FAIL: function $FUNC not found"
    exit 1
  fi
  NEXT_LINE=$((DEF_LINE + 1))
  if ! sed -n "${NEXT_LINE}p" "$FILE" | grep -q '"""'; then
    echo "FAIL: No docstring found after def $FUNC"
    exit 1
  fi
done

# Verify at least 3 docstring blocks exist (opening triple-quotes)
DOC_COUNT=$(grep -c '"""' "$FILE")
if [ "$DOC_COUNT" -lt 6 ]; then
  echo "FAIL: Expected at least 6 triple-quote markers (3 opening + 3 closing), found $DOC_COUNT"
  exit 1
fi

echo "PASS: All functions have docstrings"
exit 0
