# Contributing to Caveman Code

Thanks for wanting to contribute! This guide exists to save both of us time.

Caveman Code is a fork of [pi-mono](https://github.com/badlogic/pi-mono) by Mario Zechner (badlogic). Upstream contributions should be directed to the original project.

## The One Rule

**You must understand your code.** If you can't explain what your changes do and how they interact with the rest of the system, your PR will be closed.

Using AI to write code is fine. You can gain understanding by interrogating an agent with access to the codebase until you grasp all edge cases and effects of your changes. What's not fine is submitting agent-generated slop without that understanding.

If you use an agent, run it from the `caveman-cli` root directory so it picks up `AGENTS.md` automatically. Your agent must follow the rules and guidelines in that file.

## Syncing with Upstream (pi-mono)

The `upstream` remote tracks https://github.com/badlogic/pi-mono.git. Push to upstream is disabled to prevent accidental pushes.

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

pi's core is minimal. If your feature doesn't belong in the core, it should be an extension. PRs that bloat the core will likely be rejected.

## Questions?

Open an issue or ask on [Discord](https://discord.com/invite/nKXTsAcmbT).
