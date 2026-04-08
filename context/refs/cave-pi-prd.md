# Cave Pi — Product Requirements Document

## For Agent Implementation: Zero to Shipped Product

**Version:** 1.0
**Date:** April 8, 2026
**Author:** Julius Brussee
**Status:** Ready for implementation

---

## Sources of Truth

Before writing any code, read these repositories and documents. They are the authoritative references for every implementation decision.

### Primary Repositories

| Repository | What it is | What to read |
|---|---|---|
| `https://github.com/badlogic/pi-mono` | The upstream codebase you are forking. MIT license. | README.md, CONTRIBUTING.md, AGENTS.md, packages/coding-agent/README.md, all docs in packages/coding-agent/docs/ (especially extensions.md, skills.md, sdk.md, compaction.md, rpc.md, models.md, custom-provider.md), packages/ai/README.md, packages/agent/README.md |
| `https://github.com/JuliusBrussee/caveman` | The caveman token compression skill. MIT license. | README.md, skills/caveman/SKILL.md (the actual caveman prompt rules), caveman-compress/README.md, .claude-plugin/ |
| `https://github.com/JuliusBrussee/cavekit` | The specification-driven development plugin. MIT license. | README.md, install.sh (shows full file structure and all skills), every file in skills/ directory, the config system |
| `https://github.com/rtk-ai/rtk` | RTK tool result compression. Apache-2.0 license. | README.md, docs/contributing/ARCHITECTURE.md, src/ directory for filter implementations, hooks/ directory for agent integration patterns |

### Key Documentation Pages

| URL | Why it matters |
|---|---|
| `https://shittycodingagent.ai/` | Pi's official docs — features, philosophy, installation |
| `https://deepwiki.com/badlogic/pi-mono` | Auto-generated deep wiki with architecture diagrams |
| `https://mariozechner.at/posts/2025-11-30-pi-coding-agent/` | Mario Zechner's design rationale blog post — explains every architectural decision |
| `https://nader.substack.com/p/how-to-build-a-custom-agent-framework` | Tutorial on building with Pi's SDK — shows how OpenClaw integrates |
| `https://docs.morphllm.com/sdk/components/compact` | Morph Compact API docs — reference for context compression patterns |
| `https://www.morphllm.com/flashcompact` | Comparison of all context compaction methods — useful architectural context |
| `https://tamp.dev/` | Tamp proxy — reference for tool-result-level compression strategies |

### Key Source Files in Pi (read before modifying)

```
packages/coding-agent/src/core/system-prompt.ts     — System prompt construction
packages/coding-agent/src/core/compaction/           — All compaction logic
packages/coding-agent/src/core/extensions/types.ts   — Extension API type definitions
packages/coding-agent/src/core/extensions/runner.ts  — How extensions are loaded/executed
packages/coding-agent/src/core/agent-session.ts      — The AgentSession class (SDK entry point)
packages/coding-agent/src/core/session-manager.ts    — Session persistence (JSONL DAG)
packages/coding-agent/src/core/resource-loader.ts    — How skills/prompts/themes are discovered
packages/coding-agent/src/modes/interactive/          — TUI mode implementation
packages/coding-agent/src/modes/print-mode.ts        — Print mode (for subagent dispatch)
packages/coding-agent/src/modes/rpc/                 — RPC mode
packages/agent/                                       — Agent loop, tool execution, events
packages/ai/                                          — LLM streaming, providers, models
packages/tui/                                         — Terminal UI rendering engine
```

---

## What We Are Building

Cave Pi is two things shipped together:

1. **A thin fork of Pi** that modifies 3-4 source files to natively integrate caveman token compression and RTK tool result compression into the agent's core pipeline.

2. **A CaveKit extension** (`@cavekit/pi-sdd`) that implements the full specification-driven development workflow as a Pi extension — installable on Cave Pi or vanilla Pi.

The thin fork makes every session cheaper. The extension makes complex builds structured and reliable. Together they form the most token-efficient, spec-driven coding agent available.

### Architecture Diagram

