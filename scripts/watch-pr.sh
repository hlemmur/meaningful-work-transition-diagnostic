#!/usr/bin/env bash
set -euo pipefail

PR="${1:?usage: watch-pr.sh <pr-number>}"
REPO="${WATCH_PR_REPO:-hlemmur/meaningful-work-transition-diagnostic}"
STATE_FILE="${TMPDIR:-/tmp}/mwtd-pr-${PR}.state"
INTERVAL="${WATCH_PR_INTERVAL_SEC:-60}"

fingerprint() {
  gh pr view "$PR" --repo "$REPO" --json state,mergedAt,updatedAt,reviews \
    --jq '{state,mergedAt,updatedAt,reviewCount:(.reviews|length)}'
}

current="$(fingerprint)"
printf '%s\n' "$current" > "$STATE_FILE"

while true; do
  sleep "$INTERVAL"
  next="$(fingerprint)" || continue
  if [[ "$next" != "$(cat "$STATE_FILE")" ]]; then
    printf '%s\n' "$next" > "$STATE_FILE"
    echo "AGENT_LOOP_WAKE_pr${PR} {\"prompt\":\"GitHub PR #${PR} changed: ${next}. If state is MERGED, mark the Linear issue Done and continue the plan. If there are new review comments, address them on the same branch without merging.\"}"
  fi
done
