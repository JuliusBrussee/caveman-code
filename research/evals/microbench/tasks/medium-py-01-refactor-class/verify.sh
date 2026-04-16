#!/bin/sh
set -e

# Check that _format_header method is defined
grep -q 'def _format_header' report.py || { echo "FAIL: _format_header method not found"; exit 1; }

# Check that generate method still exists
grep -q 'def generate' report.py || { echo "FAIL: generate method not found"; exit 1; }

# Check that generate calls _format_header
# Look for _format_header() call (not the def line)
CALL_COUNT=$(grep -c '_format_header' report.py)
if [ "$CALL_COUNT" -lt 2 ]; then
  echo "FAIL: generate() does not appear to call _format_header()"
  exit 1
fi

# Check that _format_header is inside the class (indented def)
grep -q '    def _format_header' report.py || { echo "FAIL: _format_header should be a method of the class"; exit 1; }

echo "PASS"
exit 0
