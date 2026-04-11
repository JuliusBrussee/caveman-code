# Kit: README Onboarding
**Domain:** readme-onboarding
**Version:** 1.0.0
**Status:** draft

## Requirements

### R-001: Fast installation path
README must provide a clear, recommended path from zero setup to a runnable installation. New users must not need to compare multiple ambiguous setup flows before they can begin.

**Acceptance Criteria:**
- AC-1: README presents 1 primary installation path before any advanced or alternative setup paths.
- AC-2: README lists required prerequisites, versions, and external accounts or credentials needed for first use.
- AC-3: Installation instructions are complete enough to execute without consulting another document for baseline setup.

### R-002: First-run success path
README must show the shortest path from installation to a successful first interaction. Initial setup guidance must minimize friction and make expected outcomes visible.

**Acceptance Criteria:**
- AC-1: README includes a step-by-step first-run flow from install to first useful command or session.
- AC-2: First-run flow covers the minimum authentication or configuration needed to complete that first successful use.
- AC-3: README states what success looks like after the first-run flow so users can verify they are on track.

### R-003: Next-step guidance without overload
README must help users continue after first success without forcing them through every advanced option immediately. It must separate essential setup from optional exploration.

**Acceptance Criteria:**
- AC-1: README points readers from quick start to at least 2 relevant next-step destinations for deeper learning.
- AC-2: README identifies at least 1 common setup blocker and where to resolve it.
- AC-3: Quick-start section does not require users to read customization, SDK, or extension material before completing first use.

## Out of Scope
- Full troubleshooting catalog for every provider or platform edge case
- Detailed migration guides from upstream tools
- Deep configuration reference for all flags and environment variables