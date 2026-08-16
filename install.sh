#!/usr/bin/env bash
set -euo pipefail

RINET_RELEASE_URL="https://github.com/AkulK08/rinetlab/releases/download/v1.1.0-build011/RINet_Build_011_Protein_Research_Studio_2026-08-16.zip"
RINET_RELEASE_SHA256="8ddaf150f5958494f8b7a083d5dd2d5b2da2ba363704e7936107ef0ba6dca150"
RINET_INSTALL_TMP="$(mktemp -d)"
trap 'rm -rf "$RINET_INSTALL_TMP"' EXIT

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This one-line installer currently supports macOS."
  echo "Download the cross-platform source release at https://github.com/AkulK08/rinetlab/releases/tag/v1.1.0-build011"
  exit 1
fi

echo "Downloading RINet Build 011…"
curl -fL "$RINET_RELEASE_URL" -o "$RINET_INSTALL_TMP/rinet.zip"
echo "$RINET_RELEASE_SHA256  $RINET_INSTALL_TMP/rinet.zip" | shasum -a 256 -c -
unzip -q "$RINET_INSTALL_TMP/rinet.zip" -d "$RINET_INSTALL_TMP/release"
chmod +x "$RINET_INSTALL_TMP/release/RINet_Build_011_Protein_Research_Studio/INSTALL_BUILD_011.sh"
bash "$RINET_INSTALL_TMP/release/RINet_Build_011_Protein_Research_Studio/INSTALL_BUILD_011.sh"

echo
echo "RINet is installed. Launch it with:"
echo "  ~/.local/bin/rinet gui"
