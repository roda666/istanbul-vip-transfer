#!/bin/sh
# Periodically pushes new commits to GitHub.
# Runs as a background workflow; exits cleanly if nothing to push.

while true; do
  LOCAL=$(git -C /home/runner/workspace rev-parse HEAD 2>/dev/null)
  REMOTE=$(git -C /home/runner/workspace rev-parse origin/main 2>/dev/null)

  if [ "$LOCAL" != "$REMOTE" ]; then
    echo "[github-sync] Pushing $LOCAL → origin/main"
    git -C /home/runner/workspace push origin main 2>&1 && \
      echo "[github-sync] Push OK" || \
      echo "[github-sync] Push failed"
  fi

  sleep 60
done
