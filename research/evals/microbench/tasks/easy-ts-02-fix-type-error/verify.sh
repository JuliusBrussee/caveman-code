#!/bin/sh
set -e

FILE="user.ts"

# The bug was: age: "twenty-five" (a string literal assigned to a number field)
# Verify that the string literal "twenty-five" is no longer assigned to age
if grep -q '"twenty-five"' "$FILE"; then
  echo "FAIL: String literal \"twenty-five\" still assigned to age"
  exit 1
fi

# Verify age field is now assigned a number value (digits)
if ! grep 'age:' "$FILE" | grep -qE '[0-9]+'; then
  echo "FAIL: age field does not have a numeric value"
  exit 1
fi

# Verify the User interface still exists with age as number
if ! grep -q 'age: number' "$FILE"; then
  echo "FAIL: User interface should still have age: number"
  exit 1
fi

echo "PASS: Type error fixed — age is assigned a number"
exit 0
