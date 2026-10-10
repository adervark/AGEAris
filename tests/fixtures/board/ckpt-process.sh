#!/bin/bash
# ckpt-process.sh <ckpt.sh>: a run names its process, and a reader says running
# or closed and which rule decided it (T070). One line per case.
#
# A fake `ps` answers from a table, and AA_BOOT_ID stands in for this boot, so
# every rule is exercised the same way on any machine. The last cases use the
# real `ps` on a real process.
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
unset CLAUDE_PID AA_SESSION_PID AA_BOOT_ID CLAUDE_CODE_SESSION_ID
R="$W/repo"; git init -q "$R"; mkdir -p "$R/AA/checkpoints" "$R/AA/tasks"; cp "$1" "$R/AA/ckpt.sh"
printf 'stale_hours: 24\nlive_minutes: 30\n' > "$R/AA/AA.yml"
REAL_PATH=$PATH

# `ps -o <field>= -p <pid>`, answered from $W/procs: "pid ppid comm lstart…".
# A pid that is not listed answers nothing and fails, as ps does; a row whose
# pid is `*` answers for every pid that is not listed.
mkdir "$W/bin"; cat > "$W/bin/ps" <<'PS'
#!/bin/bash
field=""; pid=""
while [ $# -gt 0 ]; do case "$1" in -o) field="${2%=}"; shift 2 ;; -p) pid="$2"; shift 2 ;; *) shift ;; esac; done
line=$(awk -v p="$pid" '$1 == p { print; found = 1; exit } $1 == "*" { star = $0 } END { if (!found && star != "") print star }' "$FAKE_PS")
[ -n "$line" ] || exit 1
set -- $line
case "$field" in ppid) echo "  $2" ;; comm) echo "$3" ;; lstart) shift 3; echo "$*" ;; esac
PS
chmod +x "$W/bin/ps"
cat > "$W/procs" <<'T'
4001 1 claude Sat Oct  3 10:00:00 2026
4003 1 claude Sun Oct  4 11:00:00 2026
4005 1 claude Mon Oct  5 12:00:00 2026
T
BOOT=11111111-2222-3333-4444-555555555555
export FAKE_PS="$W/procs" PATH="$W/bin:$REAL_PATH" AA_BOOT_ID="$BOOT"

ago() { jq -nr --argjson m "$1" 'now - $m * 60 | floor | todate'; }   # minutes ago, as a ts
line() { jq -cn "$@" >> "$R/AA/checkpoints/$T.jsonl"; }              # one trail line, built with jq
proc() { printf ',"boot":"%s","pid":%s,"pstart":"%s"' "$1" "$2" "$3"; }
say() { # say <case>: the verdict on the one run in $T's trail
  printf '%s: %s\n' "$1" "$(cd "$R" && . AA/ckpt.sh && runs "AA/checkpoints/$T.jsonl" \
    | awk -F'\037' '{ print $7 " (" $8 ")" }' | sed -E 's/until [0-9T:Z-]+/until <time>/')"
}
raw() { printf '%s\n' "$1" >> "$R/AA/checkpoints/$T.jsonl"; }

# 1. An end closes the run, whatever its process.
T=T001; raw "{\"ts\":\"$(ago 5)\",\"run\":\"a\",\"kind\":\"open\"$(proc $BOOT 4001 'Sat Oct 3 10:00:00 2026')}"
raw "{\"ts\":\"$(ago 4)\",\"run\":\"a\",\"kind\":\"end\",\"next\":\"-\"}"; say ended
# 2. A doing whose until is ahead is running, however long silent and wherever its process.
T=T002; raw "{\"ts\":\"$(ago 300)\",\"run\":\"b\",\"kind\":\"doing\",\"act\":\"fold 0\",\"until\":\"$(ago -60)\",\"next\":\"-\"}"; say until-ahead
T=T003; raw "{\"ts\":\"$(ago 300)\",\"run\":\"c\",\"kind\":\"doing\",\"act\":\"fold 0\",\"until\":\"$(ago -60)\",\"next\":\"-\"$(proc $BOOT 4002 'Sat Oct 3 10:00:00 2026')}"; say until-ahead-process-gone
# 3. On this boot the process decides: alive is running after 10 hours of silence,
#    gone is closed one minute after its last word, and a reused pid is gone.
T=T004; raw "{\"ts\":\"$(ago 600)\",\"run\":\"d\",\"kind\":\"did\",\"next\":\"-\"$(proc $BOOT 4001 'Sat Oct 3 10:00:00 2026')}"; say process-alive
T=T005; raw "{\"ts\":\"$(ago 1)\",\"run\":\"e\",\"kind\":\"doing\",\"act\":\"x\",\"next\":\"-\"$(proc $BOOT 4002 'Sat Oct 3 10:00:00 2026')}"; say process-gone
T=T006; raw "{\"ts\":\"$(ago 1)\",\"run\":\"f\",\"kind\":\"did\",\"next\":\"-\"$(proc $BOOT 4003 'Sat Oct 3 10:00:00 2026')}"; say pid-reused
T=T007; raw "{\"ts\":\"$(ago 90)\",\"run\":\"g\",\"kind\":\"doing\",\"act\":\"x\",\"until\":\"$(ago 30)\",\"next\":\"-\"$(proc $BOOT 4001 'Sat Oct 3 10:00:00 2026')}"; say until-past-process-alive
# The newest entry that names a process is the one that counts (a resumed session).
T=T008; raw "{\"ts\":\"$(ago 60)\",\"run\":\"h\",\"kind\":\"open\"$(proc $BOOT 4001 'Sat Oct 3 10:00:00 2026')}"
raw "{\"ts\":\"$(ago 2)\",\"run\":\"h\",\"kind\":\"did\",\"next\":\"-\"$(proc $BOOT 4009 'Fri Oct 9 09:00:00 2026')}"
raw "{\"ts\":\"$(ago 1)\",\"run\":\"h\",\"kind\":\"did\",\"next\":\"-\"}"; say newest-process-counts
# 4. Otherwise the clock: another boot (another machine, or a reboot), or no process named.
T=T009; raw "{\"ts\":\"$(ago 5)\",\"run\":\"i\",\"kind\":\"did\",\"next\":\"-\"$(proc 99999999-0000-0000-0000-000000000000 4001 'Sat Oct 3 10:00:00 2026')}"; say other-boot-recent
T=T010; raw "{\"ts\":\"$(ago 120)\",\"run\":\"j\",\"kind\":\"did\",\"next\":\"-\"$(proc 99999999-0000-0000-0000-000000000000 4001 'Sat Oct 3 10:00:00 2026')}"; say other-boot-silent
T=T011; raw "{\"ts\":\"$(ago 29)\",\"run\":\"k\",\"kind\":\"doing\",\"act\":\"x\",\"next\":\"-\"}"; say clock-heard
T=T012; raw "{\"ts\":\"$(ago 31)\",\"run\":\"l\",\"kind\":\"doing\",\"act\":\"x\",\"next\":\"-\"}"; say clock-silent
# until counts at most stale_hours past its line: 25 h ago with 10 h still to go is past.
T=T013; raw "{\"ts\":\"$(ago 1500)\",\"run\":\"m\",\"kind\":\"doing\",\"act\":\"x\",\"until\":\"$(ago -600)\",\"next\":\"-\"}"; say until-capped
# A pid that is not a positive whole number names no process.
T=T014; raw "{\"ts\":\"$(ago 45)\",\"run\":\"n\",\"kind\":\"did\",\"next\":\"-\",\"boot\":\"$BOOT\",\"pid\":\"4001\",\"pstart\":\"Sat Oct 3 10:00:00 2026\"}"; say pid-not-a-number

