---
cavekit: documentation
version: 1.0.0
status: approved
created: 2026-04-08
updated: 2026-04-08
---

# Cavekit: Documentation

## Scope

Rewrite all user-facing documentation to reflect "Caveman Code" branding, correct paths, correct environment variables, and the fork's repository URL. Preserve upstream attribution.

## Requirements

### R1: Root README

**Description:** The root `README.md` must be fully rewritten for Caveman Code branding.

**Acceptance Criteria:**
- [ ] `README.md` contains "Caveman Code" in the first heading or first paragraph
- [ ] `README.md` does not contain the string `"Cave Pi"` as a product name
- [ ] `README.md` references the config directory as `~/.cave/` (not `~/.pi/`)
- [ ] `README.md` references environment variables with the `CAVE_` prefix where applicable (e.g., `CAVE_CODING_AGENT_DIR`)
- [ ] `README.md` contains an attribution line crediting the upstream `pi-mono` project and its author
- [ ] `README.md` references the fork repository URL `JuliusBrussee/caveman-cli`

**Dependencies:** cavekit-brand-cleanup (naming must be established)

### R2: Coding Agent README

**Description:** The `packages/coding-agent/README.md` must be rewritten for Caveman Code.

**Acceptance Criteria:**
- [ ] `packages/coding-agent/README.md` contains "Caveman Code" or "Cave" as the product name
- [ ] The file does not present itself as the upstream pi-mono project
- [ ] The file contains upstream attribution

**Dependencies:** cavekit-brand-cleanup (naming must be established)

### R3: Contributing Guide

**Description:** `CONTRIBUTING.md` must reflect "Contributing to Caveman Code" with updated framing.

**Acceptance Criteria:**
- [ ] `CONTRIBUTING.md` contains "Caveman Code" in its title or opening paragraph
- [ ] `CONTRIBUTING.md` does not use "Cave Pi" as the product name
- [ ] `CONTRIBUTING.md` retains instructions for syncing with the upstream repository
- [ ] `CONTRIBUTING.md` references the upstream remote URL `https://github.com/badlogic/pi-mono.git` in the sync instructions (this is correct -- it is the upstream)

**Dependencies:** cavekit-brand-cleanup (naming must be established)

### R4: AGENTS.md Link Templates

**Description:** `AGENTS.md` must use the fork's repository for issue and PR link templates instead of the upstream.

**Acceptance Criteria:**
- [ ] `AGENTS.md` does not contain `"github.com/badlogic/pi-mono/issues"` in link templates
- [ ] `AGENTS.md` does not contain `"github.com/badlogic/pi-mono/pull"` in link templates
- [ ] Issue link templates in `AGENTS.md` point to `github.com/JuliusBrussee/caveman-cli/issues`
- [ ] PR link templates in `AGENTS.md` point to `github.com/JuliusBrussee/caveman-cli/pull`

**Dependencies:** None

### R5: Package.json Repository URLs

**Description:** All `package.json` files with a `repository` field must point to the fork, not the upstream.

**Acceptance Criteria:**
- [ ] No `package.json` file in the repository contains `"badlogic/pi-mono.git"` in its `repository.url` field
- [ ] All `package.json` files that have a `repository.url` field use `"git+https://github.com/JuliusBrussee/caveman-cli.git"`

**Dependencies:** None

### R6: Prompt Template Link Fixes

**Description:** Prompt templates under `.pi/prompts/` that contain link templates must point to the fork repository.

**Acceptance Criteria:**
- [ ] `.pi/prompts/cl.md` does not contain `"github.com/badlogic/pi-mono/issues"` in link templates
- [ ] `.pi/prompts/cl.md` does not contain `"github.com/badlogic/pi-mono/pull"` in link templates
- [ ] `.pi/prompts/pr.md` does not contain `"github.com/badlogic/pi-mono/pull"` in link templates
- [ ] All link templates in `.pi/prompts/` reference `github.com/JuliusBrussee/caveman-cli`

**Dependencies:** None

### R7: GitHub Issue Templates

**Description:** GitHub issue templates must reference the fork's contributing guide, not the upstream's.

**Acceptance Criteria:**
- [ ] `.github/ISSUE_TEMPLATE/contribution.yml` does not contain `"github.com/badlogic/pi-mono"` in any URL
- [ ] The contributing guide link in the template points to `github.com/JuliusBrussee/caveman-cli`

**Dependencies:** None

## Out of Scope

- API documentation or generated docs
- Inline code comments or JSDoc
- CHANGELOG.md files -- upstream issue links in changelogs are historical records and must not be altered
- Internal context documents (`context/` directory beyond kits)

## Cross-References

- [cavekit-brand-cleanup](cavekit-brand-cleanup.md): Brand cleanup establishes the naming conventions this domain applies to docs
- [cavekit-overview](cavekit-overview.md): Master index of all domains

## Changelog

| Date       | Version | Change         |
|------------|---------|----------------|
| 2026-04-08 | 1.0.0   | Initial draft  |
