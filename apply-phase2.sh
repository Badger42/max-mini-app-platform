#!/usr/bin/env sh
set -eu

OVERLAY_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_DIR=${1:-.}

if [ ! -f "$REPO_DIR/package.json" ] || [ ! -d "$REPO_DIR/src/platform" ]; then
  echo "Usage: $0 /path/to/max-mini-app-platform-checkout" >&2
  exit 2
fi

for path in src docs examples tests; do
  if [ -d "$OVERLAY_DIR/$path" ]; then
    mkdir -p "$REPO_DIR/$path"
    cp -R "$OVERLAY_DIR/$path/." "$REPO_DIR/$path/"
  fi
done

while IFS= read -r path; do
  [ -n "$path" ] || continue
  rm -f "$REPO_DIR/$path"
done < "$OVERLAY_DIR/DELETE-FILES.txt"

cp "$OVERLAY_DIR/README.md" "$REPO_DIR/README.md"
cp "$OVERLAY_DIR/Requirements.md" "$REPO_DIR/Requirements.md"
cp "$OVERLAY_DIR/APPLY.md" "$REPO_DIR/APPLY.md"
cp "$OVERLAY_DIR/ARCHIVE-INFO.md" "$REPO_DIR/ARCHIVE-INFO.md"

echo "Phase 2 overlay copied. Run: cd $REPO_DIR && npm test"
