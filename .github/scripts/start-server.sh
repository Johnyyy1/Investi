#!/usr/bin/env bash
# Starts `next start` (or `next dev`) in the background and waits until it answers.
# The server takes DATABASE_URL, BETTER_AUTH_URL and any other settings from the calling step's environment.
# Usage: .github/scripts/start-server.sh <port> [start|dev] [probe path]
set -euo pipefail
port=$1
mode=${2:-start}
probe=${3:-/}
log="next-$port.log"
nohup npx next "$mode" -p "$port" > "$log" 2>&1 &
for attempt in $(seq 1 120); do
  curl -sf -o /dev/null "http://localhost:$port$probe" && exit 0
  sleep 1
done
cat "$log"
exit 1
