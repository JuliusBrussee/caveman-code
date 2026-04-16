#!/bin/sh
set -e

PASS=true

# Run all tests including performance test
python -m pytest test_search.py -v --tb=short 2>&1
if [ $? -ne 0 ]; then
  echo "FAIL: pytest test_search.py failed"
  PASS=false
fi

# Ensure the O(n^2) nested loop pattern is gone from find_pairs
# Count nested for-loops in find_pairs (should not have two for-loops in sequence)
# Extract find_pairs function and check for nested loops
NESTED_LOOPS=$(python3 -c "
import ast, sys
with open('search.py') as f:
    tree = ast.parse(f.read())
for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef) and node.name == 'find_pairs':
        for child in ast.walk(node):
            if isinstance(child, ast.For):
                for inner in ast.walk(child):
                    if isinstance(inner, ast.For) and inner is not child:
                        print('NESTED')
                        sys.exit(0)
print('OK')
" 2>&1)

if [ "$NESTED_LOOPS" = "NESTED" ]; then
  echo "FAIL: find_pairs still contains nested for-loops (O(n^2))"
  PASS=false
fi

# Verify correctness on a known case
RESULT=$(python3 -c "
from search import find_pairs
r = find_pairs([1,2,3,4,5], 6)
assert (1,5) in r
assert (2,4) in r
assert len(r) == 2
print('CORRECT')
" 2>&1)

if [ "$RESULT" != "CORRECT" ]; then
  echo "FAIL: find_pairs correctness check failed"
  PASS=false
fi

if [ "$PASS" = false ]; then
  exit 1
fi

echo "PASS: all optimization checks passed"
exit 0
