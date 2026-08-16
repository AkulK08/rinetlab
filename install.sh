#!/usr/bin/env bash
set -euo pipefail

RINET_RELEASE_URL="https://github.com/AkulK08/rinetlab/releases/download/v1.2.0-build012/RINet_Build_012_Research_Utility_Studio_2026-08-16.zip"
RINET_RELEASE_SHA256="8013a1c877a8eefe0dd85421c0a2945146bb988be3b362b10559b171d2d56340"
RINET_INSTALL_TMP="$(mktemp -d)"
trap 'rm -rf "$RINET_INSTALL_TMP"' EXIT

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This one-line installer currently supports macOS."
  echo "Download the cross-platform source release at https://github.com/AkulK08/rinetlab/releases/tag/v1.2.0-build012"
  exit 1
fi

echo "Downloading RINet Build 012…"
curl -fL "$RINET_RELEASE_URL" -o "$RINET_INSTALL_TMP/rinet.zip"
echo "$RINET_RELEASE_SHA256  $RINET_INSTALL_TMP/rinet.zip" | shasum -a 256 -c -
unzip -q "$RINET_INSTALL_TMP/rinet.zip" -d "$RINET_INSTALL_TMP/release"
chmod +x "$RINET_INSTALL_TMP/release/RINet_Build_012_Research_Utility_Studio/INSTALL_BUILD_012.sh"
bash "$RINET_INSTALL_TMP/release/RINet_Build_012_Research_Utility_Studio/INSTALL_BUILD_012.sh"

echo
echo "RINet is installed. Launch it with:"
echo "  ~/.local/bin/rinet gui"
