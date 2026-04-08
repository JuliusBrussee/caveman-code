# Claude.md Context Summary

## Project Identity
**rtk (Rust Token Killer)** is a high-performance CLI proxy reducing LLM token consumption by 60-90% through intelligent filtering and compression of command outputs.

## Critical Installation Note
Two distinct "rtk" projects exist. Verify correct installation with:
```bash
rtk --version  # Should display "rtk 0.28.2" or newer
rtk gain       # Should show token savings statistics
```

## Development Workflow

**Quality Gate (mandatory before commits)**:
```bash
cargo fmt --all && cargo clippy --all-targets && cargo test --all
```

**Key Commands**:
- Build: `cargo build` or `rtk cargo build`
- Test: `cargo test` or `rtk cargo test`
- Format: `cargo fmt`
- Linting: `cargo clippy --all-targets`

## Architecture Essentials
- **Command routing**: Main entry via Clap enum to specialized filter modules
- **Token tracking**: SQLite-based metrics via `src/core/tracking.rs`
- **Proxy mode**: Execute commands without filtering (`rtk proxy <command>`)
- **Design constraints**: Single-threaded, <10ms startup, <5MB memory

## Coding Standards
- Use `anyhow::Result` with `.context()` for all error handling
- Prohibit `unwrap()` in production code
- Compile regex once using `lazy_static!`
- Implement fallback pattern: failed filters execute raw commands unchanged
- Propagate exit codes via `std::process::exit(code)`

## Documentation References
- **Architecture details**: `docs/contributing/ARCHITECTURE.md`
- **Technical flow**: `docs/contributing/TECHNICAL.md`
- **Contribution workflow**: `CONTRIBUTING.md`
- **Filter implementation**: `src/cmds/README.md`

## Process Requirements
- Always confirm working directory before starting
- Avoid excessive exploratory operations (≤3-4 verification commands)
- Execute numbered plans sequentially with commits after each logical step
- Never skip steps without explicit user approval
