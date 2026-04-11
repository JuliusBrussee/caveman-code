#!/bin/bash
set -e

# Check both files exist
[ -f "main.ts" ] || { echo "FAIL: main.ts not found"; exit 1; }
[ -f "utils.ts" ] || { echo "FAIL: utils.ts not found"; exit 1; }

# Check utils.ts has calculateTax
grep -q 'calculateTax' utils.ts || { echo "FAIL: calculateTax not in utils.ts"; exit 1; }
grep -q 'export' utils.ts || { echo "FAIL: calculateTax not exported from utils.ts"; exit 1; }

# Check main.ts imports from utils
grep -q "from.*['\"]./utils" main.ts || { echo "FAIL: main.ts doesn't import from utils"; exit 1; }
grep -q 'calculateTax' main.ts || { echo "FAIL: main.ts doesn't use calculateTax"; exit 1; }

# Check processOrder still exists
grep -q 'processOrder' main.ts || { echo "FAIL: processOrder missing from main.ts"; exit 1; }

echo "PASS"
