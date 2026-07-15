#!/usr/bin/env bash
# PreToolUse(Bash): when a task runs under the board's autonomous runner
# (BOARD_RUNNER_NO_EGRESS=1 in the child's env), deny the push/merge/remote and
# network footguns even though the headless run uses --permission-mode
# bypassPermissions. Hooks run regardless of permission mode, so this is the
# enforced no-egress boundary. Outside the runner (flag unset), it is a no-op.
set -euo pipefail
input="$(cat)"

# Not a runner-spawned child -> allow everything (normal interactive session).
if [ -z "${BOARD_RUNNER_NO_EGRESS:-}" ]; then
  echo '{}'
  exit 0
fi

cmd="$(printf '%s' "$input" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p')"

deny() {
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"blocked by board runner (no egress / no push-merge)"}}'
  exit 0
}

case "$cmd" in
  *"git push"*|*"git merge"*|*"git remote"*|*"git worktree"*) deny ;;
  *"curl"*|*"wget"*|*"nc "*|*"ncat"*|*"ssh "*|*"scp "*) deny ;;
esac

echo '{}'
