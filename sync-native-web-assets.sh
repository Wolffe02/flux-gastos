#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
for target in \
  "$root/native/android/app/src/main/assets/public" \
  "$root/native/ios/Flux/public" \
  "$root/native/windows/web"; do
  mkdir -p "$target"
  cp "$root/index.html" "$root/manifest.webmanifest" "$root/service-worker.js" "$target/"
  rm -rf "$target/icons"
  cp -a "$root/icons" "$target/icons"
done
