---
created: 2026-04-08
last_edited: 2026-04-08
status: draft
domain: fork-identity
depends_on: []
---

# Blueprint: Fork Identity

## Scope

This blueprint covers the package renaming, CLI binary identity, configuration directory, startup banner, and upstream tracking setup that differentiate Cave Pi from upstream Pi. It establishes the public-facing identity of the fork while preserving full upstream compatibility for rebasing.

This blueprint does NOT cover any behavioral modifications to the agent (those belong in blueprint-cave-mode) or the CaveKit extension (blueprint-extension-core and siblings).

## Requirements

### R1: CLI Binary Name

**Description:** The fork exposes a CLI binary named `cave` instead of `pi`. Users invoke all commands through this binary name.

**Acceptance Criteria:**
- [ ] AC-1: After installation, running `cave --version` outputs a version string containing the fork's version identifier.
- [ ] AC-2: Running `cave --help` produces help output that references the `cave` binary name, not `pi`.
- [ ] AC-3: All subcommands available under `pi` (e.g., `pi -p`, `pi install`) are available under `cave` with identical behavior.

### R2: Package Scope Rename

**Description:** All published packages use a new npm scope that distinguishes them from upstream Pi packages.

**Acceptance Criteria:**
- [ ] AC-1: Every `package.json` in the monorepo uses a consistent scope prefix that differs from the upstream `@mariozechner/` scope.
- [ ] AC-2: The root `package.json` name and description reference Cave Pi, not upstream Pi.
- [ ] AC-3: Running `npm run build` from the monorepo root succeeds with all renamed packages resolving correctly.

### R3: Configuration Directory

**Description:** Cave Pi uses a dedicated configuration directory separate from upstream Pi's default, so both can coexist on the same machine.

**Acceptance Criteria:**
- [ ] AC-1: When no environment override is set, Cave Pi reads and writes configuration to a directory path that is distinct from upstream Pi's default (`~/.pi/`).
- [ ] AC-2: Setting the appropriate environment variable overrides the default configuration directory path.
- [ ] AC-3: An existing upstream Pi installation's configuration directory is not read from or written to by Cave Pi.

### R4: Startup Banner

**Description:** The startup banner identifies the application as Cave Pi and includes a token savings indicator.

**Acceptance Criteria:**
- [ ] AC-1: Launching `cave` in interactive mode displays a banner that includes the Cave Pi name.
- [ ] AC-2: The banner includes a visual indicator related to token savings or compression status.
- [ ] AC-3: The banner does not reference upstream Pi's branding as the product name.

### R5: Upstream Remote Tracking

**Description:** The fork maintains a git remote configured for fetching upstream changes without accidental pushes.

**Acceptance Criteria:**
- [ ] AC-1: The repository has a git remote named `upstream` pointing to the upstream Pi repository URL.
- [ ] AC-2: The `upstream` remote's push URL is configured to prevent accidental pushes (e.g., set to a non-functional URL).
- [ ] AC-3: Running `git fetch upstream` retrieves the latest upstream commits without error.

### R6: License Preservation

**Description:** The fork preserves the upstream MIT license and adds appropriate attribution.

**Acceptance Criteria:**
- [ ] AC-1: The repository root contains a LICENSE file with the MIT license text.
- [ ] AC-2: The README or LICENSE file includes attribution to the upstream Pi project.

## Out of Scope

- Behavioral modifications to the agent (system prompt, compaction, tool compression) -- see blueprint-cave-mode
- CaveKit extension packaging or distribution -- see blueprint-extension-core
- Automated rebase scripts or CI pipelines for upstream sync
- npm publishing automation

## Cross-References

- blueprint-cave-mode: Depends on fork-identity for the CLI binary and settings infrastructure
- blueprint-extension-core: Depends on fork-identity for the package scope and config directory
- PRD reference: Part 1 sections 1.1 and 1.5

## Changelog

| Date | Change |
|------|--------|
| 2026-04-08 | Initial draft |