# ckpt.sh live: a doing whose run is running is in flight, one whose run is closed stopped mid-act.
(cd "$R" && bash AA/ckpt.sh live) > "$W/live"
printf 'in flight: %s\n' "$(sed -n '/^IN FLIGHT/,/^STOPPED/p' "$W/live" | grep -oE '^  T[0-9]+' | tr -d ' ' | tr '\n' ' ')"
printf 'stopped: %s\n' "$(sed -n '/^STOPPED/,$p' "$W/live" | grep -oE '^  T[0-9]+' | tr -d ' ' | tr '\n' ' ')"

# THE WRITER. open names the session's process; log names it again only when it changed.
export CLAUDE_CODE_SESSION_ID=0badc0de-0000-4000-8000-000000000000
ck() { (cd "$R" && bash AA/ckpt.sh "$@" 2>>"$W/err" >/dev/null); }
last() { tail -1 "$R/AA/checkpoints/T020.jsonl" | jq -c '{kind, boot, pid, pstart}'; }
CLAUDE_PID=4001 ck open T020 --brief "x" --no-commit; echo "open: $(last)"
CLAUDE_PID=4001 ck log T020 did --what x --where y --next z; echo "same process: $(last)"
CLAUDE_PID=4005 ck log T020 did --what x --where y --next z; echo "new process: $(last)"
CLAUDE_PID=4005 CLAUDE_CODE_SESSION_ID=feedface-0000-4000-8000-000000000000 ck log T020 did --run 0badc0de --what x --where y --next z
echo "another session's run: $(last)"
CLAUDE_PID=4003 CLAUDE_CODE_SESSION_ID=feedface-0000-4000-8000-000000000000 ck log T020 end --run 0badc0de --changed x --cost 0 --left n --next z
echo "reaping end: $(last)"
: > "$W/err"; CLAUDE_PID=4001 ck open T020 --brief "again" --no-commit
echo "open after the end: $(last)"
CLAUDE_PID=4003 ck open T020 --brief "resumed" --no-commit
echo "resumed in a new process: $(grep -c 'now gone' "$W/err") warning, $(wc -l < "$R/AA/checkpoints/T020.jsonl" | tr -d ' ') lines"
AA_SESSION_PID=4003 CLAUDE_PID=4001 ck open T021 --brief "x" --no-commit
echo "AA_SESSION_PID first: $(tail -1 "$R/AA/checkpoints/T021.jsonl" | jq -c .pid)"
CLAUDE_PID=4002 ck open T022 --brief "x" --no-commit
echo "a gone process is not named: $(tail -1 "$R/AA/checkpoints/T022.jsonl" | jq -c '[has("boot"), has("pid"), has("pstart")]')"
# No harness variable: the nearest claude, codex or gemini above the shell.
printf '* 7001 bash\n7001 7000 bash\n7000 1 codex Tue Oct 6 08:00:00 2026\n' >> "$W/procs"
ck open T023 --brief "x" --no-commit
echo "found above the shell: $(tail -1 "$R/AA/checkpoints/T023.jsonl" | jq -c '[.pid, .pstart]')"

# THE REAL PROCESS TABLE: a live process is running; killed, its run is closed.
unset FAKE_PS AA_BOOT_ID; export PATH="$REAL_PATH"
sleep 60 & P=$!
CLAUDE_PID=$P ck open T030 --brief "x" --no-commit
T=T030; v1=$(say real | sed "s/$P/<pid>/")
kill "$P"; wait "$P" 2>/dev/null
v2=$(say real | sed "s/$P/<pid>/")
printf '%s\n%s\n' "$v1" "$v2"
