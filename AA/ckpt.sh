#!/usr/bin/env bash
# AA checkpoints — one append-only JSONL file per task, one line per event.
#
# The FORMAT is the contract (AA/checkpoints/_SCHEMA.md); this script is
# only the fast path. A line appended by hand with jq is equally valid, and any
# harness that cannot run bash can still take part.
#
# This file is the TRAIL. The board renderer is AA/board.sh, which sources
# this one for the helpers below. Agents append far more often than they render,
# so the thing they load stays small.
set -uo pipefail

die()  { printf 'ckpt: %s\n' "$1" >&2; exit 1; }
warn() { printf 'ckpt: %s\n' "$1" >&2; }
command -v jq >/dev/null || die "jq is required (or append the line by hand — see _SCHEMA.md)"

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || ROOT=$PWD   # works from any subdirectory
DD="$ROOT/AA"
CK="$DD/checkpoints"
TD="$DD/tasks"
BL="$DD/backlog"

now()  { date -u +%FT%TZ; }
file() { printf '%s/%s.jsonl' "$CK" "$1"; }
valid_task() { case "${1:-}" in ""|.*|*[!A-Za-z0-9._-]*) die "not a task id: ${1:-<empty>}" ;; esac; }
mine() { printf '%s' "${CLAUDE_CODE_SESSION_ID:0:8}"; }
myrun() { local s; s=$(mine); [ -n "$s" ] || s="x$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n')"; printf '%s' "$s"; }

# cfg <key> [default] — one value out of AA.yml.
# Flat by design (see the header of AA.yml): `key: value` at column 0, or a
# one-level block whose items are `  - item`. Nothing here needs a YAML parser,
# and adding one would make the config a dependency.
cfg() {
  local k="$1" d="${2:-}" v
  v=$(sed -n "s/^${k}: *//p" "$DD/AA.yml" 2>/dev/null | head -1 | sed 's/ *#.*//; s/ *$//')
  printf '%s' "${v:-$d}"
}
cfg_sub() { # cfg_sub <block> <key> [default] — `block:` then `  key: value`
  local b="$1" k="$2" d="${3:-}" v
  v=$(awk -v b="$b:" -v k="$k:" '
      $0 ~ "^"b { inb=1; next } inb && /^[^[:space:]#]/ { inb=0 }
      inb && $1 == k { $1=""; sub(/^ /,""); sub(/ *#.*/,""); print; exit }' \
      "$DD/AA.yml" 2>/dev/null)
  printf '%s' "${v:-$d}"
}
cfg_list() { # cfg_list <block> — the `  - item` lines under it, one per line
  awk -v b="$1:" '$0 ~ "^"b { inb=1; next } inb && /^[^[:space:]#]/ { inb=0 }
                  inb && /^[[:space:]]*- / { sub(/^[[:space:]]*- /,""); sub(/ *#.*/,""); print }' \
      "$DD/AA.yml" 2>/dev/null
}

# tolerant read: skips a half-written last line or a hand-edited bad one
records()  { jq -Rc 'fromjson? // empty' "$@" 2>/dev/null; }
badlines() { jq -Rr 'select(length>0) | . as $l | (try (fromjson|empty) catch $l)' "$@" 2>/dev/null | wc -l; }

# The policy numbers a reader needs, from AA.yml. stale_hours is rule 4's clock;
# live_minutes is how long a silent run counts as running when its process
# cannot be checked from here, and it is always below stale_hours.
stale_hours() {
  local s; s=$(cfg stale_hours 24)
  case "$s" in ''|*[!0-9]*) s=24 ;; esac
  s=$((10#$s)); [ "$s" -gt 0 ] || s=24
  printf '%s' "$s"
}
live_minutes() {
  local l s; l=$(cfg live_minutes 30); s=$(stale_hours)
  case "$l" in ''|*[!0-9]*) l=30 ;; esac
  l=$((10#$l)); [ "$l" -gt 0 ] || l=30
  [ "$l" -lt $((s * 60)) ] || l=$((s * 60 - 1))
  printf '%s' "$l"
}

# THE PROCESS A RUN LIVES IN (_SCHEMA.md, "The process"). A run names it, so a
# reader on the same machine can tell a session that is running from one that
# is closed: a crash reads as closed at once, and a quiet session that is still
# open reads as running. It is the failsafe the clock cannot be. AA_BOOT_ID
# stands in for the machine's boot id in tests.
boot_id() {
  local b="${AA_BOOT_ID:-}"
  [ -n "$b" ] || b=$(cat /proc/sys/kernel/random/boot_id 2>/dev/null)
  [ -n "$b" ] || b=$(sysctl -n kern.bootsessionuuid 2>/dev/null)
  case "$b" in ''|*[!0-9A-Fa-f-]*) b="" ;; esac
  printf '%s' "$b"
}
proc_start() { # proc_start <pid> -> when that process started, in UTC; nothing when it is gone
  case "${1:-}" in ''|*[!0-9]*) return 0 ;; esac
  TZ=UTC LC_ALL=C ps -o lstart= -p "$1" 2>/dev/null | tr '\t' ' ' | tr -s ' ' | sed 's/^ //; s/ $//'
}
session_pid() { # the session's process: as the harness names it, else an agent CLI above this shell
  local p="${AA_SESSION_PID:-${CLAUDE_PID:-}}" q c i
  case "$p" in *[!0-9]*) p="" ;; esac
  if [ -z "$p" ]; then
    q=$$
    for i in 1 2 3 4 5 6 7 8; do
      q=$(ps -o ppid= -p "$q" 2>/dev/null | tr -d ' ')
      case "$q" in ''|0|1|*[!0-9]*) break ;; esac
      c=$(ps -o comm= -p "$q" 2>/dev/null); c=${c##*/}
      case "$c" in claude|codex|gemini) p=$q; break ;; esac
    done
  fi
  printf '%s' "$p"
}
proc_now() { # this session's process as "boot<TAB>pid<TAB>pstart", or nothing when any part is unknown
  local b p s
  b=$(boot_id); p=$(session_pid)
  [ -n "$b" ] && [ -n "$p" ] || return 0
  s=$(proc_start "$p"); [ -n "$s" ] || return 0
  printf '%s\t%s\t%s' "$b" "$p" "$s"
}
procargs() { # procargs "<boot><TAB><pid><TAB><pstart>" -> PROCARGS, for jq
  PROCARGS=()
  [ -n "${1:-}" ] || return 0
  local b p s; IFS=$'\t' read -r b p s <<<"$1"
  PROCARGS=(--arg boot "$b" --argjson pid "$p" --arg pstart "$s")
}

# A doing that may run silent longer than live_minutes says until when; a
# reader counts it as running until then, whatever its process (_SCHEMA.md).
until_of() { # until_of <N>m|h|d -> the UTC time that far from now
  local n="${1%[mhd]}" s
  case "$n" in ''|*[!0-9]*) die "--for takes minutes, hours or days: 90m, 2h, 1d" ;; esac
  case "${1: -1}" in m) s=$((n * 60)) ;; h) s=$((n * 3600)) ;; d) s=$((n * 86400)) ;;
    *) die "--for takes minutes, hours or days: 90m, 2h, 1d" ;; esac
  jq -nr --argjson s "$s" 'now + $s | floor | todate'
}

