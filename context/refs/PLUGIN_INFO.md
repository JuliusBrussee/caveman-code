# Cavekit Plugin Information

## Plugin Metadata

**Name:** ck  
**Version:** 2.0.0  
**Alias:** bp (deprecated)  
**Type:** Claude Code Plugin  

## Installation

The plugin is installed via `install.sh` which:

1. Creates a local marketplace at `~/.claude/plugins/local/cavekit-marketplace`
2. Symlinks the repository as both "ck" (primary) and "bp" (deprecated alias) plugins
3. Registers plugins with Claude Code via `~/.claude/settings.json`
4. Executes `scripts/sync-codex-plugin.sh` to configure local plugin sync
5. Links prompts to `~/.codex/prompts`
6. Makes scripts executable and creates symlink to `/usr/local/bin/cavekit`

## Available Commands

The plugin exposes the following Claude Code slash commands:

### Core Hunt Lifecycle
- `/ck:sketch` - Draft requirements (Transform into kits)
- `/ck:map` - Architect (Create build plan from specs)
- `/ck:make` - Build (Execute with validation)
- `/ck:check` - Inspect (Verify against specs)

### Supporting Commands
- `/ck:progress` - Monitor build progress
- `/ck:help` - Display help
- `/ck:config` - Configuration management
- `/ck:design` - Design system operations
- `/ck:quick` - Quick operations
- `/ck:research` - Research mode
- `/ck:revise` - Revision mode
- `/ck:init` - Initialize context structure
- `/ck:scan` - Scan codebase
- `/ck:judge` - Judgment/review

## Terminal Integration

In addition to Claude Code commands, the installer creates:
- `cavekit` - Main CLI tool
- `launch-session` - Start sessions
- `status-poller` - Monitor builds
- `analytics` - View analytics
- Additional utility scripts

All scripts are symlinked to `/usr/local/bin/` for global access.

## Requirements

- git
- Claude Code environment
- Optional: Python3 for JSON configuration updates
- Optional: Codex CLI for advanced review features