```
┌──────────────────────────────────────────────────────┐
│                    Cave Pi (thin fork)                │
│                                                      │
│  MODIFIED (3-4 files):                               │
│  ┌─────────────────────────────────────────────────┐ │
│  │ system-prompt.ts  → caveman rules baked in      │ │
│  │ compaction.ts     → caveman-compressed summaries│ │
│  │ bash tool executor → RTK result compression     │ │
│  │ package.json      → rebrand + defaults          │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  UNTOUCHED: everything else from upstream Pi         │
│  (agent loop, TUI, session tree, providers, etc.)    │
├──────────────────────────────────────────────────────┤
│           CaveKit Extension (installable)            │
│                                                      │
│  .pi/extensions/cavekit/                             │
│  ├── index.ts          — Extension entry point       │
│  ├── commands/          — /ck:draft, /ck:architect,  │
│  │                        /ck:build, /ck:inspect,    │
│  │                        /ck:research, /ck:config   │
│  ├── wave-executor.ts  — Parallel wave dispatch      │
│  ├── tier-gate.ts      — Adversarial review logic    │
│  ├── widgets/          — Build dashboard, kit viewer │
│  ├── config.ts         — .cavekit/config handling    │
│  └── skills/           — Bundled CaveKit skills      │
│                                                      │
│  Also installable on vanilla Pi:                     │
│  pi install npm:@cavekit/pi-sdd                      │
└──────────────────────────────────────────────────────┘
```

---

## Part 1: The Thin Fork

### 1.1 Fork Setup

```bash
git clone https://github.com/badlogic/pi-mono.git cave-pi
cd cave-pi
npm install
npm run build
```

Rename the CLI binary from `pi` to `cave` in `packages/coding-agent/package.json`. Update the `bin` field. Update all `package.json` names to use `@cavepi/` scope (or `@juliusbrussee/cave-pi-*`). Keep the MIT license.

Set up a remote for upstream tracking:
```bash
git remote add upstream https://github.com/badlogic/pi-mono.git
git remote set-url upstream --push no_push
```

Monthly rebase process:
```bash
git fetch upstream
git rebase upstream/main
# Resolve conflicts in the 3-4 modified files
npm run build && npm run check && ./test.sh
```

### 1.2 Modification: System Prompt (system-prompt.ts)

**File:** `packages/coding-agent/src/core/system-prompt.ts`

**What to do:** Find where the default system prompt is constructed (the function `buildSystemPrompt` or equivalent). After the tool descriptions section, inject the caveman communication rules. These rules should be active by default but togglable via a setting.

**The caveman rules to inject** (source of truth: `https://github.com/JuliusBrussee/caveman/blob/main/skills/caveman/SKILL.md`):

```
## Communication Style

Respond terse like smart caveman. All technical substance stay. Only fluff die.
Default intensity: full. Switch via /cave lite|full|ultra.

Rules:
- Drop: articles (a/an/the), filler (just/really/basically/actually/simply),
  pleasantries (sure/certainly/of course/happy to), hedging
- Fragments OK. Short synonyms (big not extensive, fix not "implement a solution for")
- Technical terms exact. Code blocks unchanged. Errors quoted exact
- Pattern: [thing] [action] [reason]. [next step]
- Code/commits/PRs: write normal English
- Security warnings and destructive operations: auto-clarity (full English)
- "stop caveman" or "normal mode": revert to standard output
```

**Also register a `/cave` command** in the main CLI setup that toggles intensity levels. This can be done either in `system-prompt.ts` (by modifying the prompt dynamically) or by registering a built-in command alongside `/settings`, `/compact`, etc. Check how `/settings` and `/compact` are registered in the codebase and follow the same pattern.

**Setting to add** in `packages/coding-agent/src/core/settings-manager.ts`:
```typescript
caveMode?: {
  enabled?: boolean;         // default: true
  intensity?: "lite" | "full" | "ultra";  // default: "full"
  toolCompression?: boolean; // default: true (RTK integration)
}
```

### 1.3 Modification: Compaction (compaction.ts)

**File:** `packages/coding-agent/src/core/compaction/compaction.ts`

**What to do:** Find the compaction system prompt (the string that instructs the LLM to generate a summary). It currently says something like "You are performing a CONTEXT CHECKPOINT COMPACTION. Create a handoff summary for another LLM..."

Modify this prompt to instruct caveman-style summaries when cave mode is enabled:

```
CONTEXT CHECKPOINT COMPACTION. Create handoff for next LLM.
Write dense, no filler, all substance. Drop articles, pleasantries, hedging.

Include:
- Progress + key decisions (terse fragments)
- Constraints/user preferences (list form)  
- Absolute file paths read/modified
- Next steps (concrete, numbered)
- Critical data/refs needed to continue

Technical terms exact. Max density.
```

