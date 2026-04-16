#!/bin/sh
set -e

# Check that MemoryCache class exists
grep -q 'class MemoryCache' cache.ts || { echo "FAIL: MemoryCache class not found"; exit 1; }

# Check that it implements Cache
grep -q 'implements Cache' cache.ts || { echo "FAIL: MemoryCache does not implement Cache"; exit 1; }

# Check that it uses Map internally
grep -q 'new Map' cache.ts || grep -q 'Map<' cache.ts || { echo "FAIL: Map not used internally"; exit 1; }

# Check that ttlMs parameter exists on set
grep -q 'ttlMs' cache.ts || grep -q 'ttl' cache.ts || { echo "FAIL: ttlMs parameter not found on set method"; exit 1; }

# Check that all interface methods are present
grep -q 'get(' cache.ts || { echo "FAIL: get method not found"; exit 1; }
grep -q 'set(' cache.ts || { echo "FAIL: set method not found"; exit 1; }
grep -q 'delete(' cache.ts || { echo "FAIL: delete method not found"; exit 1; }
grep -q 'has(' cache.ts || { echo "FAIL: has method not found"; exit 1; }
grep -q 'clear(' cache.ts || { echo "FAIL: clear method not found"; exit 1; }

echo "PASS"
exit 0
