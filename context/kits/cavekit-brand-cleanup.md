---
cavekit: brand-cleanup
version: 1.0.0
status: approved
created: 2026-04-08
updated: 2026-04-08
---

# Cavekit: Brand Cleanup

## Scope

Remove all user-facing "Pi" references from the codebase, replacing them with "Cave" or "Caveman Code" as appropriate. This is a text/string sweep only -- no structural, architectural, or package-name changes. The license file is explicitly excluded.

## Requirements

### R1: Process Title

**Description:** The process title visible to the OS must read `"cave"`, not `"pi"`.

**Acceptance Criteria:**
- [ ] `packages/coding-agent/src/cli.ts` sets `process.title` to `"cave"`
- [ ] `packages/coding-agent/src/bun/cli.ts` sets `process.title` to `"cave"`
- [ ] No file in `packages/` sets `process.title` to any value containing `"pi"` (case-insensitive, whole-word)

**Dependencies:** None

### R2: Onboarding Hint Text

**Description:** The onboarding hint shown to new users must reference "Cave", not "Pi".

**Acceptance Criteria:**
- [ ] `packages/coding-agent/src/modes/interactive/interactive-mode.ts` contains the string `"Cave can explain"` in the onboarding hint
- [ ] The same file does not contain the string `"Pi can explain"`

**Dependencies:** None

### R3: Tmux Warning Text

**Description:** The tmux compatibility warning must reference "Cave", not "Pi".

**Acceptance Criteria:**
- [ ] `packages/coding-agent/src/modes/interactive/interactive-mode.ts` contains the string `"Cave works best"` in the tmux warning
- [ ] The same file does not contain the string `"Pi works best"`

**Dependencies:** None

### R4: System Prompt References

**Description:** All system prompt text sent to the model must reference "Cave" documentation, not "Pi" documentation.

**Acceptance Criteria:**
- [ ] `packages/coding-agent/src/core/system-prompt.ts` does not contain the substring `"Pi documentation"` (case-sensitive)
- [ ] `packages/coding-agent/src/core/system-prompt.ts` contains `"Cave documentation"` wherever the upstream had `"Pi documentation"`
- [ ] A grep for the whole-word pattern `\bPi\b` across `packages/coding-agent/src/core/system-prompt.ts` returns zero user-facing hits (comments and license headers excluded)

**Dependencies:** None

### R5: Share Viewer URL

**Description:** The default share viewer URL must not point to `pi.dev`.

**Acceptance Criteria:**
- [ ] `packages/coding-agent/src/config.ts` does not contain the string `"pi.dev/session/"` in `DEFAULT_SHARE_VIEWER_URL`
- [ ] The replacement value is an empty string (feature disabled until a caveman-cli domain exists)

**Dependencies:** None

### R6: Bun Binary Update URL

**Description:** The URL used to check for / download binary updates must point to the fork repository, not the upstream.

**Acceptance Criteria:**
- [ ] `packages/coding-agent/src/config.ts` does not contain the string `"badlogic/pi-mono/releases"`
- [ ] The replacement URL contains `"JuliusBrussee/caveman-cli/releases"`

**Dependencies:** None

### R7: Binary Release Artifact Names

**Description:** Build scripts and CI workflows must produce artifacts named `cave-*`, not `pi-*`.

**Acceptance Criteria:**
- [ ] `scripts/build-binaries.sh` does not produce output filenames starting with `pi-`
- [ ] `.github/workflows/build-binaries.yml` does not reference artifact names starting with `pi-`
- [ ] All artifact name patterns in both files use the `cave-` prefix

**Dependencies:** None

### R8: Test Script Paths

**Description:** Test scripts must reference the `~/.cave/` config directory, not `~/.pi/`.

**Acceptance Criteria:**
- [ ] `test.sh` does not contain the path `$HOME/.pi/`
- [ ] `test.sh` references `$HOME/.cave/agent/auth.json` (or equivalent under `~/.cave/`)

**Dependencies:** None

### R9: Earendil Announcement Text

**Description:** The Earendil announcement component must say "Caveman Code", not "Cave Pi".

**Acceptance Criteria:**
- [ ] `packages/coding-agent/src/modes/interactive/components/earendil-announcement.ts` does not contain the string `"Cave Pi"` (case-sensitive)
- [ ] The same file contains `"Caveman Code"` where the product name appears

**Dependencies:** None

### R10: CLI Args Help Text

**Description:** The CLI `--help` output and args description must not reference `pi.dev`.

**Acceptance Criteria:**
- [ ] `packages/coding-agent/src/cli/args.ts` does not contain the string `"pi.dev/session/"` in any help text or env var description

**Dependencies:** R5

## Out of Scope

- npm package names (`@cavepi/*`) -- these are intentionally preserved
- Import paths and internal module names
- Internal variable/function names (e.g., a variable called `piConfig` is fine)
- License file (`LICENSE`) -- upstream copyright must remain untouched
- CHANGELOG.md files -- upstream issue links are historical records
- Code comments that reference the upstream project by name for attribution

## Cross-References

- [cavekit-documentation](cavekit-documentation.md): Documentation domain handles README, CONTRIBUTING, AGENTS.md rewrites
- [cavekit-startup-experience](cavekit-startup-experience.md): Startup domain will replace the Earendil component; R9 ensures the fallback text is correct

## Changelog

| Date       | Version | Change         |
|------------|---------|----------------|
| 2026-04-08 | 1.0.0   | Initial draft  |