argify() { # --key value ... -> jq --arg pairs; also eats --commit / --run / --force / --for
  JQARGS=(); PROCARGS=(); COMMIT_MSG=""; RUN_OVERRIDE=""; AGENT=""; UNTIL=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --commit) COMMIT_MSG="${2:-}"; shift 2 ;;
      --run)    RUN_OVERRIDE="${2:-}"; shift 2 ;;
      --for)    [ $# -ge 2 ] || die "--for needs a value: 90m, 2h, 1d"
                UNTIL=$(until_of "$2") || exit 1
                JQARGS+=(--arg until "$UNTIL"); shift 2 ;;
      --force|--delete|--no-commit) FLAGS="${FLAGS:-} $1"; shift ;;
      --*) k="${1#--}"; k="${k//-/_}"; [ $# -ge 2 ] || die "--$k needs a value"
           [ "$k" = agent ] && AGENT="$2"
           if [ "$k" = until ]; then
             jq -en --arg u "$2" '$u | fromdateiso8601' >/dev/null 2>&1 \
               || die "--until must be a UTC time like 2026-10-10T09:00:00Z (or use --for 2h)"
             UNTIL="$2"
           fi
           JQARGS+=(--arg "$k" "$2"); shift 2 ;;
      *) die "unexpected argument: $1" ;;
    esac
  done
}

emit() { # emit <file> <run> <kind>  (JQARGS, and PROCARGS if any, already set)
  jq -cn --arg ts "$(now)" --arg run "$2" --arg kind "$3" "${JQARGS[@]}" ${PROCARGS[@]+"${PROCARGS[@]}"} \
     '{ts:$ts,run:$run,kind:$kind} + ($ARGS.named|del(.ts,.run,.kind))' >> "$1" \
    || die "write failed: $1"
}

last_proc() { # last_proc <file> <run> -> the process that run names last, as proc_now prints it
  records "$1" | jq -sr --arg r "$2" '[.[] | select(.run == $r and (.boot|type) == "string"
      and (.pid|type) == "number" and .pid > 0 and .pid == (.pid|floor) and (.pstart|type) == "string")]
    | last | if . then "\(.boot)\t\(.pid)\t\(.pstart)" else "" end'
}

commit() { # commit <msg> <path> — retries: parallel runs contend on .git/index.lock
  local msg="$1" p="$2" i err
  git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1 || return 0
  for i in 1 2 3 4 5 6; do
    # --no-verify is LOAD-BEARING, not a shortcut. A checkpoint commit is the
    # record that something expensive is ABOUT to happen, and rule 6 requires it
    # to reach git BEFORE the act. A pre-commit hook that rejects it — the
    # board.sh --check gate this convention itself recommends is one — would
    # block the trail at exactly the moment it matters, and the failure would be
    # silent because the line is already on disk. A `ckpt:` commit touches one
    # append-only JSONL file and nothing a hook needs to inspect.
    err=$(git -C "$ROOT" add -- "$p" 2>&1 &&
          git -C "$ROOT" commit -q --no-verify -m "ckpt: $msg" -- "$p" 2>&1) && return 0
    case "$err" in
      *index.lock*|*"Unable to create"*) sleep "0.$((RANDOM % 7 + 2))"; continue ;;
      *) break ;;                    # not contention: retrying will not help
    esac
  done
  # Say WHY. This used to report "index busy" for every failure, including a
  # hook rejection, which is a message that names the wrong cause — the defect
  # class this convention exists to prevent.
  warn "NOT COMMITTED: $p — the line is ON DISK and nothing is lost; commit it with the next one"
  [ -n "${err:-}" ] && warn "  git said: $(printf '%s' "$err" | head -2 | tr '\n' ' ')"
  return 1
}

task_committed() { # warn when the task is still in backlog/ — a checkpoint is not a claim
  local t="$1"
  compgen -G "$TD/$t-*.md" >/dev/null && return 0
  compgen -G "$BL/$t-*.md" >/dev/null || return 0
  warn "$t is still in backlog/ — claiming is what moves it to tasks/ (RULES rule 1)"
}

cmd_open() { # open <TASK> [--agent LABEL] --brief "..." [--budget ...] [--no-commit]
  local task="${1:-}"; shift || true
  [ -n "$task" ] || die "usage: ckpt.sh open <TASK> --brief '...' [--agent LABEL]"
  valid_task "$task"; mkdir -p "$CK"; local f; f=$(file "$task"); : >> "$f"
  FLAGS=""; argify "$@"
  local run
  if [ -n "$AGENT" ]; then
    run="$(myrun).$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n')"   # a child of this session
  else
    run=$(myrun)
    local open_already
    open_already=$(records "$f" | jq -sr --arg r "$run" '[.[]|select(.run==$r)] as $m
       | if ($m|length)==0 then "" elif ($m[-1].kind=="end") then "" else $r end')
    if [ -n "$open_already" ]; then
      warn "this session already has an open run on $task — continuing it"
      local was; was=$(last_proc "$f" "$run")
      if [ -n "$was" ] && [ "$was" != "$(proc_now)" ]; then
        warn "it was in another process, now gone (a resumed session): if its last entry is a doing, check that act's tell first — ckpt.sh live $task"
      fi
      printf '%s\n' "$run"; return 0
    fi
  fi
  task_committed "$task"
  procargs "$(proc_now)"     # none when the process cannot be found: readers then go by the clock
  jq -cn --arg ts "$(now)" --arg run "$run" --arg kind open \
     --arg operator "$(git -C "$ROOT" config user.name 2>/dev/null)" \
     --arg profile "$(basename "${CLAUDE_CONFIG_DIR:-$HOME/.claude}" | sed 's/^\.claude-\?//; s/^$/default/')" \
     --arg session "${CLAUDE_CODE_SESSION_ID:-}" ${PROCARGS[@]+"${PROCARGS[@]}"} "${JQARGS[@]}" \
     '{ts:$ts,run:$run,kind:$kind,operator:$operator,profile:$profile,session:$session}
      + ($ARGS.named|del(.ts,.run,.kind,.operator,.profile,.session))' >> "$f"
  case " ${FLAGS:-} " in *" --no-commit "*) ;; *) commit "$task $run open" "$f" ;; esac
  printf '%s\n' "$run"
}

cmd_log() { # log <TASK> <kind> [--run ID] [--key value]... [--commit "msg"]
  local task="${1:-}" kind="${2:-}"
  shift 2 2>/dev/null || die "usage: ckpt.sh log <TASK> <did|doing|blocked|end> [--run ID] [--key value]..."
  case "$kind" in did|doing|blocked|end) ;;
    *) die "kind must be did|doing|blocked|end (the header is written by 'open')" ;; esac
  valid_task "$task"
  local f; f=$(file "$task")
  [ -f "$f" ] || die "no trail for $task — open a run first: ckpt.sh open $task --brief '...'"
  FLAGS=""; argify "$@"
  [ -n "$UNTIL" ] && [ "$kind" != doing ] && die "--for and --until belong on a doing: how long the act may run silent"
  local run="${RUN_OVERRIDE:-$(myrun)}"
  local owner; owner=$(records "$f" | jq -sr --arg r "$run" 'map(select(.run==$r and .kind=="open"))|last|.session // ""')
  [ -z "$owner" ] && warn "no open line for run $run on $task — logging anyway"
  if [ -n "$owner" ] && [ -n "${CLAUDE_CODE_SESSION_ID:-}" ] && \
     [ "$owner" != "$CLAUDE_CODE_SESSION_ID" ] && [ "$kind" != end ]; then
    warn "run $run belongs to session ${owner:0:8}, not yours — only an 'end' (reaping a dead run) belongs in someone else's run"
  fi
  # A run that goes on in a new process (a resumed session) names it again, so
  # a reader checks the right one. Never on an end, and never in another
  # session's run: a reaping end belongs to the run it closes.
  if [ "$kind" != end ] && { [ -z "$RUN_OVERRIDE" ] || { [ -n "$owner" ] && [ "$owner" = "${CLAUDE_CODE_SESSION_ID:-}" ]; }; }; then
    local cur; cur=$(proc_now)
    if [ -n "$cur" ] && [ "$cur" != "$(last_proc "$f" "$run")" ]; then procargs "$cur"; fi
  fi
  emit "$f" "$run" "$kind"
  [ -n "$COMMIT_MSG" ] && commit "$COMMIT_MSG" "$f"
  return 0
}

