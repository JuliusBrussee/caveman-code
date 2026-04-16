#!/bin/sh
set -e

PASS=true

# Check retry function/decorator is defined
if ! grep -q 'def retry' api_client.py; then
  echo "FAIL: api_client.py missing 'def retry' decorator definition"
  PASS=false
fi

# Check @retry is applied 3 times (to get, post, delete)
RETRY_COUNT=$(grep -c '@retry' api_client.py || true)
if [ "$RETRY_COUNT" -lt 3 ]; then
  echo "FAIL: @retry should be applied to 3 methods, found ${RETRY_COUNT}"
  PASS=false
fi

# Check retry decorator has max_attempts parameter
if ! grep -q 'max_attempts' api_client.py; then
  echo "FAIL: retry decorator missing max_attempts parameter"
  PASS=false
fi

# Check retry decorator has delay parameter
if ! grep -q 'delay' api_client.py; then
  echo "FAIL: retry decorator missing delay parameter"
  PASS=false
fi

# Verify the decorator uses functools.wraps or equivalent (preserves function metadata)
if ! grep -qE 'wraps|functools' api_client.py; then
  echo "WARN: retry decorator should use functools.wraps (not blocking)"
fi

# Run the test suite to verify behavior
python -m pytest test_api_client.py -v --tb=short 2>&1
if [ $? -ne 0 ]; then
  echo "FAIL: test_api_client.py tests failed"
  PASS=false
fi

# Verify all 3 methods still exist
for method in get post delete; do
  if ! grep -q "def ${method}" api_client.py; then
    echo "FAIL: api_client.py missing method '${method}'"
    PASS=false
  fi
done

if [ "$PASS" = false ]; then
  exit 1
fi

echo "PASS: all decorator pattern checks passed"
exit 0
