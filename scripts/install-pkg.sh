#!/usr/bin/env bash
set -euo pipefail
pin=$(tr -d '[:space:]' < platform.lock)
out=${1:?usage: scripts/install-pkg.sh <pkg path>}
if [[ $pin =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  scratch=$(mktemp -d)
  (cd "$scratch" && gh release download "$pin" --repo xuciro-commits/platform --pattern pkg-linux-amd64 --pattern SHA256SUMS)
  (cd "$scratch" && grep '  pkg-linux-amd64$' SHA256SUMS | sha256sum -c -)
  install -m 0755 "$scratch/pkg-linux-amd64" "$out"
  echo "pkg from platform release $pin"
elif [[ $pin =~ ^[0-9a-f]{40}$ ]]; then
  test -d .platform/capabilities/server || { echo "platform commit $pin is not checked out at .platform" >&2; exit 1; }
  (cd .platform/capabilities/server && go build -trimpath -o "$out" ./cmd/pkg)
  echo "pkg built from platform commit $pin"
else
  echo "platform.lock must hold a platform release such as v0.2.6 or a full 40-character platform commit, not \"$pin\"" >&2
  exit 1
fi
