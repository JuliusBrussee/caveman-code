---
created: "2026-04-16"
last_edited: "2026-04-16"
initiative: token-efficiency
status: draft
---

# Cavekit: Sandbox & MCP

## Scope

Two CLI parity features grouped for implementation cohesion: sandboxed bash execution (Seatbelt on macOS, Landlock on Linux, permissive+warn on Windows per Q4) and MCP plugin surface (client + server) replacing any proprietary plugin API. ACP support for Zed embeddability is included as a small additional surface. Skills/subagents/hooks remain the in-process extension trinity — no new plugin protocol is invented.

## Requirements

### R1: macOS Seatbelt sandbox
**Description:** On Darwin, `bash` tool invocations run inside a Seatbelt profile that denies writes outside the workdir, denies network unless explicitly allowed, and denies access to `~/.ssh`, `~/.aws`, and similar sensitive paths. The profile is configurable per session.
**Acceptance Criteria:**
- [ ] A `bash` command attempting to write outside the workdir fails with a sandbox-denied error.
- [ ] A `bash` command attempting a network call fails by default.
- [ ] A `bash` command attempting to read `~/.ssh/id_rsa` fails.
- [ ] The profile is reloadable from config without restarting the process.
**Dependencies:** none

### R2: Linux Landlock sandbox
**Description:** On Linux kernel 5.13+, `bash` invocations run inside a Landlock-restricted child with the same policy (workdir-write only, deny net by default). On older kernels, `cave` warns at startup and runs permissive.
**Acceptance Criteria:**
- [ ] On a supported kernel, writes outside the workdir from `bash` fail.
- [ ] On a kernel below 5.13, `cave` prints a startup warning and runs `bash` without Landlock.
- [ ] Kernel version detection is done once at startup.
**Dependencies:** none

### R3: Windows behavior
**Description:** On Windows, `cave` warns at startup that sandbox is unsupported. `bash` runs without isolation. No Job Objects or AppContainer in this kit.
**Acceptance Criteria:**
- [ ] On Windows startup, a warning is printed identifying sandbox as unsupported.
- [ ] `bash` tool calls execute without a sandbox layer.
- [ ] No Job Objects or AppContainer code path is invoked.
**Dependencies:** none

### R4: Sandbox escape config
**Description:** A `sandbox.allow:` config block in `~/.cave/config.yaml` lets the user grant additional read/write paths or enable network for a session. Per-tool-call escape requires explicit confirmation.
**Acceptance Criteria:**
- [ ] Adding a path to `sandbox.allow.writes` permits writes to that path from `bash`.
- [ ] Enabling `sandbox.allow.network: true` permits network calls from `bash`.
- [ ] A per-tool-call escape triggers an interactive confirmation prompt.
**Dependencies:** R1, R2

### R5: MCP client
**Description:** `cave` is an MCP client. It connects to MCP servers configured in `~/.cave/mcp.json`, registers their tools into the agent's tool surface, and forwards calls. Tool schemas from MCP servers must satisfy the prompt cache deterministic-serialization requirement.
**Acceptance Criteria:**
- [ ] A configured MCP server's tools appear in the agent tool surface after startup.
- [ ] A model-initiated call to an MCP tool is forwarded and the result returned.
- [ ] MCP tool schemas serialized into the tools layer are byte-stable across invocations.
- [ ] A missing MCP server fails cleanly with a structured error, not a crash.
**Dependencies:** cavekit-prompt-cache R2

### R6: MCP server
**Description:** `cave` exposes an MCP server mode (`cave mcp serve`) presenting its built-in tools over MCP for embedding in other clients.
**Acceptance Criteria:**
- [ ] `cave mcp serve` starts and accepts MCP connections.
- [ ] The built-in `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls` tools are all exposed.
- [ ] A connected MCP client can invoke each tool and receive a result.
**Dependencies:** none

### R7: ACP support
**Description:** `cave` implements the Agent Client Protocol (Zed) so it can be embedded as an external agent in Zed and other ACP-compatible editors. Minimal surface: handshake, message stream, tool call forwarding.
**Acceptance Criteria:**
- [ ] An ACP handshake from Zed completes successfully.
- [ ] Model messages stream over ACP to the embedding client.
- [ ] Tool calls are forwarded and results returned over ACP.
**Dependencies:** none

### R8: Skills / subagents / hooks consolidation
**Description:** The existing skills, extensions, and hooks systems are documented as the "trinity" in-process plugin surface. No new proprietary plugin API is invented. MCP is the cross-tool plugin surface; skills/hooks remain for in-process customization.
**Acceptance Criteria:**
- [ ] Documentation explicitly names skills, extensions, and hooks as the in-process extension surface.
- [ ] No new plugin API surface is introduced by this initiative.
- [ ] A skill can still be registered and loaded unchanged after this kit is implemented.
**Dependencies:** none

## Out of Scope

- Windows Job Objects.
- Windows AppContainer.
- SELinux profiles.
- eBPF-based sandboxing.
- Inventing a new plugin protocol beyond MCP + skills/hooks.

## Cross-References

- See also: cavekit-prompt-cache.md (R5 MCP tool schemas must satisfy R2).
- See also: cavekit-cost-trace.md (sandbox events logged via trace JSONL).

## Source

- `context/refs/research-brief-token-efficiency.md` — Sandbox section and plugin surface section; Q4 locked decision (Seatbelt + Landlock, Windows permissive+warn).

## Changelog

| Date | Change |
|------|--------|
| 2026-04-16 | Initial draft |
