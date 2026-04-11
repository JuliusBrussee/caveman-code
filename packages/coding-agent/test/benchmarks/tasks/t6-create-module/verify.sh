#!/bin/bash
set -e

# Check files exist
[ -f "calculator.ts" ] || { echo "FAIL: calculator.ts not found"; exit 1; }
[ -f "calculator.test.ts" ] || { echo "FAIL: calculator.test.ts not found"; exit 1; }

# Check all functions exist
grep -q 'function add\|const add' calculator.ts || { echo "FAIL: add missing"; exit 1; }
grep -q 'function subtract\|const subtract' calculator.ts || { echo "FAIL: subtract missing"; exit 1; }
grep -q 'function multiply\|const multiply' calculator.ts || { echo "FAIL: multiply missing"; exit 1; }
grep -q 'function divide\|const divide' calculator.ts || { echo "FAIL: divide missing"; exit 1; }

# Check exports
grep -q 'export' calculator.ts || { echo "FAIL: functions not exported"; exit 1; }

# Check tests reference all functions
grep -q 'add' calculator.test.ts || { echo "FAIL: add not tested"; exit 1; }
grep -q 'subtract' calculator.test.ts || { echo "FAIL: subtract not tested"; exit 1; }
grep -q 'multiply' calculator.test.ts || { echo "FAIL: multiply not tested"; exit 1; }
grep -q 'divide' calculator.test.ts || { echo "FAIL: divide not tested"; exit 1; }

# Check division by zero handling
grep -q 'throw\|Error' calculator.ts || { echo "FAIL: no error handling for division by zero"; exit 1; }

echo "PASS"
