#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [ "$(uname -s)" != Darwin ]; then echo 'This package requires macOS.' >&2; exit 1; fi
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo 'Install Node.js 22 or newer from https://nodejs.org, then run this installer again.' >&2
  exit 1
fi
node -e 'if(Number(process.versions.node.split(".")[0])<22){console.error("Node.js 22+ required");process.exit(1)}'
npm ci --ignore-scripts --no-audit --no-fund
npm test
node scripts/setup.mjs
node scripts/doctor.mjs
echo 'Installed. See generated-configs/ and README-TH.md for client setup.'
