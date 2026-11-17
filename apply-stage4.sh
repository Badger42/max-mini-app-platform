#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f package.json || ! -d src/platform ]]; then
  echo "Run this script from the max-mini-app-platform repository root." >&2
  exit 1
fi

marker='<!-- stage4-reliability -->'
if ! grep -q "$marker" README.md; then
  cat >> README.md <<'README_EOF'

<!-- stage4-reliability -->
## Reliability checks and real-client verification

Install dependencies and run `npm run check` to execute ESLint, JSDoc type
checking and the Node regression suite. The SDK loader and BackButton lifecycle
contracts, injected download service and browser Blob cleanup are described in
[docs/stage4-reliability.md](docs/stage4-reliability.md).

Node mocks do not replace testing in actual MAX Android, iOS and Desktop
clients. Use the manual checklist in [tests/README.md](tests/README.md), record
the MAX client version and platform, and leave untested rows marked **Not run**.
README_EOF
fi

echo "Stage 4 overlay documentation linked in README.md."