**Important:** Check `settings.caveMode.enabled` before applying the modified prompt. If cave mode is off, use the original upstream prompt unchanged. This ensures the fork stays functional for users who disable caveman.

**Also check** `packages/coding-agent/src/core/compaction/branch-summarization.ts` — the same modification should apply to branch summaries, which use a similar prompt.

### 1.4 Modification: Tool Result Compression

**File:** Find where bash tool results are processed before being added to the conversation history. This is likely in the tool executor within `packages/coding-agent/src/core/` or in the agent-core package's tool execution logic.

**What to do:** Add a post-processing step that pipes bash command output through RTK when:
1. Cave mode's `toolCompression` setting is enabled
2. RTK is installed on the system (check with `which rtk`)
3. The command matches RTK's supported command patterns

**Implementation approach:**

```typescript
import { execSync } from "child_process";

function compressToolResult(command: string, output: string, settings: Settings): string {
  if (!settings.caveMode?.toolCompression) return output;
  
  // Check if RTK is available (cache this check)
  if (!isRtkAvailable()) return output;
  
  // Use RTK's rewrite mechanism to determine if this command is compressible
  try {
    const rewritten = execSync(`rtk rewrite ${JSON.stringify(command)}`, {
      timeout: 1000,
      encoding: "utf-8"
    }).trim();
    
    if (rewritten && rewritten !== command) {
      // Execute the RTK-wrapped version and return compressed output
      // Note: RTK handles the compression internally
      return execSync(rewritten, { timeout: 30000, encoding: "utf-8" });
    }
  } catch {
    // RTK not available or command not supported — pass through
  }
  
  return output;
}
```

**Alternative (simpler) approach:** Instead of re-executing through RTK, apply RTK-inspired compression heuristics directly in TypeScript:
- Strip ANSI color codes
- Collapse consecutive blank lines to single blank line
- For `git push`/`git pull`/`git add`/`git commit`: extract only the summary line
- For test runners: extract only failures and summary line
- Truncate outputs over N characters with head+tail preservation (Pi already does this at 30k chars — consider lowering to 10k in cave mode)

The simpler approach avoids the RTK binary dependency but captures ~60% of the savings. The full RTK approach captures ~80-90%. Recommend starting with the simpler approach and adding RTK as an optional enhancement.

### 1.5 Modification: Package Identity

**Files to update:**
- Root `package.json` — name, description, repository URL
- `packages/coding-agent/package.json` — name, bin field (`cave` instead of `pi`), description
- All other `packages/*/package.json` — scope rename
- `README.md` — New branding, installation instructions, link to upstream Pi
- Config directory: Change default from `~/.pi/agent/` to `~/.cave-pi/agent/` (update `PI_CODING_AGENT_DIR` default or add `CAVE_PI_DIR`)

**Branding elements:**
- CLI binary: `cave`
- Config dir: `~/.cave-pi/`
- npm scope: `@cavepi/` or `@juliusbrussee/cave-pi-*`
- Startup banner: Include caveman branding and token savings indicator

---

## Part 2: The CaveKit Extension

### 2.1 Extension Structure

Create this directory structure. It ships as a Pi package installable via `pi install` or bundled with the Cave Pi fork.

```
extensions/cavekit/
├── index.ts                    — Entry point (exports default function)
├── commands/
│   ├── draft.ts                — /ck:draft command
│   ├── architect.ts            — /ck:architect command  
│   ├── build.ts                — /ck:build command
│   ├── inspect.ts              — /ck:inspect command
│   ├── research.ts             — /ck:research command
│   ├── design.ts               — /ck:design command
│   ├── config.ts               — /ck:config command
│   ├── progress.ts             — /ck:progress command
│   └── help.ts                 — /ck:help command
├── core/
│   ├── wave-executor.ts        — Parallel wave dispatch + monitoring
│   ├── tier-gate.ts            — Adversarial review logic
│   ├── convergence.ts          — Iteration tracking, plateau detection
│   ├── git-worktree.ts         — Worktree create/cleanup/merge
│   ├── kit-parser.ts           — Parse kit markdown into structured data
│   ├── build-site-parser.ts    — Parse build-site markdown
│   └── context-manager.ts      — Scoped context injection for subagents
├── widgets/
│   ├── build-dashboard.ts      — Persistent wave progress widget
│   ├── kit-reviewer.ts         — Kit approval overlay
│   ├── tier-gate-overlay.ts    — Review findings overlay
│   └── dep-graph.ts            — Dependency graph visualization
├── config.ts                   — Config loading + defaults
├── types.ts                    — TypeScript type definitions
└── skills/                     — Bundled CaveKit skills (copied from cavekit repo)
    ├── core-methodology/SKILL.md
    ├── validation-first/SKILL.md
    ├── writing/SKILL.md
    └── ... (all 15 skills from cavekit)
```

