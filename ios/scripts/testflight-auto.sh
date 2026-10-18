#!/bin/bash
# Runs daily from launchd. Uploads both apps to TestFlight only when the last
# successful upload is at least INTERVAL_DAYS old (TestFlight builds expire after 90 days).
# Manual force: ios/scripts/testflight-auto.sh --force
set -uo pipefail

INTERVAL_DAYS=80
DIR="$HOME/.appstoreconnect"
STAMP="$DIR/last-upload"
LOG_DIR="$DIR/logs"
SCRIPT="$(cd "$(dirname "$0")" && pwd)/testflight.sh"

mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/auto-$(date +%Y%m%d).log"
exec >>"$LOG" 2>&1
echo "=== $(date) ==="

notify() { osascript -e "display notification \"$1\" with title \"TestFlight\"" >/dev/null 2>&1 || true; }

if [ "${1:-}" != "--force" ] && [ -f "$STAMP" ]; then
  age=$(( ( $(date +%s) - $(stat -f %m "$STAMP") ) / 86400 ))
  if [ "$age" -lt "$INTERVAL_DAYS" ]; then
    echo "Last upload $age days ago, nothing to do"
    exit 0
  fi
fi

export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin"
if "$SCRIPT"; then
  touch "$STAMP"
  echo "Upload OK"
  notify "Noam Finance + Notes uploaded, TestFlight will update them."
else
  echo "Upload FAILED"
  notify "Upload failed. See ~/.appstoreconnect/logs"
  exit 1
fi
