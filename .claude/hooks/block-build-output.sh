#!/usr/bin/env bash
# PreToolUse(Bash): block token-heavy build commands inside a session.
set -euo pipefail
input="$(cat)"
cmd="$(printf '%s' "$input" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p')"
case "$cmd" in
  *"eas build"*|*"expo run:"*|*"gradlew"*|*"pod install"*|*"xcodebuild"*)
    echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Heavy build detected. Run it in a real terminal, then paste only the error here (keeps session tokens low)."}}'
    exit 0 ;;
esac
echo '{}'
