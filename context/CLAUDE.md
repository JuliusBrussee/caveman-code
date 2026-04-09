# Context Hierarchy

Cavekit context hierarchy for caveman-cli.

## Tiers

| Tier | Dir | Question | Entry |
|------|-----|----------|-------|
| 1 | refs/ | What IS | INDEX.md or subdirectory |
| 2 | kits/ | What MUST BE | cavekit-overview.md |
| 2b | designs/ | How it LOOKS | DESIGN.md |
| 3 | plans/ | HOW | plan-overview.md |
| 4 | impl/ | What WAS DONE | impl-overview.md |

## Navigation

- Start at tier overview. Load domain files only when overview points there.
- UI work: read DESIGN.md first.
- `blueprints/` is legacy. Use `kits/` for all new requirements.
- Commands: `/ck:sketch` (write kits), `/ck:map` (plan), `/ck:make` (build), `/ck:check` (inspect).
