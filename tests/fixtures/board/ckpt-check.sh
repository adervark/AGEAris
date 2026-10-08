#!/bin/bash
# ckpt-check.sh <ckpt.sh>: the exit codes of `ckpt.sh check` on a clean trail,
# a bad one, and a bad one before a clean one (T016), one per line.
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
git init -q "$W"; mkdir -p "$W/AA/checkpoints" "$W/AA/tasks"; cp "$1" "$W/AA/ckpt.sh"
printf '%s\n' '{"ts":"2026-10-08T00:00:00Z","run":"r1","kind":"did","what":"x","where":"y","next":"z"}' > "$W/AA/checkpoints/T001.jsonl"
(cd "$W" && bash AA/ckpt.sh check T001 >/dev/null 2>&1); echo "clean: $?"
printf '%s\n' 'not json' >> "$W/AA/checkpoints/T001.jsonl"
(cd "$W" && bash AA/ckpt.sh check T001 >/dev/null 2>&1); echo "bad: $?"
printf '%s\n' '{"ts":"2026-10-08T00:00:00Z","run":"r1","kind":"did","what":"x","where":"y","next":"z"}' > "$W/AA/checkpoints/T002.jsonl"
(cd "$W" && bash AA/ckpt.sh check >/dev/null 2>&1); echo "bad then clean: $?"
