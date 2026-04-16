#!/bin/sh
set -e

PASS=true

# Check that threading.Lock is used in worker_pool.py
if ! grep -q 'Lock' worker_pool.py; then
  echo "FAIL: worker_pool.py missing 'Lock' (should use threading.Lock)"
  PASS=false
fi

# Check that lock is acquired (using 'acquire' or 'with' context manager pattern)
if ! grep -qE '\.acquire|with.*lock|with.*Lock|with self\.' worker_pool.py; then
  echo "FAIL: worker_pool.py should acquire the lock (via .acquire() or 'with' statement)"
  PASS=false
fi

# Run tests 3 times to check for intermittent failures (race conditions)
FAILURES=0
for i in 1 2 3; do
  echo "=== Test run $i ==="
  if ! python -m pytest test_worker_pool.py -v --tb=short 2>&1; then
    FAILURES=$((FAILURES + 1))
  fi
done

if [ "$FAILURES" -gt 0 ]; then
  echo "FAIL: test_worker_pool.py failed ${FAILURES}/3 runs (intermittent race condition?)"
  PASS=false
fi

# Verify the race condition pattern is gone: no read-sleep-write on completed_count
RACE_PATTERN=$(python3 -c "
import ast
with open('worker_pool.py') as f:
    source = f.read()
# Check if there's still a 'current = self.completed_count ... self.completed_count = current + 1' pattern
if 'current = self.completed_count' in source and 'self.completed_count = current + 1' in source:
    print('RACE')
else:
    print('OK')
" 2>&1)

if [ "$RACE_PATTERN" = "RACE" ]; then
  echo "FAIL: worker_pool.py still has the read-modify-write race pattern"
  PASS=false
fi

if [ "$PASS" = false ]; then
  exit 1
fi

echo "PASS: all concurrent fix checks passed"
exit 0
