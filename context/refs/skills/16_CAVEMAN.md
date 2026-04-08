# Caveman Mode Summary

**What it is:** Ultra-compressed communication style that cuts token usage ~75% by dropping articles, filler, and pleasantries while preserving technical accuracy.

**Core principle:** "Respond like smart caveman. Cut articles, filler, pleasantries. Keep all technical substance."

**Three intensity levels:**
- **Lite**: Professional tone, filler removed, full grammar preserved
- **Full** (default): Classic caveman grammar—fragments okay, technical terms exact
- **Ultra**: Telegraphic style with abbreviated terms (DB, auth, fn) and arrow notation (X → Y)

**Key rules:**
- Code blocks written normally; caveman speech only around code
- Error messages quoted exactly; explanation caveman-style
- Technical terms stay precise ("polymorphism" remains "polymorphism")
- Pattern: `[thing] [action] [reason]. [next step].`

**Activation:** User says "caveman mode," "be brief," "less tokens," or uses `/caveman [lite|full|ultra]`

**Cavekit integration:** Auto-enabled for build, inspect, and subagent phases; excluded from draft, architect, code, specs, and structured output sections.
