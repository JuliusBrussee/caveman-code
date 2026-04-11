/**
 * /ck:help — Show CaveKit command reference.
 *
 * AC-1: Lists all /ck:* commands with descriptions.
 * AC-2: Per-command detailed help (e.g., /ck:help draft).
 */

import type { ExtensionAPI } from "cave";
import type { CaveKitConfig } from "../config/index.js";

const HELP_TEXT = `
╔══ CaveKit — Spec-Driven Development for Pi ═══════════════════╗
║                                                                ║
║  DABI Lifecycle:                                               ║
║    /ck:draft <description>   Decompose idea into domain kits   ║
║    /ck:architect [name]      Build tiered task graph from kits ║
║    /ck:build [site]          Execute wave-based parallel build  ║
║    /ck:inspect               Gap analysis vs. requirements     ║
║                                                                ║
║  Supporting:                                                   ║
║    /ck:research <topic>      Parallel research → brief         ║
║    /ck:design <sub>          Manage DESIGN.md constraints      ║
║    /ck:progress              Show build progress               ║
║    /ck:config [key] [value]  View/change configuration         ║
║    /ck:help [command]        This help or per-command detail    ║
║                                                                ║
║  Design subcommands: create | audit | import | show            ║
║                                                                ║
║  Config keys: preset | tierGateMode | commandGate |            ║
║               cavemanLevel | maxIterations | maxParallel |     ║
║               worktreeIsolation | speculativeReview            ║
║                                                                ║
║  Run /ck:help <command> for detailed usage (e.g. /ck:help draft)║
╚════════════════════════════════════════════════════════════════╝
`.trim();

