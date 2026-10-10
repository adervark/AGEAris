#!/bin/bash
# ckpt-until.sh <ckpt.sh>: a doing that may run silent says until when (T069).
# One line per case: what ckpt.sh wrote, or its exit code when it refused.
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 CLAUDE_CODE_SESSION_ID=0badc0de-0000-4000-8000-000000000000
git init -q "$W"; mkdir -p "$W/AA/checkpoints" "$W/AA/tasks"; cp "$1" "$W/AA/ckpt.sh"
T="$W/AA/checkpoints/T001.jsonl"
ck() { (cd "$W" && bash AA/ckpt.sh "$@" >/dev/null 2>&1); }
ck open T001 --brief "fold 0" --no-commit
# --for 2h: until is two hours after ts, to the second.
ck log T001 doing --act "fold 0" --tell "last.ckpt" --next "resume" --for 2h
jq -r 'select(.kind=="doing") | ((.until|fromdateiso8601) - (.ts|fromdateiso8601)) as $d | "for 2h: \($d >= 7199 and $d <= 7201)"' "$T"
# --until with a UTC time is written as given.
ck log T001 doing --act "fold 1" --next "resume" --until 2030-01-01T00:00:00Z
tail -1 "$T" | jq -r '"until: \(.until)"'
# No --for or --until: no until field, as before.
ck log T001 did --what "fold 0" --where "out/" --next "fold 1"
tail -1 "$T" | jq -r '"plain did: \(has("until"))"'
# Refused: a bad duration, a bad time, and either one on anything but a doing.
ck log T001 doing --act x --next y --for 2 ; echo "for 2: $?"
ck log T001 doing --act x --next y --for 1.5h ; echo "for 1.5h: $?"
ck log T001 doing --act x --next y --until tomorrow ; echo "until tomorrow: $?"
ck log T001 did --what x --where y --next z --for 2h ; echo "did --for: $?"
ck log T001 end --changed x --cost 0 --left n --next z --until 2030-01-01T00:00:00Z ; echo "end --until: $?"
echo "lines: $(wc -l < "$T" | tr -d ' ')"
