#!/bin/sh
set -e

FILE="app.py"

# The broken import was: from helpers import sanitize_input, validate_email
# The fix should be: from utils.helpers import ...
if grep -q '^from helpers import' "$FILE"; then
  echo "FAIL: Still using broken 'from helpers import' (missing utils package)"
  exit 1
fi

# Check that the correct import path is used
if ! grep -qE '^from utils\.helpers import|^from utils import helpers' "$FILE"; then
  echo "FAIL: Expected 'from utils.helpers import ...' or 'from utils import helpers'"
  exit 1
fi

# Verify the imported names are still present
if ! grep -q 'sanitize_input' "$FILE"; then
  echo "FAIL: sanitize_input import missing"
  exit 1
fi

if ! grep -q 'validate_email' "$FILE"; then
  echo "FAIL: validate_email import missing"
  exit 1
fi

echo "PASS: Import path correctly references utils.helpers"
exit 0
