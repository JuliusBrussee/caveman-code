#!/bin/sh
set -e

FILE="fetch-data.ts"

# Check for try block
if ! grep -q 'try' "$FILE"; then
  echo "FAIL: No try block found in $FILE"
  exit 1
fi

# Check for catch block
if ! grep -q 'catch' "$FILE"; then
  echo "FAIL: No catch block found in $FILE"
  exit 1
fi

# Check that response.ok or !response.ok is checked
if ! grep -qE 'response\.ok|\.ok' "$FILE"; then
  echo "FAIL: No response.ok check found"
  exit 1
fi

# Check that an error is thrown for non-ok responses
if ! grep -q 'throw' "$FILE"; then
  echo "FAIL: No throw statement found for error cases"
  exit 1
fi

echo "PASS: Error handling with try/catch and response.ok check present"
exit 0
