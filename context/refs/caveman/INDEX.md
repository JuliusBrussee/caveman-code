# Caveman Reference Materials Index

Complete fetched documentation from https://github.com/JuliusBrussee/caveman

## Quick Reference

### Core Documentation
- **[skills/caveman/SKILL.md](skills/caveman/SKILL.md)** - Source of truth: Caveman mode rules, intensity levels, core principles
- **[README.md](README.md)** - Project overview, features, token savings metrics
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution workflow and guidelines

### Language Variants
- **[skills/caveman-cn/SKILL.md](skills/caveman-cn/SKILL.md)** - Chinese (中文) caveman mode documentation

### Compression Tool
- **[caveman-compress/README.md](caveman-compress/README.md)** - Token compression for memory files (CLAUDE.md, etc.)

### Structure
- **[REPO_STRUCTURE.md](REPO_STRUCTURE.md)** - Repository layout and directory organization

## Key Takeaways

### Caveman Mode Core Rules
1. Drop articles (a, an, the), filler words, pleasantries, hedging language
2. Keep code blocks, technical terms, error messages unchanged
3. Use fragments: "[thing] [action] [reason]. [next step]."
4. Three intensity levels: lite, full (default), ultra
5. Auto-revert to normal for security warnings and irreversible actions

### Compression Benefits
- ~65% token reduction for output
- ~45% token reduction for memory files
- Preserves code, URLs, technical terms, headings
- Single CLI call: `/caveman:compress CLAUDE.md`

### Contributing
- Edit only `skills/caveman/SKILL.md` (single source of truth)
- Submit PRs with before/after examples
- All other copies auto-sync after merge
- Philosophy: "Small focused change > big rewrite"

## File Status
All files successfully fetched and saved to:
`/Users/julb/Desktop/GitHub/caveman-cli/context/refs/caveman/`

Note: .claude-plugin file was not available at expected path (404 error).
caveman.skill file is a binary/compiled format that could not be fetched as text.
