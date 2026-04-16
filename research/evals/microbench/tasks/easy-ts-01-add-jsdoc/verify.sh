#!/bin/sh
set -e

FILE="utils.ts"

# Count @param tags — need at least 5 (add:2, multiply:2, capitalize:1)
PARAM_COUNT=$(grep -c '@param' "$FILE")
if [ "$PARAM_COUNT" -lt 5 ]; then
  echo "FAIL: Expected at least 5 @param tags, found $PARAM_COUNT"
  exit 1
fi

# Count @returns tags — need at least 3 (one per function)
RETURNS_COUNT=$(grep -c '@returns' "$FILE")
if [ "$RETURNS_COUNT" -lt 3 ]; then
  echo "FAIL: Expected at least 3 @returns tags, found $RETURNS_COUNT"
  exit 1
fi

# Verify each function has a JSDoc block before it
for FUNC in add multiply capitalize; do
  # Check that a JSDoc comment block (/**) appears before the function
  if ! grep -B 10 "export function $FUNC(" "$FILE" | grep -q '/\*\*'; then
    echo "FAIL: No JSDoc block found before function $FUNC"
    exit 1
  fi
done

echo "PASS: All exported functions have JSDoc with @param and @returns"
exit 0