# RUNNING OR CLOSED (_SCHEMA.md). Every run in ONE trail, newest first, one line
# each, fields separated by \037: epoch, run, who, kind, age, next, state, why,
# act, tell. The first rule that applies decides, and `why` names it:
#
#   1. its newest entry is an end                  closed   "ended"
#   2. a doing whose until is ahead                running  "until <time>"
#   3. it names its process, on this boot          running  "process <pid> alive"
#                                                  closed   "process <pid> gone"
#   4. otherwise, the clock (live_minutes)         running or closed, "clock, heard <age>"
#
# One trail at a time. Run ids are session-derived, so a session that works two
# tasks writes the same id into both trails; grouping every trail by run at once
# merged those runs, and a closed task's `end` hid another task's live `doing`.
# On 2026-09-14 this printed "none" with a fold queued on the card (RSNA T092).
runs() { # runs <file>
  local now stale live mine
  now=$(date +%s); stale=$(stale_hours); live=$(live_minutes); mine=$(boot_id)
  records "$1" | jq -sr --argjson now "$now" --argjson stale "$stale" '
    def epoch: if type == "string" then ((fromdateiso8601? // null) | if . == null then null else floor end) else null end;
    def ago($s): ($now - $s) as $d
      | if $d < 90 then "just now" elif $d < 5400 then "\(($d/60)|floor)m ago"
        elif $d < 172800 then "\(($d/3600)|floor)h ago" else "\(($d/86400)|floor)d ago" end;
    def flat: tostring | gsub("[\u0000-\u001f]"; " ");
    [ group_by(.run)[] | (map(select(.kind == "open"))|last) as $h | (.[-1]) as $l
      | ($l.ts|epoch) as $t | select($t != null)
      | (map(select((.boot|type) == "string" and (.pid|type) == "number" and .pid > 0 and .pid == (.pid|floor) and (.pstart|type) == "string"))|last) as $p
      | (if $l.kind == "doing" then ($l.until|epoch) else null end) as $u
      | (if $u == null then null else ([$u, $t + $stale * 3600]|min) end) as $ue
      | [ $t, $l.run,
          (($h.agent // "session") + " @" + ($h.profile // "?") + "/" + (($h.session // "?")[0:8])),
          $l.kind, ago($t), ($l.next // $l.act // $l.what // $h.brief // ""),
          ($ue // ""), (if $ue == null then "" else ($ue|todate) end),
          ($p.boot // ""), ($p.pid // ""), ($p.pstart // ""), ($l.act // ""), ($l.tell // "") ] ]
    | sort_by(-.[0])[] | map(flat) | join("\u001f")' 2>/dev/null \
  | while IFS=$'\037' read -r t run who kind age next ue uiso boot pid pstart act tell; do
      if [ "$kind" = end ]; then st=closed; why="ended"
      elif [ -n "$ue" ] && [ "$ue" -gt "$now" ]; then st=running; why="until $uiso"
      elif [ -n "$pid" ] && [ -n "$mine" ] && [ "$boot" = "$mine" ]; then
        if [ "$(proc_start "$pid")" = "$pstart" ]; then st=running; why="process $pid alive"
        else st=closed; why="process $pid gone"; fi
      elif [ $((now - t)) -le $((live * 60)) ]; then st=running; why="clock, heard $age"
      else st=closed; why="clock, heard $age"; fi
      printf '%s\037%s\037%s\037%s\037%s\037%s\037%s\037%s\037%s\037%s\n' \
        "$t" "$run" "$who" "$kind" "$age" "$next" "$st" "$why" "$act" "$tell"
    done
}

ROW='{ printf "  %-14s %-8s %-24s %-8s %-10s %-24s %s\n", $2, toupper($7), $8, toupper($4), $5, $3, substr($6,1,50) }'
view() { runs "$1" | awk -F'\037' "$ROW"; } # view <file> — one row per run

cmd_live() { # live [TASK]
  shopt -s nullglob; local t="${1:-}"; [ -n "$t" ] && valid_task "$t"
  local files=("$CK"/${t:-*}.jsonl) f id bad all
  [ "${#files[@]}" -gt 0 ] || { echo "(no trails)"; return 0; }
  all=$(mktemp)
  for f in "${files[@]}"; do
    id=$(basename "$f" .jsonl)
    printf '%s\n' "$id"
    runs "$f" | while IFS= read -r line; do printf '%s\037%s\n' "$id" "$line" >> "$all"; printf '%s\n' "$line"; done \
      | awk -F'\037' "$ROW"
    bad=$(badlines "$f")
    [ "$bad" -gt 0 ] && printf '  !! %s unparseable line(s) — ckpt.sh check %s\n' "$bad" "$id"
  done
  # A doing is the act a run was in when it last wrote. Its run being running
  # or closed is the whole decision: keep off it, or check its tell and resume.
  local act='{ printf "  %s %s  %s\n      act: %s\n      tell: %s\n      next: %s\n", $1, $3, $9, ($10 == "" ? "?" : $10), ($11 == "" ? "?" : $11), $7; n++ } END { if (!n) print "  none" }'
  echo
  echo "IN FLIGHT — a doing whose run is running. Keep off it unless the run is yours."
  awk -F'\037' '$5 == "doing" && $8 == "running" '"$act" "$all"
  echo
  echo "STOPPED MID-ACT — a doing whose run is closed. Its act may still be running on its own:"
  echo "  check its tell first. If it stopped, reap the run (ckpt.sh log <TASK> end --run <RUN> …), then resume."
  echo "  If you cannot tell, stop and ask."
  awk -F'\037' '$5 == "doing" && $8 == "closed" '"$act" "$all"
  rm -f "$all"
}

cmd_last() { # last <TASK>
  local t="${1:-}"; [ -n "$t" ] || die "usage: ckpt.sh last <TASK>"; valid_task "$t"
  local f; f=$(file "$t"); [ -f "$f" ] || die "no trail for $t"
  view "$f"; echo
  echo "resume from:"; records "$f" | jq -sr '.[-1] | "  \(.run): \(.next // "—")"'
}

cmd_check() { # check [TASK] — every line must parse
  shopt -s nullglob; local t="${1:-}"; [ -n "$t" ] && valid_task "$t"
  local files=("$CK"/${t:-*}.jsonl) f bad rc=0
  for f in "${files[@]}"; do
    bad=$(badlines "$f")
    printf '%-16s %4s records, %s unparseable\n' "$(basename "$f" .jsonl)" "$(records "$f" | wc -l)" "$bad"
    # The exit is the verdict on every trail, not the last test run in the loop.
    if [ "$bad" -gt 0 ]; then
      rc=1
      jq -Rr 'select(length>0) | input_line_number as $n | . as $l |
        (try (fromjson|empty) catch "  line \($n): \($l[0:90])")' "$f"
    fi
  done
  return "$rc"
}

cmd_close() { # close <TASK> [--delete] [--force]
  local task="${1:-}"; [ -n "$task" ] || die "usage: ckpt.sh close <TASK> [--delete]"; valid_task "$task"
  local f; f=$(file "$task"); [ -f "$f" ] || die "no trail for $task"
  local del=0 force=0 a
  for a in "${@:2}"; do case "$a" in --delete) del=1 ;; --force) force=1 ;; esac; done
  echo "# run digest for $task — put this in the task's Result, then the log:"
  records "$f" | jq -sr '
    group_by(.run)[] | (map(select(.kind=="open"))|last) as $h | (map(select(.kind=="end"))|last) as $e | (.[-1]) as $l |
    "- **\(.[0].run)** (\($h.agent // "session") @\($h.profile // "?")/\(($h.session // "?")[0:8])): " +
    (if $e then "\($e.changed // "?") · cost \($e.cost // "?") · left: \($e.left // "—")"
     else "NO END — last was \($l.kind) at \($l.ts): \($l.next // "?")" end)'
  echo
  local open_runs; open_runs=$(records "$f" | jq -sr 'group_by(.run)[] | select((map(select(.kind=="end"))|length)==0) | .[0].run' | tr '\n' ' ')
  if [ "$del" = 0 ]; then
    echo "# nothing deleted. Land the digest above first, then: ckpt.sh close $task --delete"
    [ -n "${open_runs// }" ] && echo "# note: these runs never ended: $open_runs"
    return 0
  fi
  if [ -n "${open_runs// }" ] && [ "$force" = 0 ]; then
    die "refusing to delete: these runs never wrote an end — $open_runs
     end or reap them first (ckpt.sh log $task end --run <ID> ...), or pass --force"
  fi
  # the trail must be IN git before it is removed from the tree, or --delete destroys it
  if [ -n "$(git -C "$ROOT" status --porcelain -- "$f" 2>/dev/null)" ]; then
    commit "$task trail, complete" "$f" || die "could not commit the trail; refusing to delete it"
  fi
  git -C "$ROOT" rm -q -- "$f" 2>/dev/null || rm -f "$f"
  # --no-verify for the same reason `commit()` uses it, and the result is CHECKED.
  # This used to be `|| true`, which swallowed a hook rejection and then printed
  # "the trail is in git" regardless — a claim the code had not verified, and the
  # removal was left staged to ride along with some later, unrelated commit.
  if git -C "$ROOT" commit -q --no-verify \
       -m "ckpt: $task compacted into the task result" -- "$f" >/dev/null 2>&1; then
    echo "deleted. The trail is in git: git log --diff-filter=D -p -- AA/checkpoints/$task.jsonl"
    # Rule 13: a finished task's environment goes with its trail. Not after
    # --force: the runs it overrode may still be running.
    if ls "$TD/done/$task"-*.md >/dev/null 2>&1; then
      if [ "$force" = 0 ]; then ( cmd_release "$task" ) || warn "the trail is retired, but $task's environment is not released: fix the above, then ckpt.sh release $task"
      else echo "not released (--force): once nothing of $task runs, ckpt.sh release $task"; fi
    fi
  else
    warn "the file is removed and STAGED, but the removal is not committed yet.
     Its contents are safe in the previous commit; commit the removal with your next one."
  fi
}

# ---- release: rule 13, closing releases what the task holds ------------------
# What a done task leaves on disk goes: its scratch folders (scratch/T###,
# t###, T###-*, t###_* …), the git worktrees in them, the branches named for
# it, and subagent worktrees that are landed, idle and unused. Before anything
# goes, what it keeps is saved: its documentation, visuals and metrics (AA.yml
# keep_kinds) and the files its `keeps:` line names. Up to keep_max_kb each,
# they are committed to AA/evidence/T###/; bigger ones are copied to the
# archive outside git (AA.yml archive:, or --archive), with size and sha256 in
# AA/evidence/T###/RELEASED.tsv.
#
# Never deleted: a folder an open task cites; work not on the main line by
# ancestry; uncommitted changes to tracked files; a locked worktree; a nested
# repository with commits no remote has; anything a running process is using;
# a trail with a live run, or one this cannot read; anything outside the
# scratch folder; a symlink's target. When one of these holds, the whole
# folder stays and the release names why.

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
human_kb() { awk -v k="$1" 'BEGIN { if (k >= 1048576) printf "%.1f GB", k/1048576; else if (k >= 1024) printf "%.0f MB", k/1024; else printf "%d KB", k }'; }
canon() { (cd "$1" 2>/dev/null && pwd -P); }
sha256() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }

# fm <file> <key> — one value from a task file's frontmatter (the block between
# the first two --- lines).
fm() { awk -v k="$2:" 'NR==1 && !/^---/ {exit} /^---/ {n++; if (n==2) exit; next} { sub(/\r$/,"") } index($0,k)==1 { v=substr($0,length(k)+1); sub(/^ +/,"",v); print v; exit }' "$1"; }

# The main line: AA.yml trunk:, else the branch origin/HEAD names, else main,
# else master. Landed means an ancestor of it; nothing weaker deletes.
trunk() {
  local t c; t=$(cfg trunk "")
  if [ -z "$t" ]; then t=$(git -C "$ROOT" symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null) && t=${t#origin/}; fi
  if [ -z "$t" ]; then for c in main master; do git -C "$ROOT" show-ref -q --verify "refs/heads/$c" && { t=$c; break; }; done; fi
  [ -n "$t" ] && git -C "$ROOT" show-ref -q --verify "refs/heads/$t" || return 1
  printf '%s' "$t"
}
TRUNK=""
landed() { [ -n "$TRUNK" ] && git -C "$ROOT" merge-base --is-ancestor "$1" "refs/heads/$TRUNK" 2>/dev/null; }
# Every commit of it is on the main line by patch (rebased, cherry-picked): named, never deleted.
patch_landed() { local c; c=$(git -C "$ROOT" cherry "refs/heads/$TRUNK" "$1" 2>/dev/null) || return 1; [ -n "$c" ] && ! printf '%s\n' "$c" | grep -q '^+'; }

# Is <name> (a folder or branch name) the task's own? T123, t123, T123-x, t123_x, t123/x.
named_for() {
  local n t; n=$(lower "$1"); t=$(lower "$2")
  case "$n" in "$t"|"$t"-*|"$t"_*|"$t"/*) return 0 ;; esac
  return 1
}

# The worktrees git knows, as path, head, branch and locked separated by \037
# (a tab would merge the empty fields of a detached or unlocked one), the main
# checkout excluded, each path resolved through symlinks when it exists.
worktrees() {
  local rroot; rroot=$(canon "$ROOT")
  git -C "$ROOT" worktree list --porcelain 2>/dev/null | awk '
    /^worktree /{ p=substr($0,10); h=""; b=""; l="" } /^HEAD /{ h=$2 } /^branch /{ b=substr($2,12) } /^locked/{ l="locked" }
    /^$/ { if (p != "") print p "\037" h "\037" b "\037" l; p="" }
    END { if (p != "") print p "\037" h "\037" b "\037" l }' \
  | while IFS=$'\037' read -r p h b l; do
      c=$(canon "$p"); [ -n "$c" ] || c=$p
      [ "$c" = "$rroot" ] || printf '%s\037%s\037%s\037%s\n' "$c" "$h" "$b" "$l"
    done
}

# Why a worktree must stay, or nothing.
worktree_holds() {
  local p="$1" h="$2" lk="${3:-}" st
  [ -z "$lk" ] || { printf 'it is locked'; return; }
  if [ -z "$h" ] || ! landed "$h"; then
    if [ -n "$h" ] && patch_landed "$h"; then printf 'its commits are on %s by patch only, not by ancestry: check, then remove it by hand' "$TRUNK"
    else printf 'its HEAD %s is not on %s' "${h:0:7}" "$TRUNK"; fi
    return
  fi
  st=$(git -C "$p" status --porcelain --untracked-files=no 2>/dev/null) || { printf 'git cannot read its status'; return; }
  [ -z "$st" ] || printf 'it has uncommitted changes to tracked files'
}

# Why a nested repository (any checkout that is not one of ours) must stay, or nothing.
nested_holds() {
  local r="$1" n st ahead; n=${1#"$(canon "$ROOT")"/}
  st=$(git -C "$r" status --porcelain --untracked-files=no 2>/dev/null) || { printf 'nested repository %s: git cannot read it' "$n"; return; }
  [ -z "$st" ] || { printf 'nested repository %s has uncommitted changes' "$n"; return; }
  [ -z "$(git -C "$r" stash list 2>/dev/null)" ] || { printf 'nested repository %s has a stash' "$n"; return; }
  [ -n "$(git -C "$r" remote 2>/dev/null)" ] || { printf 'nested repository %s has no remote' "$n"; return; }
  ahead=$(git -C "$r" rev-list -n 1 HEAD --branches --tags --not --remotes 2>/dev/null) || { printf 'nested repository %s: git cannot list its commits' "$n"; return; }
  [ -z "$ahead" ] || printf 'nested repository %s has commits no remote has (%s)' "$n" "${ahead:0:7}"
}

# Every path a running process has as its directory or holds open, resolved,
# one per line; "?" when this system cannot tell, which counts as in use.
busy_list() {
  if [ -d /proc/self/fd ]; then
    # One readlink per link: a batch stops at the first process it may not read.
    if [ -n "$(find /proc/self/cwd -maxdepth 0 -printf '%l' 2>/dev/null)" ]; then
      find /proc/[0-9]*/cwd /proc/[0-9]*/fd/ -maxdepth 1 -type l -printf '%l\n' 2>/dev/null
    else
      local l; for l in /proc/[0-9]*/cwd /proc/[0-9]*/fd/*; do readlink "$l" 2>/dev/null; done
    fi | sed 's/ (deleted)$//'
  elif command -v lsof >/dev/null 2>&1; then lsof -Fn 2>/dev/null | sed -n 's/^n//p'
  else echo "?"; fi
}
in_use() { # in_use <dir> <busy list>
  [ "$2" != "?" ] || return 0
  printf '%s\n' "$2" | awk -v d="$1" '$0==d || index($0, d "/")==1 { f=1; exit } END { exit !f }'
}

# open_cites <sdir> — each scratch folder an open task's file names, as
# `<folder>\t<TASK>`. Those folders are inputs to work not yet done.
open_cites() {
  local pat f id; pat="$(printf '%s' "$1" | sed 's/[][\.*^$]/\\&/g')/[A-Za-z0-9._-]*"
  for f in "$TD"/*.md "$DD"/backlog/*.md; do
    [ -f "$f" ] || continue
    id=$(basename "$f"); id=${id%%-*}
    grep -o -- "$pat" "$f" 2>/dev/null | sed "s|^.*/||" | sort -u | sed "s|\$|	$id|"
  done
}
held_by_open() { printf '%s\n' "$2" | awk -F'\t' -v n="$1" 'tolower($1)==tolower(n){print $2}' | sort -u | tr '\n' ' ' | sed 's/ $//'; }

# The scratch folder, normalised: inside the repository, no symlink on the way.
scratch_dir() {
  local s; s=$(cfg scratch scratch); s=${s#./}
  while [ "${s%/}" != "$s" ]; do s=${s%/}; done
  case "$s" in ""|.|/*|*..*|*//*) die "AA.yml scratch: must be a folder inside the repository, not '$s'" ;; esac
  printf '%s' "$s"
}

# The extensions a task keeps (AA.yml keep_kinds), as find arguments.
KEEP_KINDS_DEFAULT="md txt rst html pdf png svg jpg jpeg gif webp mp4 webm mkv mov json jsonl csv tsv log yaml yml"
kinds_valid() { # dies on a keep_kinds token that is not a plain extension
  local e; for e in $(cfg keep_kinds "$KEEP_KINDS_DEFAULT"); do
    case "$e" in *[!A-Za-z0-9]*) die "AA.yml keep_kinds: '$e' is not an extension; write them space-separated, e.g. keep_kinds: md png csv" ;; esac
  done
}
# Secrets never go to git: a kept file that looks like it holds one goes to the archive.
SECRET_PATTERNS='AKIA[0-9A-Z]{16}
-----BEGIN [A-Z ]*PRIVATE KEY-----
gh[pousr]_[A-Za-z0-9]{36}
github_pat_[A-Za-z0-9_]{40}
(^|[^A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20}
(^|[^A-Za-z0-9])xox[abprs]-[A-Za-z0-9-]{10}
(^|[^A-Za-z0-9_])hf_[A-Za-z0-9]{30}
AIza[0-9A-Za-z_-]{35}'
kind_args() {
  local e first=1
  for e in $(cfg keep_kinds "$KEEP_KINDS_DEFAULT"); do
    case "$e" in *[!A-Za-z0-9]*|'') continue ;; esac
    [ "$first" = 1 ] || printf '%s\n' -o
    printf '%s\n' -iname "*.$e"; first=0
  done
}
# Folders inside a task folder that are machinery, never evidence.
SKIP_DIRS="venv .venv node_modules site-packages __pycache__ .cache .pytest_cache .mypy_cache CMakeFiles .git"

# keepable <dir> <checkout tops…> — files of the kept kinds under <dir>, outside
# machinery folders, and not tracked by a checkout in it (git has those).
keepable() {
  local d="$1"; shift
  local prune=() k kinds=() t
  for k in $SKIP_DIRS; do prune+=(-name "$k" -o); done
  prune+=(-name 'build' -o -name 'build-*' -o -name 'build_*')
  while IFS= read -r k; do kinds+=("$k"); done < <(kind_args)
  [ ${#kinds[@]} -gt 0 ] || return 0
  {
    for t in "$@"; do git -C "$t" ls-files 2>/dev/null | sed "s|^|T	$t/|"; done
    find "$d" \( -type d \( "${prune[@]}" \) -prune \) -o \( -type f \( "${kinds[@]}" \) -print \) 2>/dev/null | sed 's/^/F	/'
  } | awk -F'\t' '$1=="T"{t[$2]=1; next} !($2 in t){print $2}'
}

# Refuses (dies) unless every run on the task is over and its trail reads clean.
release_live_check() {
  local task="$1" f; f=$(file "$task"); [ -f "$f" ] || return 0
  local bad; bad=$(badlines "$f"); [ "$bad" -eq 0 ] || die "refusing: $task's trail has $bad unparseable line(s) (ckpt.sh check $task)"
  local stale cutoff verdict; stale=$(stale_hours); cutoff=$(( $(date -u +%s) - stale * 3600 ))
  verdict=$(records "$f" | jq -sr --argjson c "$cutoff" '
    def ep: if type == "string" then (sub("\\.[0-9]+Z$"; "Z") | try fromdateiso8601 catch null) else null end;
    if any(.[]; (.ts | ep) == null) then "unreadable"
    else [ group_by(.run)[] | select(.[-1].kind != "end") | select((map(.ts | ep) | max) > $c) | .[0].run ] | join(" ") end') \
    || die "refusing: $task's trail cannot be read (ckpt.sh check $task)"
  [ "$verdict" != unreadable ] || die "refusing: an entry in $task's trail has no readable time (ckpt.sh check $task)"
  [ -z "$verdict" ] || die "refusing: a run on $task has not ended and wrote within stale_hours ($verdict). End it first."
  local running; running=$(runs "$f" | awk -F'\037' '$7=="running"{print $2}' | tr '\n' ' ')
  [ -z "${running// }" ] || die "refusing: a run on $task is running ($running). End it first."
  local mid; mid=$(records "$f" | jq -sr '[group_by(.run)[] | select(.[-1].kind == "doing") | .[0].run] | join(" ")') \
    || die "refusing: $task's trail cannot be read (ckpt.sh check $task)"
  [ -z "$mid" ] || die "refusing: a run on $task stopped mid-act ($mid). Check its tell (ckpt.sh live $task); once its act has stopped, reap it with ckpt.sh log $task end --run <RUN> …"
}

cmd_release() { # release <TASK> [--dry-run] [--list] [--archive DIR]
  local task="${1:-}"; [ -n "$task" ] || die "usage: ckpt.sh release <TASK> [--dry-run] [--list] [--archive DIR]"; valid_task "$task"
  shift
  local dry=0 list=0 archive; archive=$(cfg archive "")
  while [ $# -gt 0 ]; do
    case "$1" in
      --dry-run|-n) dry=1; shift ;;
      --list) list=1; shift ;;
      --archive) [ $# -ge 2 ] || die "--archive needs a folder"; archive=$2; shift 2 ;;
      *) die "unknown option: $1" ;;
    esac
  done
  local tf; tf=$(ls "$TD/done/$task"-*.md 2>/dev/null | head -1)
  [ -n "$tf" ] || die "$task is not in ${TD#"$ROOT"/}/done/: only a finished task is released"
  local rroot; rroot=$(canon "$ROOT")
  [ "$(cd "$ROOT" && canon "$(git rev-parse --git-dir)")" = "$(cd "$ROOT" && canon "$(git rev-parse --git-common-dir)")" ] \
    || die "run a release from the repository's main checkout, not a linked worktree"
  TRUNK=$(trunk) || die "no main line: set trunk: in AA.yml"
  [ "$(git -C "$ROOT" symbolic-ref -q --short HEAD)" = "$TRUNK" ] || die "check out $TRUNK first: the kept files are committed to the main line"
  local sdir; sdir=$(scratch_dir)
  local sroot="$rroot/$sdir"
  if [ -e "$ROOT/$sdir" ] && [ "$(canon "$ROOT/$sdir")" != "$sroot" ]; then die "$sdir is a symlink or under one: refusing to delete through it"; fi
  local max; max=$(cfg keep_max_kb 1024); case "$max" in ''|*[!0-9]*) max=1024 ;; esac; max=$((10#$max))
  if [ -n "$archive" ]; then
    case "$archive" in "~"|"~/"*) archive="$HOME${archive#\~}" ;; esac
    case "$archive" in /*) ;; *) die "archive: must be an absolute folder outside the repository, not '$archive'" ;; esac
    archive="$archive/$task"
    # Resolve what exists of it, so neither .. nor a symlink can point it into the repository.
    local up="$archive" rest="" real
    while [ ! -d "$up" ]; do rest="/$(basename "$up")$rest"; up=$(dirname "$up"); done
    real="$(canon "$up")$rest"
    case "$real/" in *"/../"*|*"/./"*) die "archive: write it without . or .. ($archive)" ;; esac
    case "$real/" in "$rroot"/*|"$ROOT"/*) die "archive: $archive is inside the repository" ;; esac
    archive=$real
  fi
  release_live_check "$task"
  kinds_valid
  local stale; stale=$(stale_hours)
  local task_mb; task_mb=$(cfg keep_task_mb 100); case "$task_mb" in ''|*[!0-9]*) task_mb=100 ;; esac; task_mb=$((10#$task_mb))

  local plan=() held=() rmdirs=() wts=() brs=() d p h b l why by m top
  local cites; cites=$(open_cites "$sdir")
  local busy; busy=$(busy_list)
  local wtl; wtl=$(worktrees)
  local tmp; tmp=$(mktemp -d) || die "no temporary folder"
  # shellcheck disable=SC2064 # expanded now: $tmp is local and gone by exit
  trap "rm -rf '$tmp'" EXIT
  : > "$tmp/keep"
  # 1. Its folders under scratch/.
  if [ -d "$sroot" ]; then
    for d in "$sroot"/* "$sroot"/.[!.]*; do
      [ -e "$d" ] || [ -L "$d" ] || continue
      named_for "$(basename "$d")" "$task" || continue
      by=$(held_by_open "$(basename "$d")" "$cites")
      if [ -n "$by" ]; then held+=("${d#"$rroot"/} is kept whole: open task $by cites it"); continue; fi
      if [ -L "$d" ]; then rmdirs+=("$d"); plan+=("remove the link ${d#"$rroot"/} (not what it points to)"); continue; fi
      [ -d "$d" ] || continue
      if in_use "$d" "$busy"; then held+=("${d#"$rroot"/} is kept whole: a running process is using it"); continue; fi
      if [ -n "$(git -C "$ROOT" ls-files -- "$d" 2>/dev/null | head -1)" ]; then held+=("${d#"$rroot"/} is kept whole: the repository tracks files in it"); continue; fi
      why="" ; local f_wts=() f_brs=() f_plan=() tops=()
      while IFS=$'\037' read -r p h b l; do
        [ -n "$p" ] || continue
        case "$p/" in "$d"/*) ;; *) continue ;; esac
        why=$(worktree_holds "$p" "$h" "$l")
        if [ -n "$why" ]; then why="worktree ${p#"$rroot"/}: $why"; break; fi
        f_wts+=("$p"); tops+=("$p"); f_plan+=("remove worktree ${p#"$rroot"/}${b:+ (branch $b)}")
        [ -z "$b" ] || f_brs+=("$b")
      done <<< "$wtl"
      if [ -z "$why" ]; then
        # Every checkout in the folder must be accounted for: one of ours, checked, or a nested repository with nothing unpushed.
        while IFS= read -r m; do
          [ -n "$m" ] || continue
          top=$(canon "$(dirname "$m")"); [ -n "$top" ] || { why="cannot resolve ${m#"$rroot"/}"; break; }
          case " ${tops[*]-} " in *" $top "*) continue ;; esac
          why=$(nested_holds "$top"); [ -z "$why" ] || break
          tops+=("$top")
        done < <(find "$d" -name .git -prune -print 2>/dev/null)
      fi
      if [ -z "$why" ]; then
        # A bare repository has no .git: its HEAD, objects/ and refs/ give it away.
        while IFS= read -r m; do
          top=$(dirname "$m")
          if [ -d "$top/objects" ] && [ -d "$top/refs" ]; then why="bare repository ${top#"$rroot"/}: what was pushed to it may be nowhere else"; break; fi
        done < <(find "$d" -name .git -prune -o -type f -name HEAD -print 2>/dev/null)
      fi
      if [ -n "$why" ]; then held+=("$why" "${d#"$rroot"/} is kept whole"); continue; fi
      keepable "$d" ${tops[@]+"${tops[@]}"} >> "$tmp/keep" || { held+=("${d#"$rroot"/}: cannot list what it keeps; kept whole"); continue; }
      wts+=(${f_wts[@]+"${f_wts[@]}"}); brs+=(${f_brs[@]+"${f_brs[@]}"}); plan+=(${f_plan[@]+"${f_plan[@]}"})
      rmdirs+=("$d"); plan+=("delete ${d#"$rroot"/} ($(human_kb "$(du -sk "$d" 2>/dev/null | cut -f1)"))")
    done
  fi
  # 2. Branches named for it: landed by ancestry, and checked out nowhere that stays.
  while read -r b; do
    [ -n "$b" ] && [ "$b" != "$TRUNK" ] || continue
    named_for "$b" "$task" || continue
    case " ${brs[*]-} " in *" $b "*) continue ;; esac
    p=$(printf '%s\n' "$wtl" | awk -F'\037' -v b="$b" '$3==b{print $1; exit}')
    if [ -n "$p" ]; then held+=("branch $b is checked out in ${p#"$rroot"/}, which stays"); continue; fi
    if landed "$b"; then brs+=("$b"); plan+=("delete merged branch $b")
    elif patch_landed "$b"; then held+=("branch $b is on $TRUNK by patch only, not by ancestry: check, then git branch -D $b")
    else held+=("branch $b has commits not on $TRUNK"); fi
  done < <(git -C "$ROOT" for-each-ref --format='%(refname:short)' refs/heads)
  # 3. Subagent worktrees, whichever task spawned them: landed, no checkout of
  #    their own inside, untouched for stale_hours, and no process using them.
  while IFS=$'\037' read -r p h b l; do
    [ -n "$p" ] || continue
    case "$p" in "$rroot"/.claude/worktrees/*) ;; *) continue ;; esac
    case " ${wts[*]-} " in *" $p "*) continue ;; esac
    [ -z "$(worktree_holds "$p" "$h" "$l")" ] || continue
    [ -z "$(find "$p" -mindepth 2 -name .git -print -quit 2>/dev/null)" ] || continue
    [ -z "$(find "$p" -mmin "-$((stale * 60))" -print -quit 2>/dev/null)" ] || continue
    in_use "$p" "$busy" && continue
    # Untracked work git does not ignore, outside builds and caches, was never landed: it stays.
    m=$(git -C "$p" status --porcelain --untracked-files=all 2>/dev/null | sed -n 's/^?? //p' | awk -v skip="$SKIP_DIRS" '
      BEGIN { n = split(skip, s, " "); for (i = 1; i <= n; i++) k[s[i]] = 1 }
      { c = split($0, q, "/"); bad = 0; for (i = 1; i < c; i++) if ((q[i] in k) || q[i] ~ /^build/) bad = 1; if (!bad) { print; exit } }')
    if [ -n "$m" ]; then held+=("subagent worktree ${p#"$rroot"/} has untracked work ($m): commit it or remove the worktree by hand"); continue; fi
    wts+=("$p"); plan+=("remove landed subagent worktree ${p#"$rroot"/} ($(human_kb "$(du -sk "$p" 2>/dev/null | cut -f1)"))${b:+, branch $b}")
    [ -z "$b" ] || brs+=("$b")
  done <<< "$wtl"

  # 4. What it keeps: the kept kinds in the folders that go, and its keeps: line.
  local keeps k; keeps=$(fm "$tf" keeps | tr -d '[]"' | tr ',' '\n' | sed 's/^ *//; s/ *$//' | grep -v '^$' || true)
  while read -r k; do
    [ -n "$k" ] || continue
    case "$k" in /*|*..*) die "keeps: $k must be a path inside the repository" ;; esac
    if [ ! -e "$ROOT/$k" ] && [ -f "$DD/evidence/$task/${k#"$sdir"/}" ]; then continue; fi
    [ -f "$ROOT/$k" ] && [ ! -L "$ROOT/$k" ] || die "keeps: $k is not a file here"
    printf '%s\n' "$rroot/$k" >> "$tmp/keep"
  done <<< "$keeps"
  # And every file the task's own file cites inside the folders that go: a
  # Result's script or table is evidence, whatever its kind.
  local c pat; pat="$(printf '%s' "$sdir" | sed 's/[][\.*^$]/\\&/g')/[A-Za-z0-9._/-]*"
  while IFS= read -r c; do
    c=${c%[.,;:]}; case "$c" in *..*) continue ;; esac
    [ -f "$rroot/$c" ] && [ ! -L "$rroot/$c" ] || continue
    for d in ${rmdirs[@]+"${rmdirs[@]}"}; do case "$rroot/$c" in "$d"/*) printf '%s\n' "$rroot/$c" >> "$tmp/keep"; break ;; esac; done
  done < <(grep -o -- "$pat" "$tf" 2>/dev/null | sort -u)
  local ev="$DD/evidence/$task" src rel bytes n_git=0 kb_git=0 n_arc=0 kb_arc=0
  : > "$tmp/git"; : > "$tmp/arc"
  sort -u "$tmp/keep" | while IFS= read -r src; do
    rel=${src#"$rroot"/}; rel=${rel#"$sdir"/}
    bytes=$(wc -c < "$src" | tr -d ' ')
    if [ "$bytes" -le $((max * 1024)) ]; then printf '%s\t%s\t%s\n' "$src" "$rel" "$bytes" >> "$tmp/git"
    else printf '%s\t%s\t%s\n' "$src" "$rel" "$bytes" >> "$tmp/arc"; fi
  done
  # A kept file that looks like it holds a secret goes to the archive, never to git.
  if [ -s "$tmp/git" ]; then
    cut -f1 "$tmp/git" | tr '\n' '\0' | xargs -0 grep -lIE -e "$(printf '%s' "$SECRET_PATTERNS" | paste -sd'|' -)" -- 2>/dev/null > "$tmp/secret" || true
    if [ -s "$tmp/secret" ]; then
      awk -F'\t' 'NR==FNR{x[$0]=1; next} ($1 in x){print > "/dev/stderr"; next} {print}' "$tmp/secret" "$tmp/git" 2>> "$tmp/arc" > "$tmp/git2" && mv "$tmp/git2" "$tmp/git"
      plan+=("$(wc -l < "$tmp/secret" | tr -d ' ') kept file(s) look like they hold a secret: archived, not committed")
    fi
  fi
  n_git=$(wc -l < "$tmp/git" | tr -d ' '); kb_git=$(awk -F'\t' '{s+=$3} END{printf "%d", (s+1023)/1024}' "$tmp/git")
  n_arc=$(wc -l < "$tmp/arc" | tr -d ' '); kb_arc=$(awk -F'\t' '{s+=$3} END{printf "%d", (s+1023)/1024}' "$tmp/arc")
  if [ "$kb_git" -gt $((task_mb * 1024)) ]; then
    local over="the kept files come to $(human_kb "$kb_git"), over keep_task_mb ($task_mb) for one task: raise it in AA.yml, or narrow keep_kinds (--list shows them)"
    [ "$dry" = 1 ] || die "$over"
    held+=("$over")
  fi
  if [ "$n_arc" -gt 0 ] && [ -z "$archive" ]; then
    local noarc="$n_arc kept file(s), $(human_kb "$kb_arc"), are over keep_max_kb ($max) and there is no archive: set archive: in AA.yml or pass --archive DIR (--list shows them)"
    [ "$dry" = 1 ] || die "$noarc"
    held+=("$noarc"); n_arc=0
  fi
  [ "$n_git" -eq 0 ] || plan=("keep $n_git file(s), $(human_kb "$kb_git"), in ${ev#"$ROOT"/}/" ${plan[@]+"${plan[@]}"})
  [ "$n_arc" -eq 0 ] || plan=("archive $n_arc bigger file(s), $(human_kb "$kb_arc"), to $archive/ (size and sha256 in ${ev#"$ROOT"/}/RELEASED.tsv)" ${plan[@]+"${plan[@]}"})

  if [ ${#plan[@]} -eq 0 ] && [ ${#held[@]} -eq 0 ]; then echo "$task holds nothing on disk."; return 0; fi
  [ ${#plan[@]} -eq 0 ] || printf -- '- %s\n' "${plan[@]}"
  [ ${#held[@]} -eq 0 ] || printf -- '- KEPT: %s\n' "${held[@]}"
  if [ "$list" = 1 ]; then
    awk -F'\t' -v e="${ev#"$ROOT"/}" '{print "  git      " e "/" $2}' "$tmp/git"
    awk -F'\t' -v a="$archive" '{print "  archive  " a "/" $2}' "$tmp/arc"
  fi
  [ "$dry" = 0 ] || { echo "(dry run: nothing changed)"; return 0; }
  [ ${#plan[@]} -gt 0 ] || { echo "nothing to release; the above stays."; return 0; }

  # 5. Kept files first, checked; if any step fails, nothing is deleted.
  local dst sum got
  while IFS=$'\t' read -r src rel bytes; do
    dst="$ev/$rel"; mkdir -p "$(dirname "$dst")" && cp -p "$src" "$dst" || die "could not copy ${src#"$rroot"/}; nothing deleted"
  done < "$tmp/git"
  if [ "$n_arc" -gt 0 ]; then
    mkdir -p "$ev" "$archive" || die "could not make $archive; nothing deleted"
    [ -f "$ev/RELEASED.tsv" ] || printf 'path\tbytes\tsha256\tarchived to\n' > "$ev/RELEASED.tsv"
    while IFS=$'\t' read -r src rel bytes; do
      dst="$archive/$rel"; mkdir -p "$(dirname "$dst")" && cp -p "$src" "$dst" || die "could not archive ${src#"$rroot"/}; nothing deleted"
      sum=$(sha256 "$src"); got=$(sha256 "$dst")
      [ -n "$sum" ] && [ "$sum" = "$got" ] || die "the archived copy of ${src#"$rroot"/} does not match; nothing deleted"
      grep -qF "${src#"$rroot"/}	$bytes	$sum	" "$ev/RELEASED.tsv" || printf '%s\t%s\t%s\t%s\n' "${src#"$rroot"/}" "$bytes" "$sum" "$dst" >> "$ev/RELEASED.tsv"
    done < "$tmp/arc"
  fi
  if [ -d "$ev" ]; then
    git -C "$ROOT" add -f -- "$ev" || die "could not stage ${ev#"$ROOT"/}; nothing deleted"
    if ! git -C "$ROOT" diff --cached --quiet -- "$ev"; then
      git -C "$ROOT" commit -q --no-verify -m "evidence: $task's kept files, before its environment is released" -- "$ev" \
        || die "could not commit ${ev#"$ROOT"/}; nothing deleted"
    fi
    # Each kept file is in the commit, as it is on disk.
    while IFS=$'\t' read -r src rel bytes; do
      git -C "$ROOT" ls-files --error-unmatch -- "$ev/$rel" >/dev/null 2>&1 && git -C "$ROOT" diff --quiet HEAD -- "$ev/$rel" \
        || die "${ev#"$ROOT"/}/$rel is not committed as it is; nothing deleted"
    done < "$tmp/git"
  fi
  # 6. Worktrees, then folders (none with a worktree still registered in it), then branches.
  for p in ${wts[@]+"${wts[@]}"}; do git -C "$ROOT" worktree remove --force "$p" 2>/dev/null || warn "could not remove worktree ${p#"$rroot"/}; its folder stays"; done
  wtl=$(worktrees)
  for d in ${rmdirs[@]+"${rmdirs[@]}"}; do
    case "$d" in "$sroot"/?*) ;; *) die "refusing to delete $d: not under $sroot" ;; esac
    if [ -L "$d" ]; then rm -f -- "$d"; continue; fi
    if printf '%s\n' "$wtl" | awk -F'\037' -v d="$d" 'index($1"/", d"/")==1{f=1} END{exit !f}'; then warn "kept ${d#"$rroot"/}: a worktree in it is still registered"; continue; fi
    rm -rf -- "$d"
  done
  git -C "$ROOT" worktree prune 2>/dev/null
  for b in ${brs[@]+"${brs[@]}"}; do
    landed "$b" && git -C "$ROOT" branch -q -D "$b" 2>/dev/null || warn "kept branch $b"
  done
  echo "released."
}

# What finished tasks still hold, without sizes (cheap enough for --check):
# one line per item, `<TASK>\t<path or branch>`, and `-\t<path>` for a landed,
# idle subagent worktree, which no task owns by name.
litter_scan() {
  local sdir; sdir=$(scratch_dir 2>/dev/null) || return 0
  TRUNK=$(trunk) || return 0
  local rroot; rroot=$(canon "$ROOT")
  local done_ids; done_ids=$(ls "$TD/done" 2>/dev/null | sed -n 's/^\([A-Za-z0-9._]*\)-.*\.md$/\1/p' | sort -u)
  [ -n "$done_ids" ] || return 0
  local up; up=$(printf '%s\n' "$done_ids" | tr '[:lower:]' '[:upper:]')
  local d n id cites wtl busy; cites=$(open_cites "$sdir"); wtl=$(worktrees); busy=$(busy_list)
  if [ -d "$ROOT/$sdir" ] && [ ! -L "$ROOT/$sdir" ]; then
    for d in "$ROOT/$sdir"/*; do
      [ -e "$d" ] || [ -L "$d" ] || continue
      n=$(basename "$d" | tr '[:lower:]' '[:upper:]'); id=${n%%[-_/]*}
      printf '%s\n' "$up" | grep -qxF -- "$id" || continue
      [ -z "$(held_by_open "$(basename "$d")" "$cites")" ] || continue
      printf '%s\t%s\n' "$(printf '%s\n' "$done_ids" | awk -v u="$id" 'toupper($0)==u{print; exit}')" "${d#"$ROOT"/}"
    done
  fi
  local b p h l
  while read -r b; do
    [ -n "$b" ] && [ "$b" != "$TRUNK" ] || continue
    n=$(printf '%s' "$b" | tr '[:lower:]' '[:upper:]'); id=${n%%[-_/]*}
    printf '%s\n' "$up" | grep -qxF -- "$id" || continue
    [ -z "$(printf '%s\n' "$wtl" | awk -F'\037' -v b="$b" '$3==b{print; exit}')" ] || continue
    landed "$b" && printf '%s\tbranch %s\n' "$(printf '%s\n' "$done_ids" | awk -v u="$id" 'toupper($0)==u{print; exit}')" "$b"
  done < <(git -C "$ROOT" for-each-ref --format='%(refname:short)' refs/heads)
  local stale; stale=$(stale_hours)
  while IFS=$'\037' read -r p h b l; do
    [ -n "$p" ] || continue
    case "$p" in "$rroot"/.claude/worktrees/*) ;; *) continue ;; esac
    [ -z "$(worktree_holds "$p" "$h" "$l")" ] || continue
    [ -z "$(find "$p" -mindepth 2 -name .git -print -quit 2>/dev/null)" ] || continue
    [ -z "$(find "$p" -mmin "-$((stale * 60))" -print -quit 2>/dev/null)" ] || continue
    in_use "$p" "$busy" && continue
    printf -- '-\t%s\n' "${p#"$rroot"/}"
  done <<< "$wtl"
}

# Sourced by board.sh for the helpers above; only dispatch when run directly.
(return 0 2>/dev/null) && return 0

case "${1:-}" in
  open)  shift; cmd_open  "$@" ;;
  log)   shift; cmd_log   "$@" ;;
  live)  shift; cmd_live  "$@" ;;
  last)  shift; cmd_last  "$@" ;;
  check) shift; cmd_check "$@" ;;
  close) shift; cmd_close "$@" ;;
  release) shift; cmd_release "$@" ;;
  board) shift; exec "$DD/board.sh" "$@" ;;
  *) cat >&2 <<'USAGE'
ckpt.sh — AA checkpoints. One JSONL file per task, one line per event.

  ckpt.sh open  <TASK> --brief "..." [--agent LABEL] [--budget "..."] [--no-commit]
        prints the RUN id. --agent opens a run for a subagent you are about to spawn.
  ckpt.sh log   <TASK> <did|doing|blocked|end> [--run ID] [--key "value"]... [--commit "one line"]
        a doing that may run silent for long: --for 90m|2h|1d (or --until <UTC time>)
  ckpt.sh live  [TASK]              every run, running or closed and why; every doing, in flight or stopped
  ckpt.sh last  <TASK>              the resume point
  ckpt.sh check [TASK]              every line parses?
  ckpt.sh close <TASK> [--delete]   digest for the Result; --delete retires the trail, then releases
  ckpt.sh release <TASK> [--dry-run] [--list] [--archive DIR]
                                    a done task's scratch folders, worktrees and branches go (rule 13);
                                    its docs, visuals and metrics (keep_kinds) and keeps: files are
                                    committed to AA/evidence/<TASK>/ first, bigger ones archived
  ckpt.sh board ...                 -> AA/board.sh

doing BEFORE the act, did after it, end whenever you stop. Every entry carries --next.
USAGE
     exit 1 ;;
esac
