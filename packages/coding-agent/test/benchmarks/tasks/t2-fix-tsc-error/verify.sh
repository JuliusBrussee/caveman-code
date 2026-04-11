#!/bin/bash
set -e

# Check tsc passes
npx tsc --noEmit 2>&1 || { echo "FAIL: TypeScript errors remain"; exit 1; }

# Check functions still exist
grep -q 'getActiveUsers' broken.ts || { echo "FAIL: getActiveUsers missing"; exit 1; }
grep -q 'getUserEmail' broken.ts || { echo "FAIL: getUserEmail missing"; exit 1; }
grep -q 'createUser' broken.ts || { echo "FAIL: createUser missing"; exit 1; }

echo "PASS"
