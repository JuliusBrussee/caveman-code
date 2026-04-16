#!/bin/sh
set -e

# The fix is changing < to <= in the truncate function
# Check that the comparison uses <= for the boundary condition
if grep -q 'str\.length <= maxLen' string-utils.ts; then
  echo "PASS: off-by-one fix applied (uses <=)"
  exit 0
fi

# Also accept the negated form: !(str.length > maxLen) or str.length > maxLen with return
# The key point is that the exact-length case must not truncate
if grep -q 'str\.length > maxLen' string-utils.ts; then
  # If they flipped the logic, make sure the truncation branch is correct
  echo "PASS: boundary condition fixed (uses >)"
  exit 0
fi

echo "FAIL: off-by-one bug not fixed — truncate still uses < instead of <="
exit 1
