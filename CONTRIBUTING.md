# Contributing to Caveman Code

Contributing here means contributing to the Caveman Code fork maintained in [JuliusBrussee/caveman-cli](https://github.com/JuliusBrussee/caveman-cli).

Caveman Code is a fork of [pi-mono](https://github.com/badlogic/pi-mono) by Mario Zechner (badlogic). Upstream contributions should still be directed to the original project where appropriate.

## The One Rule

**You must understand your code.** If you can't explain what your changes do and how they interact with the rest of the system, your PR will be closed.

Using AI to write code is fine. You can gain understanding by interrogating an agent with access to the codebase until you grasp all edge cases and effects of your changes. What's not fine is submitting agent-generated slop without that understanding.

If you use an agent, run it from the `caveman-cli` root directory so it picks up `AGENTS.md` automatically. Your agent must follow the rules and guidelines in that file.

## Syncing with Upstream (pi-mono)

Fork sync contract is tracked in `.github/upstream-sync.json`.

Required local git configuration:

- Remote name: `upstream`
- Fetch URL: `https://github.com/badlogic/pi-mono.git`
- Push URL: `DISABLE`
- Fetch refspec: `+refs/heads/*:refs/remotes/upstream/*`
- Default upstream branch: `upstream/main`

Audit current clone before syncing:

```bash
git remote get-url upstream
git remote get-url --push upstream
git config --get-all remote.upstream.fetch
git fetch upstream
```

To pull in upstream changes:

```bash
# Fetch latest from upstream
git fetch upstream

# Merge or rebase onto upstream/main
git merge upstream/main
# or
git rebase upstream/main

# Resolve any conflicts, then push to origin
git push origin main
```

Keep Caveman Code-specific changes (banner, config dir, package scope) in their own commits so they can be rebased cleanly over upstream updates.

## First-Time Contributors

We use an approval gate for new contributors:

1. Open an issue describing what you want to change and why
2. Keep it concise (if it doesn't fit on one screen, it's too long)
3. Write in your own voice, at least for the intro
4. A maintainer will comment `lgtm` if approved
5. Once approved, you can submit PRs

This exists because AI makes it trivial to generate plausible-looking but low-quality contributions. The issue step lets us filter early.

## Before Submitting a PR

```bash
npm run check  # must pass with no errors
./test.sh      # must pass
```

Do not edit `CHANGELOG.md`. Changelog entries are added by maintainers.

If you're adding a new provider to `packages/ai`, see `AGENTS.md` for required tests.

## Philosophy

Cave's core is minimal. If your feature doesn't belong in the core, it should be an extension. PRs that bloat the core will likely be rejected.

## Good First Issues

Look for issues labeled [`good first issue`](https://github.com/JuliusBrussee/caveman-cli/labels/good%20first%20issue). These are scoped, well-described tasks suitable for new contributors.

Some areas where contributions are especially welcome:

- **Extensions** — build a new extension and submit it as a package
- **Provider support** — add or improve an LLM provider in `packages/ai`
- **Themes** — create and share custom terminal themes
- **Documentation** — improve docs, fix typos, add examples
- **Benchmarks** — add new compression fixtures or improve measurement

## Questions?

Open an issue or ask on [Discord](https://discord.com/invite/nKXTsAcmbT).