### 2.2 Extension Entry Point (index.ts)

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
// Adjust import path if using the cave-pi fork's scope

export default function cavekit(pi: ExtensionAPI) {
  // Load config from .cavekit/config or defaults
  const config = loadConfig(pi);
  
  // Register all /ck:* commands
  pi.registerCommand("ck:draft", {
    description: "Draft domain kits from natural language description",
    execute: async (args, ctx) => { /* see commands/draft.ts */ },
    getArgumentCompletions: () => [] // No completions needed
  });
  
  pi.registerCommand("ck:architect", {
    description: "Generate tiered build site from approved kits",
    execute: async (args, ctx) => { /* see commands/architect.ts */ }
  });
  
  pi.registerCommand("ck:build", {
    description: "Execute wave-based parallel build",
    execute: async (args, ctx) => { /* see commands/build.ts */ }
  });
  
  pi.registerCommand("ck:inspect", {
    description: "Gap analysis: what was built vs. what was specified",
    execute: async (args, ctx) => { /* see commands/inspect.ts */ }
  });
  
  pi.registerCommand("ck:research", {
    description: "Dispatch parallel research subagents",
    execute: async (args, ctx) => { /* see commands/research.ts */ }
  });
  
  pi.registerCommand("ck:design", {
    description: "Create or audit a DESIGN.md",
    execute: async (args, ctx) => { /* see commands/design.ts */ }
  });
  
  pi.registerCommand("ck:config", {
    description: "View/modify CaveKit configuration",
    execute: async (args, ctx) => { /* see commands/config.ts */ }
  });
  
  pi.registerCommand("ck:progress", {
    description: "Show current build progress",
    execute: async (args, ctx) => { /* see commands/progress.ts */ }
  });
  
  // Register keyboard shortcuts
  pi.registerShortcut("ctrl+shift+b", {
    description: "Toggle build dashboard",
    execute: async (ctx) => { /* toggle widget visibility */ }
  });
  
  // Hook: Inject design constraints into subagent prompts
  pi.on("before_agent_start", async (event, ctx) => {
    // If a DESIGN.md exists, inject its constraints
    // If building, inject relevant kit sections
  });
  
  // Hook: Protect against compaction losing SDD state
  pi.on("session_before_compact", async (event, ctx) => {
    // Ensure kit references, build state, and loop-log survive compaction
    // Return custom compaction instructions focusing on SDD artifacts
  });
  
  // Hook: Track resources for skill/prompt discovery
  pi.on("resources_discover", async (event, ctx) => {
    return {
      skillPaths: [path.join(__dirname, "skills")],
      promptPaths: [],
      themePaths: []
    };
  });
}
```

### 2.3 Command Implementation: /ck:draft

**Source of truth for draft behavior:** Read CaveKit's `skills/core-methodology/SKILL.md` and `skills/writing/SKILL.md` from the CaveKit repository. These define how natural language gets decomposed into kits.

**Implementation:**

```typescript
async function executeDraft(args: string, ctx: ExtensionContext) {
  if (!args.trim()) {
    ctx.ui.notify("Usage: /ck:draft <natural language description>", "error");
    return;
  }
  
  // 1. Show the user what's about to happen
  ctx.ui.notify("Drafting domain kits...", "info");
  
  // 2. Send the prompt to the current model
  // The prompt should incorporate CaveKit's Writing skill and
  // Validation-First Design skill instructions
  const draftPrompt = buildDraftPrompt(args);
  await ctx.sendMessage(draftPrompt);
  
  // 3. After the model responds, parse the output into kit files
  // Kits should be written to context/kits/kit-{domain}.md
  // Each kit has: domain name, R-numbered requirements, acceptance criteria
  
  // 4. Present kits for review using the kit reviewer widget
  const kits = await parseKitsFromDirectory("context/kits/");
  await showKitReviewer(ctx, kits);
}

