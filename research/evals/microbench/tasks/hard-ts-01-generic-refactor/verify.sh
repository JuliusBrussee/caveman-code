#!/bin/sh
set -e

PASS=true

# Check that no 'any' type remains in repository.ts
ANY_COUNT=$(grep -c '\bany\b' repository.ts || true)
if [ "$ANY_COUNT" -gt 0 ]; then
  echo "FAIL: repository.ts still contains ${ANY_COUNT} occurrences of 'any'"
  PASS=false
fi

# Check that Repository<T> is declared
if ! grep -q 'class Repository<T>' repository.ts; then
  echo "FAIL: repository.ts missing 'class Repository<T>'"
  PASS=false
fi

# Check that generic type parameter T is used in method signatures
if ! grep -q '<T>' repository.ts; then
  echo "FAIL: repository.ts missing generic type parameter '<T>'"
  PASS=false
fi

# Check that items array uses T
if ! grep -q 'T\[\]' repository.ts; then
  echo "FAIL: repository.ts missing 'T[]' typed array"
  PASS=false
fi

# Check find returns T or undefined
if ! grep -qE 'find\(.*\).*:.*T' repository.ts; then
  echo "FAIL: find() method should return T"
  PASS=false
fi

# Check save accepts T
if ! grep -qE 'save\(.*:.*T' repository.ts; then
  echo "FAIL: save() method should accept T parameter"
  PASS=false
fi

# Check list returns T[]
if ! grep -qE 'list\(.*\).*:.*T\[\]' repository.ts; then
  echo "FAIL: list() method should return T[]"
  PASS=false
fi

# Check delete returns T
if ! grep -qE 'delete\(.*\).*:.*T' repository.ts; then
  echo "FAIL: delete() method should return T"
  PASS=false
fi

# Check models.ts is untouched (should still have interfaces)
if ! grep -q 'interface User' models.ts; then
  echo "FAIL: models.ts User interface should be preserved"
  PASS=false
fi

if ! grep -q 'interface Product' models.ts; then
  echo "FAIL: models.ts Product interface should be preserved"
  PASS=false
fi

if [ "$PASS" = false ]; then
  exit 1
fi

echo "PASS: all generic refactor checks passed"
exit 0
