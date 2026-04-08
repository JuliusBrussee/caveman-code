#!/bin/bash
# RTK Claude Code Hook Script

# RTK (Rewrite Token Kit) integration hook for Anthropic's Claude Code CLI.
# This hook automatically rewrites CLI commands to use RTK equivalents, reducing token consumption.

# Purpose
# This hook automatically rewrites CLI commands to use RTK equivalents, reducing token consumption.
# As stated in the header: "RTK Claude Code hook — rewrites commands to use rtk for token savings."

## Key Components

### Dependency Checks
# The script verifies that both `jq` and `rtk` (version ≥ 0.23.0) are installed before proceeding.

### Command Processing
# It extracts the command from the input JSON using `jq`, then delegates rewriting logic to the
# `rtk rewrite` binary—described as "the single source of truth" for rewrite rules.

### Exit Code Handling
# The script interprets four exit codes:
# - `0`: Rewrite successful → auto-allow
# - `1`: No RTK equivalent → pass through unchanged
# - `2`: Deny rule matched → let Claude Code handle denial
# - `3`: Ask rule matched → rewrite but prompt user for confirmation

### Output
# The script returns JSON with the rewritten command and an appropriate permission decision,
# enabling Claude Code to either auto-approve, request user confirmation, or deny execution.

# The script is deliberately thin—all rewrite logic resides in the Rust registry
# (`src/discover/registry.rs`) rather than the shell script itself, ensuring maintainability.

set -e

# Check dependencies: jq and rtk
if ! command -v jq &> /dev/null; then
    exit 0
fi

if ! command -v rtk &> /dev/null; then
    exit 0
fi

# Version check
rtk_version=$(rtk --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
if [ -z "$rtk_version" ]; then
    exit 0
fi

# Parse input JSON to extract command
command=$(echo "$1" | jq -r '.tool // .command // empty' 2>/dev/null)

if [ -z "$command" ]; then
    exit 0
fi

# Call rtk rewrite to get optimized command
rewritten=$(rtk rewrite "$command" 2>/dev/null)
rewrite_exit=$?

# Interpret exit codes
case $rewrite_exit in
    0)
        # Rewrite successful → auto-allow
        echo "$1" | jq --arg cmd "$rewritten" '.tool = $cmd // . | .permission = "auto_allow"'
        exit 0
        ;;
    1)
        # No RTK equivalent → pass through unchanged
        echo "$1" | jq '.permission = "auto_allow"'
        exit 0
        ;;
    2)
        # Deny rule matched
        echo "$1" | jq '.permission = "deny"'
        exit 0
        ;;
    3)
        # Ask rule matched
        echo "$1" | jq --arg cmd "$rewritten" '.tool = $cmd // . | .permission = "ask"'
        exit 0
        ;;
    *)
        # Unknown exit code, pass through
        echo "$1" | jq '.permission = "auto_allow"'
        exit 0
        ;;
esac
