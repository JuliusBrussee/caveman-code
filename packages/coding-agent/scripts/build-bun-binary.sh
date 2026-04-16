#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-$(node -p "require('./package.json').version")}"
OUTDIR="dist/bin"
TARGETS=("bun-darwin-arm64" "bun-darwin-x64" "bun-linux-arm64" "bun-linux-x64")

mkdir -p "$OUTDIR"

for target in "${TARGETS[@]}"; do
    triple="${target#bun-}"
    echo "Building cave-${triple} (${VERSION})..."
    bun build packages/coding-agent/src/cli.ts \
        --compile \
        "--target=${target}" \
        "--outfile=${OUTDIR}/cave-${triple}"

    # Smoke test (only on matching platform)
    if [[ "${triple}" == "$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/aarch64/arm64/')" ]]; then
        echo "Smoke testing cave-${triple}..."
        "${OUTDIR}/cave-${triple}" --version | grep -q "${VERSION}" \
            || { echo "FAIL: --version smoke test for ${triple}"; exit 1; }
    fi

    SIZE=$(stat -f%z "${OUTDIR}/cave-${triple}" 2>/dev/null || stat -c%s "${OUTDIR}/cave-${triple}" 2>/dev/null)
    MAX_SIZE=$((80 * 1024 * 1024))
    if (( SIZE > MAX_SIZE )); then
        echo "FAIL: cave-${triple} is ${SIZE} bytes (max ${MAX_SIZE})"
        exit 1
    fi
    echo "OK: cave-${triple} (${SIZE} bytes)"
done

echo "All binaries built successfully."
