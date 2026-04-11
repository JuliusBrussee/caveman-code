# Kit: README Trust Signals
**Domain:** readme-trust-signals
**Version:** 1.0.0
**Status:** draft

## Requirements

### R-001: Evidence-backed claims
README must present claims in a way that readers can trust. Statements about savings, performance, support breadth, or product advantages must be supported, scoped, or explicitly framed as non-quantified positioning.

**Acceptance Criteria:**
- AC-1: Any quantified claim in README includes enough context for a reader to understand what was measured or where supporting evidence lives.
- AC-2: Claims about supported providers, workflows, or extension capabilities match currently available product behavior.
- AC-3: README distinguishes clearly between current capabilities and future or planned work.

### R-002: Consistent product identity
README must reinforce a coherent product identity across names, commands, paths, and links. Readers must not need to reconcile conflicting branding or legacy terminology to get started.

**Acceptance Criteria:**
- AC-1: Product name, binary name, config path, repository links, and visual assets use consistent current identity throughout README.
- AC-2: Core setup instructions can be completed without prior knowledge of upstream naming, deprecated aliases, or historical branding.
- AC-3: If upstream relationship matters, README explains it once in a concise way that does not interrupt core onboarding.

### R-003: Contribution and project-health confidence
README must help readers judge whether project is usable, maintained, and open to contribution. It must surface essential support and contribution entry points without forcing readers into repository archaeology.

**Acceptance Criteria:**
- AC-1: README states where users should go for issues, documentation, and contribution guidance.
- AC-2: README communicates compatibility expectations that materially affect adoption, such as required runtime versions or supported environments.
- AC-3: README distinguishes baseline supported usage from optional, experimental, or ecosystem-dependent features when that distinction affects user trust.

## Out of Scope
- Formal security policy or vulnerability response process
- Full benchmark methodology document
- Release-note history or changelog maintenance