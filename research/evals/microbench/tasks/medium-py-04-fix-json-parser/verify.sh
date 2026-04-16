#!/bin/sh
set -e

# Run the tests — they must all pass
python -m pytest test_parser.py -v
echo "PASS"
exit 0
