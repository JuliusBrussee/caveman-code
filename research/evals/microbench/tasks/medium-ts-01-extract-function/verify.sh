#!/bin/sh
set -e

# Check that validateOrder function is declared/exported
grep -q 'function validateOrder' main.ts || { echo "FAIL: validateOrder function not found"; exit 1; }

# Check that processOrder function still exists
grep -q 'function processOrder' main.ts || { echo "FAIL: processOrder function not found"; exit 1; }

# Check that processOrder calls validateOrder
grep -q 'validateOrder' main.ts | grep -v 'function validateOrder' > /dev/null 2>&1
# More robust: count occurrences — must appear at least twice (declaration + call)
COUNT=$(grep -c 'validateOrder' main.ts)
if [ "$COUNT" -lt 2 ]; then
  echo "FAIL: processOrder does not appear to call validateOrder"
  exit 1
fi

# Check that validateOrder is exported
grep -q 'export.*function validateOrder\|export.*validateOrder' main.ts || { echo "FAIL: validateOrder is not exported"; exit 1; }

echo "PASS"
exit 0
