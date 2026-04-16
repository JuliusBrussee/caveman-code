#!/bin/sh
set -e

# Check that console-logger.ts was created
if [ ! -f console-logger.ts ]; then
  echo "FAIL: console-logger.ts not found"
  exit 1
fi

# Check that it implements Logger
grep -q 'implements Logger' console-logger.ts || { echo "FAIL: ConsoleLogger does not implement Logger"; exit 1; }

# Check that constructor accepts a prefix parameter
grep -q 'constructor' console-logger.ts || { echo "FAIL: no constructor found"; exit 1; }
grep -q 'prefix' console-logger.ts || { echo "FAIL: no prefix parameter found"; exit 1; }

# Check that it imports from types.ts
grep -q "from.*types" console-logger.ts || grep -q "import.*Logger" console-logger.ts || { echo "FAIL: does not import Logger from types"; exit 1; }

# Check that console.log, console.warn, console.error are used
grep -q 'console\.log' console-logger.ts || { echo "FAIL: console.log not used"; exit 1; }
grep -q 'console\.warn' console-logger.ts || { echo "FAIL: console.warn not used"; exit 1; }
grep -q 'console\.error' console-logger.ts || { echo "FAIL: console.error not used"; exit 1; }

echo "PASS"
exit 0
