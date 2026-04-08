# Caveman Repository Structure

## Directory Organization

**Root Level Directories:**
- `.agents/` - Agent configurations
- `.claude-plugin/` - Claude plugin settings
- `.cursor/` - Cursor IDE integration
- `.github/` - GitHub workflows and issue templates
- `benchmarks/` - Performance testing suite
- `caveman/` - Main skill module
- `caveman-cn/` - Chinese language variant
- `caveman-compress/` - Compression utility
- `compress/` - Symlinked compression reference
- `docs/` - Documentation site
- `plugins/` - Plugin implementations
- `skills/` - Language-specific skills (English, Chinese, Spanish)
- `tests/` - Test cases for compression

**Root Files:**
- `caveman.skill` - Skill definition file
- `README.md` - Project documentation
- `LICENSE` - Apache 2.0 license
- `CONTRIBUTING.md` - Contribution guidelines
- `.gitignore`, `.gitattributes` - Git configuration

## Key Components

**Plugins Structure** (`plugins/caveman/`)
- Contains Codex plugin configuration
- Hosts three skills: `caveman`, `caveman-cn`, `compress`

**Skills Directory** (`skills/`)
- `caveman/` - Main English implementation
- `caveman-cn/` - Chinese translation
- `caveman-es/` - Spanish translation
- `compress/` - Symlinked compression tool

**Testing** (`tests/caveman-compress/`)
- Original and compressed markdown examples
- Test files: preferences, project notes, mixed code, todo lists

This represents a multi-language AI skill framework with compression optimization capabilities.
