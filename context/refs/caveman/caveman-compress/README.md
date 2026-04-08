# caveman-compress

**caveman-compress** is a Claude Code skill that shrinks project memory files by compressing natural language while preserving technical content, reducing token costs across sessions.

## Core Function

The skill compresses files like `CLAUDE.md` into a caveman format, automatically cutting approximately 45% of tokens. As stated in the documentation, "Claude read `CLAUDE.md` on every session start. If file big, cost big."

## How It Works

Running `/caveman:compress CLAUDE.md` performs these steps:

1. Detects file type (supports `.md`, `.txt`, `.rst`, and extensionless natural language)
2. Compresses content via Claude API call
3. Validates output to ensure headings, code blocks, URLs, and file paths remain intact
4. Applies targeted fixes if validation fails (rather than full recompression)
5. Writes compressed version to original filename
6. Saves human-readable backup as `.original.md`

## What Gets Preserved

The compression safeguards:
- Code blocks and inline code
- URLs, links, and file paths
- Technical terms and library names
- Headings and table structures
- Dates, versions, and numeric values

## Token Savings

Real-world benchmarks show:
- Average compression: 45% token reduction
- Range: 35.4% to 59.6% depending on file type
- Cost benefit applies to every future session using that project

## Installation

The skill comes built into the `caveman` plugin. Requires Python 3.10+.

## Why It Matters

Since `CLAUDE.md` loads at session start, a 1000-token memory file multiplies its cost across hundreds of sessions. This tool reduces that overhead significantly while maintaining instruction accuracy.