/** Per-command detail strings (AC-2). */
const COMMAND_HELP: Record<string, string> = {
	draft: `
/ck:draft <description>
  Decompose a natural language description into domain kits.

  Arguments:
    <description>   Plain English description of the feature to build

  Output:
    context/kits/kit-{domain}.md  — one file per domain

  Kit structure:
    - Domain name
    - R-numbered requirements (R-001, R-002, …)
    - Acceptance criteria per requirement (AC-1, AC-2, …)

  Reads reference materials from context/refs/ when present.
  After generation, displays a summary table of kits and ACs.

  Example:
    /ck:draft Build a user authentication system with OAuth
`.trim(),

	architect: `
/ck:architect [site-name]
  Generate a tiered build site from approved kits.

  Arguments:
    [site-name]   Optional name for the build site file (default: build-site)

  Reads:
    context/kits/kit-*.md

  Output:
    context/sites/{site-name}.md  — task graph with tier assignments

  Each task has:
    - T-numbered ID (T-001, T-002, …)
    - Tier assignment (parallel-safe within a tier)
    - Dependency edges (cross-tier ordering)
    - Kit references (which ACs it implements)
    - Complexity estimate (S/M/L)

  Includes a coverage matrix confirming all ACs map to at least one task.

  Example:
    /ck:architect auth-site
`.trim(),

	build: `
/ck:build [site-file]
  Execute a build site through wave-based parallel dispatch.

  Arguments:
    [site-file]   Optional path to a specific build site (default: latest)

  Reads:
    context/sites/  — picks the most recent build site

  Process:
    1. Topological sort → compute execution waves
    2. Dispatch tasks within each wave concurrently
    3. Validate ACs after each task completes
    4. Run tier gate adversarial review at each tier boundary
    5. Retry failed tasks up to maxRetries

  Tasks that exhaust retries are marked blocked.
  Tier gate findings with P0/P1 severity pause the build for user action.

  Example:
    /ck:build
    /ck:build context/sites/auth-site.md
`.trim(),

	inspect: `
/ck:inspect
  Run gap analysis comparing built code against kit requirements.

  Reads:
    context/kits/    — original requirements
    context/sites/   — planned tasks
    context/impl/    — implementation records (if present)

  Output:
    context/reports/gap-analysis-{timestamp}.md

  Each AC is classified as:
    ✓ fully met | ⚠ partially met | ✗ missing

  Over-builds (code with no kit trace) are also flagged.
  Findings include severity levels (P0–P3) and remediation tasks.
`.trim(),

	research: `
/ck:research <topic>
  Dispatch research subagents to investigate a topic and synthesize a brief.

  Arguments:
    <topic>   The topic or question to research

  Output:
    context/refs/{topic-slug}.md  — consolidated research brief

  The brief includes:
    - Executive summary
    - Codebase findings (existing patterns, constraints)
    - Best practices and recommended approaches
    - Actionable recommendations
    - References and sources

  Uses web search when available for current information.

  Example:
    /ck:research WebSocket connection management patterns
`.trim(),

	design: `
/ck:design <subcommand>
  Manage DESIGN.md — cross-cutting constraints enforced across all builds.

  Subcommands:
    create   Guided Q&A to create a new DESIGN.md (9-section format)
    audit    Validate existing DESIGN.md for completeness and consistency
    import   Convert an existing design document to DESIGN.md format
    show     Display the current DESIGN.md line count and status

  9-Section format:
    1. Architecture pattern
    2. Tech stack
    3. Code style
    4. Security requirements
    5. Error handling
    6. Testing approach
    7. Performance constraints
    8. Data model principles
    9. Forbidden patterns

  DESIGN.md is injected into every build subagent as a global constraint.

  Example:
    /ck:design create
    /ck:design audit
    /ck:design import ./existing-design.md
`.trim(),

	progress: `
/ck:progress
  Show current build site progress.

  Displays:
    - Build site name and total task count
    - Done / Active / Pending / Blocked task counts
    - Overall completion percentage
    - Per-tier breakdown with status icons

  Status icons:
    ✓ done  ● in-progress  ○ pending  ✗ blocked

  Reads the most recent build site from context/sites/.
  Shows a message if no build has been started yet.
`.trim(),

	config: `
/ck:config [key] [value]
  View or change CaveKit configuration.

  Usage:
    /ck:config                   Show all settings with source tags
    /ck:config <key>             Show current value of one setting
    /ck:config <key> <value>     Set a configuration value (project-local)

  Source tags:
    [default]  built-in defaults
    [global]   ~/.cave/cavekit.json
    [project]  .cavekit/config.json

  Configurable keys:
    preset              Model preset (expensive | quality | balanced | fast)
    tierGateMode        Gate strictness (severity | strict | permissive | off)
    tierGateModel       Model for tier gate review
    commandGate         Command allowlist mode (allowlist | blocklist | codex | off)
    cavemanLevel        Caveman compression level (0-3)
    maxRetries          Max task retry attempts (integer >= 0)
    maxIterations       Max iterations per task (integer >= 0)
    taskTimeout         Task timeout in ms (integer >= 0)
    maxParallel         Max concurrent tasks (integer >= 0)
    worktreeIsolation   Git worktree isolation (true | false)
    codexPath           Path to command allowlist/blocklist file
    speculativeReview   Speculative review mode (true | false)
    cavemanForSubagents Apply caveman to subagents (true | false)
    scopedContext       Scoped kit context per task (true | false)

  Example:
    /ck:config preset quality
    /ck:config maxParallel 4
`.trim(),

	help: `
/ck:help [command]
  Show CaveKit command reference or per-command detail.

  Arguments:
    [command]   Optional command name for detailed usage

  Examples:
    /ck:help           Show all commands
    /ck:help draft     Show detailed help for /ck:draft
    /ck:help build     Show detailed help for /ck:build
`.trim(),
};

const KNOWN_COMMANDS = Object.keys(COMMAND_HELP);

export function registerHelpCommand(pi: ExtensionAPI, _config: CaveKitConfig): void {
	pi.registerCommand("ck:help", {
		description: "Show CaveKit command reference",
		getArgumentCompletions: (prefix) => {
			const matches = KNOWN_COMMANDS.filter((c) => c.startsWith(prefix.trim()));
			return matches.length > 0 ? matches.map((c) => ({ value: c, label: c })) : null;
		},
		handler: async (args, ctx) => {
			const command = args.trim().replace(/^ck:/, "");

			if (command && COMMAND_HELP[command]) {
				// AC-2: Per-command detailed help
				ctx.ui.notify(COMMAND_HELP[command], "info");
				return;
			}

			if (command && !COMMAND_HELP[command]) {
				ctx.ui.notify(`Unknown command: "${command}". Known commands: ${KNOWN_COMMANDS.join(", ")}`, "warning");
				return;
			}

			// AC-1: Overview of all commands
			ctx.ui.notify(HELP_TEXT, "info");
		},
	});
}
