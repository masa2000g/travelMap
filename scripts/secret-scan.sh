#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

if ! command -v rg >/dev/null 2>&1; then
  echo "ripgrep (rg) is required for secret scanning." >&2
  exit 1
fi

found=0
patterns=(
  'AIza[0-9A-Za-z\-_]{35}'                         # Firebase Web API key pattern
  '-----BEGIN (PRIVATE KEY|RSA PRIVATE KEY)-----'  # PEM private keys
  'serviceAccountKey\.json'                        # Firebase Admin service account filename
  '(?i)(secret|token|password)[^\n]{0,40}[\"'"'"'`][A-Za-z0-9/+=._-]{12,}' # generic secret-ish strings
)

for pat in "${patterns[@]}"; do
  if rg --hidden --glob '!.git' --glob '!node_modules' --glob '!.firebase' -n "$pat" .; then
    echo "Possible secret match (pattern: $pat)" >&2
    found=1
  fi
done

if [[ $found -eq 1 ]]; then
  echo "Secret scan failed. Inspect the matches above." >&2
  exit 1
fi

echo "Secret scan passed (no matches)."
