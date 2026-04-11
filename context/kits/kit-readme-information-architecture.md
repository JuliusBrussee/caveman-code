# Kit: README Information Architecture
**Domain:** readme-information-architecture
**Version:** 1.0.0
**Status:** draft

## Requirements

### R-001: Scannable structure
README must be organized so readers can quickly locate value proposition, setup, usage, and deeper capability areas. Structure must support both skim reading and targeted lookup.

**Acceptance Criteria:**
- AC-1: Major sections are ordered from orientation and value to installation, first use, capabilities, and deeper references.
- AC-2: Section headings are descriptive enough that a reader can predict section contents before reading body text.
- AC-3: Feature-heavy sections use tables, bullets, or other scan-friendly formats instead of long undifferentiated prose blocks.

### R-002: Progressive disclosure
README must separate beginner-critical information from advanced reference material. New users must be able to complete basic adoption without wading through extension, SDK, or edge-case detail.

**Acceptance Criteria:**
- AC-1: Beginner path can be followed without reading advanced customization or integration sections.
- AC-2: Advanced topics are visibly labeled or grouped so readers can skip them without losing core setup information.
- AC-3: README links each advanced topic area to a canonical deeper document or package-level reference.

### R-003: Capability discoverability
README must make major product capability areas easy to discover and understand. Readers must be able to identify what the product can do and where to learn more about each area.

**Acceptance Criteria:**
- AC-1: README covers the main capability categories currently relevant to adoption, including core usage, model/provider support, customization or extensibility, and structured workflows where applicable.
- AC-2: Each major capability category includes a short explanation of user value, not just a feature name.
- AC-3: README includes discoverable command names, paths, or terms that help users find the right feature again later.

## Out of Scope
- Full information-architecture redesign for package-level docs
- Search, website navigation, or docs-site taxonomy changes
- Exhaustive command reference for every supported feature