function buildDraftPrompt(description: string): string {
  return `You are drafting domain kits for a specification-driven build.

INPUT: ${description}

Decompose this into domain kits. Each kit is a separate markdown file.

For each kit, produce:
- Domain name (lowercase-hyphenated)
- R-numbered requirements (R-001, R-002, etc.)
- Each requirement has 1-3 testable acceptance criteria (AC-1, AC-2, etc.)
- Acceptance criteria must be verifiable by running code or inspecting output

Write kits to context/kits/kit-{domain}.md

Format per kit:
# Kit: {Domain Name}

## R-001: {Requirement title}
{Description}

### Acceptance Criteria
- AC-1: {Testable criterion}
- AC-2: {Testable criterion}

## R-002: ...

After writing all kits, output a summary table:
| Kit | Requirements | Acceptance Criteria |
|-----|-------------|-------------------|
| ... | ...         | ...               |`;
}
```

### 2.4 Command Implementation: /ck:architect

**Source of truth:** CaveKit's core methodology skill defines how kits become tiered build sites.

```typescript
async function executeArchitect(args: string, ctx: ExtensionContext) {
  // 1. Read all approved kits from context/kits/
  const kits = await parseKitsFromDirectory("context/kits/");
  
  if (kits.length === 0) {
    ctx.ui.notify("No kits found. Run /ck:draft first.", "error");
    return;
  }
  
  // 2. Send architect prompt
  const architectPrompt = buildArchitectPrompt(kits);
  await ctx.sendMessage(architectPrompt);
  
  // 3. Parse output into build site structure
  // Build site goes to context/sites/build-site.md
  // Format: T-numbered tasks, tier assignments, dependency edges,
  //         coverage matrix (every AC maps to at least one task)
  
  // 4. Show dependency graph widget
  const buildSite = await parseBuildSite("context/sites/build-site.md");
  await showDependencyGraph(ctx, buildSite);
}
```

### 2.5 Command Implementation: /ck:build

This is the most complex command. It orchestrates wave-based parallel execution.

```typescript
async function executeBuild(args: string, ctx: ExtensionContext) {
  const buildSite = await parseBuildSite("context/sites/build-site.md");
  const config = loadConfig();
  
  // 1. Show build dashboard widget
  ctx.ui.setWidget("ck-build", (tui) => {
    return buildDashboardFactory(tui, buildSite);
  });
  
  // 2. Execute waves
  for (const wave of computeWaves(buildSite)) {
    ctx.ui.notify(`Starting Wave ${wave.number}: ${wave.tasks.length} tasks`, "info");
    
    // 3. Dispatch all tasks in this wave in parallel
    const results = await Promise.allSettled(
      wave.tasks.map(task => executeTask(task, buildSite, config, ctx))
    );
    
    // 4. Process results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const task = wave.tasks[i];
      
      if (result.status === "fulfilled") {
        updateTaskStatus(buildSite, task.id, "complete");
      } else {
        updateTaskStatus(buildSite, task.id, "failed");
        // Retry logic with circuit breaker
        if (task.retryCount >= config.maxRetries) {
          updateTaskStatus(buildSite, task.id, "blocked");
          ctx.ui.notify(`Task ${task.id} BLOCKED after ${config.maxRetries} retries`, "error");
        }
      }
    }
    
    // 5. Tier gate check (if this wave completes a tier)
    if (isEndOfTier(wave, buildSite)) {
      const tierNum = getTierNumber(wave, buildSite);
      await executeTierGate(tierNum, buildSite, config, ctx);
    }
    
    // 6. Update dashboard
    updateDashboard(buildSite);
  }
  
  ctx.ui.notify("Build complete!", "success");
}

