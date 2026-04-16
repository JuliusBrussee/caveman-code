#!/usr/bin/env bash
set -euo pipefail

REPO="JuliusBrussee/caveman-cli"
INSTALL_DIR="${CAVE_INSTALL_DIR:-/usr/local/bin}"

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
    aarch64|arm64) ARCH="arm64" ;;
    x86_64|amd64)  ARCH="x64" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

TRIPLE="${OS}-${ARCH}"
VERSION="${CAVE_VERSION:-$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | cut -d'"' -f4)}"

echo "Installing cave ${VERSION} (${TRIPLE})..."
curl -fsSL "https://github.com/${REPO}/releases/download/${VERSION}/cave-${TRIPLE}" -o /tmp/cave
chmod +x /tmp/cave
mv /tmp/cave "${INSTALL_DIR}/cave"
echo "Installed cave to ${INSTALL_DIR}/cave"
cave --version
