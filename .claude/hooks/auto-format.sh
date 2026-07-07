#!/usr/bin/env bash
# PostToolUse(Edit|Write): format the touched file, best-effort.
set -euo pipefail
input="$(cat)"
file="$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
[ -n "${file:-}" ] && [ -f "$file" ] || exit 0
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.md)
    npx --no-install prettier --write "$file" >/dev/null 2>&1 || true ;;
esac
exit 0