async function executeTask(
  task: BuildTask,
  buildSite: BuildSite,
  config: CaveKitConfig,
  ctx: ExtensionContext
): Promise<void> {
  // Build scoped context: only the kit sections relevant to this task
  const scopedContext = buildScopedContext(task, buildSite);
  
  // Dispatch as a print-mode subagent
  const { execSync } = require("child_process");
  const prompt = buildTaskPrompt(task, scopedContext);
  
  // Use pi --print (or cave --print) for subagent
  const result = execSync(
    `cave -p ${JSON.stringify(prompt)}`,
    {
      cwd: process.cwd(),
      timeout: config.taskTimeout || 300000, // 5 min default
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024
    }
  );
  
  // Validate acceptance criteria
  for (const ac of task.acceptanceCriteria) {
    const passed = await validateAcceptanceCriterion(ac);
    if (!passed) {
      throw new Error(`AC failed: ${ac.id} — ${ac.description}`);
    }
  }
}
```

### 2.6 Tier Gate: Adversarial Review

```typescript
async function executeTierGate(
  tierNum: number,
  buildSite: BuildSite,
  config: CaveKitConfig,
  ctx: ExtensionContext
): Promise<void> {
  if (config.tierGateMode === "off") return;
  
  // Get the diff for this tier's work
  const diff = execSync("git diff HEAD~1", { encoding: "utf-8" });
  const tierTasks = getTasksInTier(buildSite, tierNum);
  const kitRefs = getKitRefsForTasks(tierTasks);
  
  // Option 1: Codex review (if available)
  // Option 2: Cross-model review using Pi's multi-provider API
  // Option 3: Self-review with the current model (fallback)
  
  const findings = await performReview(diff, kitRefs, config);
  
  if (findings.some(f => f.severity === "P0" || f.severity === "P1")) {
    // Show tier gate overlay
    const action = await showTierGateOverlay(ctx, tierNum, findings);
    
    switch (action) {
      case "approve":
        break; // Continue to next tier
      case "fix-all":
        // Generate fix tasks and inject into current tier
        for (const finding of findings.filter(f => f.severity <= "P1")) {
          addFixTask(buildSite, tierNum, finding);
        }
        break;
      case "abort":
        throw new Error("Build aborted at tier gate");
    }
  }
}
```

### 2.7 Build Dashboard Widget

**Source of truth for Pi widget API:** Read `packages/coding-agent/docs/extensions.md`, section on `ctx.ui.setWidget()`. Widgets use a factory function that receives the TUI instance and returns an array of styled lines.

```typescript
function buildDashboardFactory(tui: any, buildSite: BuildSite) {
  // Return array of styled line strings
  // This function is called on every render cycle
  
  const lines: string[] = [];
  lines.push(`╔══ CaveKit Build ${"═".repeat(40)}╗`);
  lines.push(`║ ${buildSite.name} | ${buildSite.totalTasks} tasks, ${buildSite.tiers} tiers`);
  lines.push(`║`);
  
  const currentWave = getCurrentWave(buildSite);
  lines.push(`║ ═══ Wave ${currentWave.number} / ${buildSite.waves.length} ═══`);
  
  for (const task of currentWave.tasks) {
    const icon = task.status === "complete" ? "●" 
               : task.status === "in-progress" ? "◐"
               : task.status === "blocked" ? "✗"
               : "○";
    const bar = renderProgressBar(task.progress, 8);
    lines.push(`║ ${icon} ${task.id} ${task.name.padEnd(30)} ${bar}`);
  }
  
  lines.push(`║`);
  const completed = buildSite.tasks.filter(t => t.status === "complete").length;
  lines.push(`║ Done: ${completed}/${buildSite.totalTasks} | Blocked: ${buildSite.blockedCount}`);
  lines.push(`╚${"═".repeat(50)}╝`);
  
  return lines;
}
```

### 2.8 Kit Reviewer Overlay

Uses `ctx.ui.custom()` to present an interactive overlay for reviewing drafted kits.

```typescript
async function showKitReviewer(ctx: ExtensionContext, kits: Kit[]): Promise<void> {
  const approved = await ctx.ui.custom(async (tui) => {
    // Build a TreeList-style component showing kits > requirements > ACs
    // User navigates with arrow keys
    // Enter = approve, e = edit, d = reject
    
    // This is a blocking overlay — returns when user confirms
    // Follow the pattern in Pi's extension examples
  });
}
```

### 2.9 Config System

**File:** `extensions/cavekit/config.ts`

Config lives in `.cavekit/config` (project-local) or `~/.cave-pi/cavekit/config` (global). Project overrides global.

```typescript
interface CaveKitConfig {
  // Model presets
  preset: "expensive" | "quality" | "balanced" | "fast";
  
  // Tier gate
  tierGateMode: "severity" | "strict" | "permissive" | "off";
  tierGateModel: string; // e.g., "codex", "gpt-4o", or "self"
  
  // Build limits
  maxRetries: number;        // default: 3
  taskTimeout: number;       // default: 300000 (5 min)
  maxIterations: number;     // default: 20 per task
  
