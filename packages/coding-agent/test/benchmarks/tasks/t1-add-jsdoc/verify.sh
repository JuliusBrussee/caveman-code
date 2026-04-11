#!/bin/bash
# Verify JSDoc was added to all exported functions
set -e

FILE="index.ts"

# Check file exists
[ -f "$FILE" ] || { echo "FAIL: $FILE not found"; exit 1; }

# Check for JSDoc comments (at least 3, one per function)
JSDOC_COUNT=$(grep -c '/\*\*' "$FILE" || true)
[ "$JSDOC_COUNT" -ge 3 ] || { echo "FAIL: Expected 3+ JSDoc blocks, found $JSDOC_COUNT"; exit 1; }

# Check for @param tags
PARAM_COUNT=$(grep -c '@param' "$FILE" || true)
[ "$PARAM_COUNT" -ge 5 ] || { echo "FAIL: Expected 5+ @param tags, found $PARAM_COUNT"; exit 1; }

# Check for @returns tags
RETURNS_COUNT=$(grep -c '@returns' "$FILE" || true)
[ "$RETURNS_COUNT" -ge 3 ] || { echo "FAIL: Expected 3+ @returns tags, found $RETURNS_COUNT"; exit 1; }

# Check original functions still exist
grep -q 'calculateDiscount' "$FILE" || { echo "FAIL: calculateDiscount missing"; exit 1; }
grep -q 'formatCurrency' "$FILE" || { echo "FAIL: formatCurrency missing"; exit 1; }
grep -q 'applyTax' "$FILE" || { echo "FAIL: applyTax missing"; exit 1; }

echo "PASS"
