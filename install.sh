#!/usr/bin/env bash
set -euo pipefail

RINET_RELEASE_URL="https://github.com/AkulK08/rinetlab/releases/download/v1.3.0-build013/RINet_Build_013_Scientific_Transparency_Studio_2026-08-24.zip"
RINET_RELEASE_SHA256="e94c6b285c630268613b2bbd0be4cc5f71527fa9727795310819d960d8994792"
RINET_INSTALL_TMP="$(mktemp -d)"
trap 'rm -rf "$RINET_INSTALL_TMP"' EXIT

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This one-line installer currently supports macOS."
  echo "Download the cross-platform source release at https://github.com/AkulK08/rinetlab/releases/tag/v1.3.0-build013"
  exit 1
fi

echo "Downloading RINet Build 013…"
curl -fL "$RINET_RELEASE_URL" -o "$RINET_INSTALL_TMP/rinet.zip"
echo "$RINET_RELEASE_SHA256  $RINET_INSTALL_TMP/rinet.zip" | shasum -a 256 -c -
unzip -q "$RINET_INSTALL_TMP/rinet.zip" -d "$RINET_INSTALL_TMP/release"
chmod +x "$RINET_INSTALL_TMP/release/RINet_Build_013_Scientific_Transparency_Studio/INSTALL_BUILD_013.sh"
bash "$RINET_INSTALL_TMP/release/RINet_Build_013_Scientific_Transparency_Studio/INSTALL_BUILD_013.sh"

echo
echo "RINet is installed. Launch it with:"
echo "  ~/.local/bin/rinet gui"
