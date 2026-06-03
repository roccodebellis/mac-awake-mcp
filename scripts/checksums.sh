#!/usr/bin/env bash
# Generate SHA-256 checksums for the publishable artifacts.
#
# Run before tagging a release; attach the resulting SHA256SUMS.txt to the
# GitHub Release so users can verify what they built matches what was published:
#
#   npm run checksums
#   shasum -a 256 -c SHA256SUMS.txt
#
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build >/dev/null

out="SHA256SUMS.txt"
: >"$out"

# Hash exactly what ships in the npm "files" list: dist/, assets/, plus the
# top-level README and LICENSE. Sorted for a stable, reproducible ordering.
find dist assets -type f -print0 |
  LC_ALL=C sort -z |
  while IFS= read -r -d '' f; do
    shasum -a 256 "$f" >>"$out"
  done
shasum -a 256 README.md LICENSE >>"$out"

printf 'Wrote %s (%s entries)\n' "$out" "$(wc -l <"$out" | tr -d ' ')"
