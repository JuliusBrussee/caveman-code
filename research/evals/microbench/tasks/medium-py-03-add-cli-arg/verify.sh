#!/bin/sh
set -e

# Check that --format argument is added
grep -q '\-\-format' cli.py || { echo "FAIL: --format argument not found"; exit 1; }

# Check that choices include json, csv, and text
grep -q 'json' cli.py || { echo "FAIL: 'json' choice not found"; exit 1; }
grep -q 'csv' cli.py || { echo "FAIL: 'csv' choice not found"; exit 1; }
grep -q 'text' cli.py || { echo "FAIL: 'text' choice not found"; exit 1; }

# Check that default is json
grep -q "default.*json\|default.*'json'\|default.*\"json\"" cli.py || { echo "FAIL: default not set to json"; exit 1; }

# Check that choices keyword is used (argparse pattern)
grep -q 'choices' cli.py || { echo "FAIL: choices parameter not used in argparse"; exit 1; }

# Validate the parser actually works by running it
python -c "
import sys
sys.argv = ['cli.py', '--input', 'in.txt', '--output', 'out.txt', '--format', 'csv']
exec(open('cli.py').read().replace(\"if __name__\", \"if False\"))
from cli import build_parser
parser = build_parser()
args = parser.parse_args(['--input', 'in.txt', '--output', 'out.txt', '--format', 'csv'])
assert args.format == 'csv', f'Expected csv, got {args.format}'
args2 = parser.parse_args(['--input', 'in.txt', '--output', 'out.txt'])
assert args2.format == 'json', f'Expected json default, got {args2.format}'
print('Parser validation passed')
" || { echo "FAIL: parser validation failed"; exit 1; }

echo "PASS"
exit 0
