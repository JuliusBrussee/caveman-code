# Claude Code Hooks README

Based on the provided documentation, here's a summary of the Claude Code Hooks system:

## Overview

This is a shell-based `PreToolUse` hook implementation that enables transparent command rewriting through JSON manipulation.

## Key Features

**Core Functionality:**
- "Shell-based `PreToolUse` hook -- requires `jq` for JSON parsing"
- The system returns modified input parameters without the agent's awareness of any rewriting occurring
- Implements graceful failure handling that exits cleanly when dependencies are unavailable

**Safety Mechanisms:**
- Silently exits (exit 0) if critical tools are missing: jq, rtk, or if rtk version is below 0.23.0
- Includes version validation to ensure minimum rtk compatibility
- A slim documentation file (`rtk-awareness.md`) is automatically embedded during initialization

## Testing Capabilities

The test suite includes:
- Comprehensive validation with "60+ assertions"
- Customizable hook path specification via `HOOK` environment variable
- Optional audit logging through `RTK_HOOK_AUDIT=1` and `RTK_AUDIT_DIR` flags

## Usage

Execute the test suite with:
```bash
bash hooks/test-rtk-rewrite.sh
```

This documentation references implementation details located in both the hooks directory and `src/hooks/` for installation procedures.
