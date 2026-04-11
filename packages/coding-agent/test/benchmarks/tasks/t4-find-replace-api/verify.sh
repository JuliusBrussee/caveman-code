#!/bin/bash
set -e

# No file should use fetchData anymore (except http.ts which defines it)
USAGE_COUNT=$(grep -r 'fetchData' --include='*.ts' . | grep -v 'http.ts' | wc -l | tr -d ' ')
[ "$USAGE_COUNT" -eq 0 ] || { echo "FAIL: fetchData still used in $USAGE_COUNT places outside http.ts"; exit 1; }

# All files should now use requestData
grep -q 'requestData' api-client.ts || { echo "FAIL: api-client.ts doesn't use requestData"; exit 1; }
grep -q 'requestData' dashboard.ts || { echo "FAIL: dashboard.ts doesn't use requestData"; exit 1; }

# Imports should reference requestData
grep -q "import.*requestData.*from" api-client.ts || { echo "FAIL: api-client.ts missing requestData import"; exit 1; }
grep -q "import.*requestData.*from" dashboard.ts || { echo "FAIL: dashboard.ts missing requestData import"; exit 1; }

echo "PASS"
