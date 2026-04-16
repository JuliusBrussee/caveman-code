#!/bin/sh
set -e

FILE="calculator.py"

# Verify the divide method now raises ZeroDivisionError
# Check that "raise" appears in the divide method
# Extract the divide method body (from "def divide" to the next "def " or end of file)
DIVIDE_BODY=$(sed -n '/def divide/,/^    def \|^class \|^$/p' "$FILE")

if ! echo "$DIVIDE_BODY" | grep -q 'raise'; then
  echo "FAIL: divide method does not contain a raise statement"
  exit 1
fi

if ! echo "$DIVIDE_BODY" | grep -q 'ZeroDivisionError'; then
  echo "FAIL: divide method does not raise ZeroDivisionError"
  exit 1
fi

# Verify the old buggy "return 0" for zero division is gone
# Check there's no bare "return 0" in the divide method
if echo "$DIVIDE_BODY" | grep -qE 'return\s+0\s*$'; then
  echo "FAIL: divide method still returns 0 on zero division"
  exit 1
fi

echo "PASS: divide method raises ZeroDivisionError"
exit 0
