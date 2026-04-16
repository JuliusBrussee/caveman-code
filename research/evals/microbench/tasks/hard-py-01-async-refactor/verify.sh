#!/bin/sh
set -e

PASS=true

# Check data_fetcher.py has async def for all 3 functions
for fn in fetch_users fetch_orders fetch_product_details; do
  if ! grep -q "async def ${fn}" data_fetcher.py; then
    echo "FAIL: data_fetcher.py missing 'async def ${fn}'"
    PASS=false
  fi
done

# Check processor.py has async def for both functions
for fn in process_user_orders get_summary; do
  if ! grep -q "async def ${fn}" processor.py; then
    echo "FAIL: processor.py missing 'async def ${fn}'"
    PASS=false
  fi
done

# Check processor.py uses await
AWAIT_COUNT=$(grep -c "await" processor.py || true)
if [ "$AWAIT_COUNT" -lt 3 ]; then
  echo "FAIL: processor.py should have at least 3 await calls, found ${AWAIT_COUNT}"
  PASS=false
fi

# Check main.py uses asyncio.run
if ! grep -q "asyncio\.run" main.py; then
  echo "FAIL: main.py missing 'asyncio.run'"
  PASS=false
fi

# Check main.py imports asyncio
if ! grep -q "import asyncio" main.py; then
  echo "FAIL: main.py missing 'import asyncio'"
  PASS=false
fi

# Check main.py has async def main
if ! grep -q "async def main" main.py; then
  echo "FAIL: main.py missing 'async def main'"
  PASS=false
fi

# Verify the code actually runs without error
python main.py > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "FAIL: main.py does not execute successfully"
  PASS=false
fi

if [ "$PASS" = false ]; then
  exit 1
fi

echo "PASS: all async refactor checks passed"
exit 0
