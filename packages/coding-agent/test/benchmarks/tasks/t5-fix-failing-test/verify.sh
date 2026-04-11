#!/bin/bash
set -e

# Check divide function throws on zero
grep -q 'throw' math.ts || { echo "FAIL: divide doesn't throw"; exit 1; }

# Check all functions still exist
grep -q 'function add' math.ts || { echo "FAIL: add missing"; exit 1; }
grep -q 'function multiply' math.ts || { echo "FAIL: multiply missing"; exit 1; }
grep -q 'function divide' math.ts || { echo "FAIL: divide missing"; exit 1; }
grep -q 'function average' math.ts || { echo "FAIL: average missing"; exit 1; }

echo "PASS"
