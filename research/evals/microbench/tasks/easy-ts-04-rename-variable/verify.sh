#!/bin/sh
set -e

FILE="config.ts"

# Check that standalone apiUrl no longer exists (but apiBaseUrl does)
# Use word-boundary matching: apiUrl not preceded/followed by alphanumeric
# Exclude apiBaseUrl matches by first checking no standalone apiUrl remains
if grep -qE '(^|[^a-zA-Z0-9_])apiUrl([^a-zA-Z0-9_]|$)' "$FILE"; then
  echo "FAIL: Found standalone 'apiUrl' — should be renamed to 'apiBaseUrl'"
  exit 1
fi

# Check that apiBaseUrl appears at least 5 times (was used 5 times as apiUrl)
COUNT=$(grep -oE 'apiBaseUrl' "$FILE" | wc -l | tr -d ' ')
if [ "$COUNT" -lt 5 ]; then
  echo "FAIL: Expected at least 5 occurrences of apiBaseUrl, found $COUNT"
  exit 1
fi

echo "PASS: apiUrl renamed to apiBaseUrl everywhere ($COUNT occurrences)"
exit 0