  // Token optimization
  cavemanSubagents: boolean; // default: true — apply caveman to subagent prompts
  scopedContext: boolean;    // default: true — only inject relevant kit sections
  
  // Command safety
  commandGate: "allowlist" | "blocklist" | "codex" | "off";
}

const DEFAULTS: CaveKitConfig = {
  preset: "quality",
  tierGateMode: "severity",
  tierGateModel: "self",
  maxRetries: 3,
  taskTimeout: 300000,
  maxIterations: 20,
  cavemanSubagents: true,
  scopedContext: true,
  commandGate: "off"
};
```

---

## Part 3: Implementation Phases

### Phase 1: Thin Fork (Week 1-2)

**Deliverable:** A working `cave` CLI binary that is functionally identical to `pi` but with caveman output compression baked in.

1. Fork the repo, set up upstream remote
2. Rename CLI binary and package scope
3. Modify `system-prompt.ts` — inject caveman rules
4. Add `caveMode` to settings manager with defaults
5. Register `/cave` command for intensity toggling
6. Modify `compaction.ts` — caveman-compressed summaries when enabled
7. Add basic tool result compression (the simpler heuristic approach)
8. Update startup banner with caveman branding
9. Build, test, verify all existing tests pass
10. Publish to npm as `@cavepi/cave-pi-coding-agent` (or similar)

**Test:** Run `cave "list all .ts files"` and verify the response uses caveman style. Run a long session, trigger compaction, verify the summary is terse. Compare token usage in footer against vanilla Pi for identical tasks.

### Phase 2: CaveKit Extension — Draft & Architect (Week 3-4)

**Deliverable:** Working `/ck:draft` and `/ck:architect` commands with kit review overlay.

1. Create extension directory structure
2. Implement config loading
3. Port CaveKit's skill files into the extension's skills/ directory
4. Implement `/ck:draft` — prompt construction, kit file writing, basic output parsing
5. Implement kit reviewer overlay using `ctx.ui.custom()`
6. Implement `/ck:architect` — read approved kits, generate build site, write to file
7. Implement basic dependency graph visualization
8. Register `resources_discover` hook for skill paths
9. Test: Draft kits for a sample project, review and approve, generate build site

### Phase 3: CaveKit Extension — Build & Wave Execution (Week 5-7)

**Deliverable:** Working `/ck:build` with parallel wave execution and build dashboard.

1. Implement wave computation from build site (topological sort by tier)
2. Implement task dispatch via print mode (`cave -p`)
3. Implement scoped context builder (extract only relevant kit sections per task)
4. Implement build dashboard widget
5. Implement convergence monitoring (iteration count, plateau detection, circuit breaker)
6. Implement acceptance criteria validation (shell out to test runner)
7. Implement loop-log writing to `context/impl/loop-log.md`
8. Add `/ck:progress` command
9. Test: Build a real project (e.g., a simple REST API) end-to-end

### Phase 4: Adversarial Review & Inspect (Week 8-9)

**Deliverable:** Working tier gates with cross-model review and `/ck:inspect` gap analysis.

1. Implement tier gate review — detect tier boundaries, collect diffs
2. Implement review dispatch (self-review as default, Codex/alternative model as option)
3. Implement tier gate overlay with approve/fix/abort actions
4. Implement fix task generation and injection into current tier
5. Implement `/ck:inspect` — gap analysis comparing built code against kit requirements
6. Implement finding classification (P0-P3 severity)
7. Test: Run a build, intentionally introduce a bug, verify tier gate catches it

### Phase 5: Research, Design & Polish (Week 10-11)

**Deliverable:** Full DABI lifecycle, keyboard shortcuts, session tree integration.

1. Implement `/ck:research` — dispatch parallel explore subagents
2. Implement `/ck:design create` — guided Q&A for DESIGN.md generation
3. Register keyboard shortcuts (Ctrl+Shift+B for dashboard, etc.)
4. Implement session tree labels for each DABI phase transition
5. Implement `session_before_compact` hook for SDD-aware compaction
6. Add custom session entry types for build events
7. Polish all TUI surfaces

### Phase 6: Distribution & Launch (Week 12)

**Deliverable:** Published npm packages, documentation, launch content.

1. Package CaveKit extension for standalone install (`pi install npm:@cavekit/pi-sdd`)
2. Write README with installation, usage, and configuration docs
3. Write AGENTS.md for Cave Pi projects
4. Create example configs for common project types
5. Run benchmarks: token usage comparison (Cave Pi vs Pi vs Claude Code)
6. Publish Cave Pi to npm
7. Publish CaveKit extension to npm
8. Create launch content: Threads post, HN Show HN, GitHub release

---

## Part 4: Key Design Decisions

### Decision 1: Print mode for subagents (Phase 1-3), SDK for Phase 4+

Start with `cave -p "<prompt>"` for task dispatch. It's simpler, battle-tested (this is how CaveKit works today), and avoids in-process memory management. Migrate to `createAgentSession()` SDK embedding when you need event-level progress streaming for the build dashboard.

### Decision 2: No MCP — stay aligned with Pi's philosophy

Pi deliberately excludes MCP. CaveKit's tool integrations (Codex review, research dispatch) should use direct CLI invocation or API calls, not MCP servers. This keeps the token budget lean and the architecture transparent.

### Decision 3: Git worktree isolation is Phase 4+ only

For Phase 1-3, subagents work sequentially within each wave (simpler) or in the same worktree with careful file-level task assignment. Add git worktree isolation when you implement true parallel SDK-embedded subagents. The wave structure already minimizes conflict probability.

### Decision 4: Codex review is optional, self-review is default

Don't hard-depend on OpenAI's Codex. The default `tierGateModel: "self"` uses the current model to review its own output from a different angle (reviewer prompt). Codex/GPT-4o/Gemini can be configured as the review model for true cross-model adversarial review.

### Decision 5: CaveKit extension works on vanilla Pi too

The extension should gracefully degrade when running on vanilla Pi (without the thin fork). Everything works — just without native caveman compression in system prompts, compaction, and tool results. The extension can still apply caveman to subagent prompts via context injection.

---

## Part 5: File-by-File Checklist

### Files to CREATE in the fork:

- [ ] `extensions/cavekit/index.ts`
- [ ] `extensions/cavekit/commands/*.ts` (9 command files)
- [ ] `extensions/cavekit/core/*.ts` (7 core files)
- [ ] `extensions/cavekit/widgets/*.ts` (4 widget files)
- [ ] `extensions/cavekit/config.ts`
- [ ] `extensions/cavekit/types.ts`
- [ ] `extensions/cavekit/skills/` (copy from CaveKit repo)
- [ ] `extensions/cavekit/package.json` (for standalone npm distribution)

### Files to MODIFY in the fork (thin fork — keep changes minimal):

- [ ] `packages/coding-agent/src/core/system-prompt.ts` — Add caveman rules section
- [ ] `packages/coding-agent/src/core/compaction/compaction.ts` — Caveman compaction prompt
- [ ] `packages/coding-agent/src/core/compaction/branch-summarization.ts` — Same
- [ ] `packages/coding-agent/src/core/settings-manager.ts` — Add `caveMode` settings
- [ ] `packages/coding-agent/package.json` — Rename bin, scope, description
- [ ] Root `package.json` — Rename
- [ ] `README.md` — New content

### Files to READ but NOT modify:

- [ ] `packages/coding-agent/src/core/extensions/types.ts` — Your API surface
- [ ] `packages/coding-agent/src/core/extensions/runner.ts` — How your code gets loaded
- [ ] `packages/coding-agent/src/core/agent-session.ts` — SDK embedding reference
- [ ] `packages/coding-agent/src/modes/print-mode.ts` — How subagents work
- [ ] `packages/coding-agent/docs/extensions.md` — Full extension documentation
- [ ] `packages/coding-agent/docs/skills.md` — Skill format specification

---

## Part 6: Success Metrics

### Quantitative

- Token usage per session: 50-70% reduction vs vanilla Pi on identical tasks
- Compaction summary size: 40-60% smaller than upstream Pi
- Build success rate: >80% of tasks complete without human intervention
- Session length: 2-3x more tool calls before context limit vs vanilla Pi

### Qualitative

- A developer can go from "Build me a REST API with auth" to working code in a single session
- The build dashboard provides enough visibility that the developer feels in control
- Kit review is fast enough that it doesn't break flow
- Tier gate findings are actionable (not noise)

### Launch

- npm install works: `npm install -g @cavepi/cave-pi-coding-agent`
- Extension install works: `cave install npm:@cavekit/pi-sdd` (on Cave Pi) or `pi install npm:@cavekit/pi-sdd` (on vanilla Pi)
- README is clear enough that a developer can go from zero to first build in under 10 minutes
