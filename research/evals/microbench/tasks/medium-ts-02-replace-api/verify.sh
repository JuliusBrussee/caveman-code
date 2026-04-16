#!/bin/sh
set -e

FAIL=0

# Check that no .then( pattern remains in any .ts file
for f in api-client.ts dashboard.ts analytics.ts; do
  if grep -q '\.then(' "$f"; then
    echo "FAIL: $f still contains .then() pattern"
    FAIL=1
  fi
done

# Check that await fetch exists in all 3 files
for f in api-client.ts dashboard.ts analytics.ts; do
  if ! grep -q 'await fetch' "$f"; then
    echo "FAIL: $f does not use await fetch"
    FAIL=1
  fi
done

# Check that async keyword is present in all 3 files
for f in api-client.ts dashboard.ts analytics.ts; do
  if ! grep -q 'async' "$f"; then
    echo "FAIL: $f does not use async"
    FAIL=1
  fi
done

if [ "$FAIL" -eq 1 ]; then
  exit 1
fi

echo "PASS"
exit 0
