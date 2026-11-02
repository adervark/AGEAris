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
    # Rule 13: a finished task's environment goes with its trail.
    if ls "$TD/done/$task"-*.md >/dev/null 2>&1; then cmd_release "$task"; fi
  else
    warn "the file is removed and STAGED, but the removal is not committed yet.
     Its contents are safe in the previous commit; commit the removal with your next one."
  fi
}

# ---- release: rule 13, closing releases what the task holds ------------------
# What a done task leaves on disk goes: its scratch folder (scratch/T###, or
# t###, T###-*, t###_* …), the git worktrees in it, the branches named for it,
# and subagent worktrees that are landed and idle. The files its `keeps:` line
# names move to AA/evidence/T###/ and are committed BEFORE anything is
# deleted. Never deleted: work not on the main line, uncommitted changes to
# tracked files, a nested repository with commits no remote has, anything
# outside the repository, a symlink's target.

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
# fm <file> <key> — one value from a task file's frontmatter (the block between
# the first two --- lines), with any trailing comment kept as written.
fm() { awk -v k="$2:" 'NR==1 && !/^---/ {exit} /^---/ {n++; if (n==2) exit; next} { sub(/\r$/,"") } index($0,k)==1 { v=substr($0,length(k)+1); sub(/^ +/,"",v); print v; exit }' "$1"; }
human_kb() { awk -v k="$1" 'BEGIN { if (k >= 1048576) printf "%.1f GB", k/1048576; else if (k >= 1024) printf "%.0f MB", k/1024; else printf "%d KB", k }'; }

# The main line: the branch the repository's own checkout is on.
trunk() { git -C "$ROOT" symbolic-ref -q --short HEAD; }
# Landed: on the main line, or every commit of it is there by patch (rebased, cherry-picked).
landed() {
  git -C "$ROOT" merge-base --is-ancestor "$1" HEAD 2>/dev/null && return 0
  local c; c=$(git -C "$ROOT" cherry HEAD "$1" 2>/dev/null) || return 1
  [ -n "$c" ] && ! printf '%s\n' "$c" | grep -q '^+'
}

# Is <name> (a folder or branch name) the task's own? T123, t123, T123-x, t123_x, t123/x.
named_for() {
  local n t; n=$(lower "$1"); t=$(lower "$2")
  case "$n" in "$t"|"$t"-*|"$t"_*|"$t"/*) return 0 ;; esac
  return 1
}

# The worktrees git knows, as path<TAB>head<TAB>branch, the main checkout excluded.
worktrees() {
  git -C "$ROOT" worktree list --porcelain 2>/dev/null | awk -v root="$ROOT" '
    /^worktree /{ p=substr($0,10); h=""; b="" } /^HEAD /{ h=$2 } /^branch /{ b=substr($2,12) }
    /^$/ { if (p != "" && p != root) print p "\t" h "\t" b; p="" }
    END { if (p != "" && p != root) print p "\t" h "\t" b }'
}

# Why a worktree must stay, or nothing: commits not landed, or tracked changes.
worktree_holds() {
  local p="$1" h="$2"
  landed "$h" || { printf 'its HEAD %s is not on %s' "${h:0:7}" "$(trunk)"; return; }
  [ -z "$(git -C "$p" status --porcelain --untracked-files=no 2>/dev/null)" ] || printf 'it has uncommitted changes to tracked files'
}

# Why a nested repository (a .git folder, not a worktree) must stay, or nothing.
nested_holds() {
  local r="$1" b
  [ -z "$(git -C "$r" status --porcelain --untracked-files=no 2>/dev/null)" ] || { printf 'nested repository %s has uncommitted changes' "${r#"$ROOT"/}"; return; }
  [ -z "$(git -C "$r" stash list 2>/dev/null)" ] || { printf 'nested repository %s has a stash' "${r#"$ROOT"/}"; return; }
  while read -r b; do
    [ -n "$b" ] || continue
    [ -n "$(git -C "$r" branch -r --contains "$b" 2>/dev/null)" ] || { printf 'nested repository %s: branch %s is on no remote' "${r#"$ROOT"/}" "$b"; return; }
  done < <(git -C "$r" for-each-ref --format='%(refname:short)' refs/heads 2>/dev/null)
}

cmd_release() { # release <TASK> [--dry-run]
  local task="${1:-}"; [ -n "$task" ] || die "usage: ckpt.sh release <TASK> [--dry-run]"; valid_task "$task"
  local dry=0 a; for a in "${@:2}"; do case "$a" in --dry-run|-n) dry=1 ;; *) die "unknown option: $a" ;; esac; done
  local tf; tf=$(ls "$TD/done/$task"-*.md 2>/dev/null | head -1)
  [ -n "$tf" ] || die "$task is not in ${TD#"$ROOT"/}/done/: only a finished task is released"
  local main; main=$(trunk) || die "HEAD is detached: check out the main line before a release"
  local sdir; sdir=$(cfg scratch scratch)
  case "$sdir" in ""|/*|*..*) die "AA.yml scratch: must be a folder inside the repository, not '$sdir'" ;; esac
  local sroot="$ROOT/$sdir" stale; stale=$(cfg stale_hours 24)
  case "$stale" in ''|*[!0-9]*) stale=24 ;; esac

  # A run on the task that is still alive keeps everything where it is.
  local f; f=$(file "$task")
  if [ -f "$f" ]; then
    local cutoff; cutoff=$(( $(date -u +%s) - stale * 3600 ))
    local alive; alive=$(records "$f" | jq -sr --argjson c "$cutoff" '
      group_by(.run)[] | select((map(select(.kind=="end"))|length)==0)
      | select((.[-1].ts | sub("\\.[0-9]+Z$";"Z") | fromdateiso8601) > $c) | .[0].run' 2>/dev/null | tr '\n' ' ')
    [ -z "${alive// }" ] || die "refusing: a run on $task is live ($alive). End it first."
  fi

  local plan=() held=() rmdirs=() wts=() brs=() kept=() d p h b why
  # Its folders under scratch/.
  if [ -d "$sroot" ] && [ ! -L "$sroot" ]; then
    for d in "$sroot"/* "$sroot"/.[!.]*; do
      [ -e "$d" ] || [ -L "$d" ] || continue
      named_for "$(basename "$d")" "$task" || continue
      if [ -L "$d" ]; then rmdirs+=("$d"); plan+=("remove the link ${d#"$ROOT"/} (not what it points to)"); continue; fi
      [ -d "$d" ] || continue
      why=""
      while IFS=$'\t' read -r p h b; do
        case "$p/" in "$d"/*) ;; *) continue ;; esac
        why=$(worktree_holds "$p" "$h")
        if [ -n "$why" ]; then held+=("worktree ${p#"$ROOT"/}: $why"); break; fi
        wts+=("$p"); plan+=("remove worktree ${p#"$ROOT"/}${b:+ (branch $b)}")
        [ -n "$b" ] && brs+=("$b")
      done < <(worktrees)
      if [ -z "$why" ]; then
        local r
        while read -r r; do
          [ -n "$r" ] || continue
          r=${r%/.git}
          why=$(nested_holds "$r")
          if [ -n "$why" ]; then held+=("$why"); break; fi
        done < <(find "$d" -name .git -type d -prune 2>/dev/null)
      fi
      if [ -n "$why" ]; then held+=("${d#"$ROOT"/} is kept whole"); continue; fi
      rmdirs+=("$d"); plan+=("delete ${d#"$ROOT"/} ($(human_kb "$(du -sk "$d" 2>/dev/null | cut -f1)"))")
    done
  fi
  # Branches named for it, merged.
  while read -r b; do
    [ -n "$b" ] && [ "$b" != "$main" ] || continue
    named_for "$b" "$task" || continue
    case " ${brs[*]-} " in *" $b "*) continue ;; esac
    if landed "$b"; then brs+=("$b"); plan+=("delete merged branch $b")
    else held+=("branch $b has commits not on $main"); fi
  done < <(git -C "$ROOT" for-each-ref --format='%(refname:short)' refs/heads)
  # Subagent worktrees: landed, and untouched for stale_hours, whichever task spawned them.
  while IFS=$'\t' read -r p h b; do
    case "$p" in "$ROOT"/.claude/worktrees/*) ;; *) continue ;; esac
    case " ${wts[*]-} " in *" $p "*) continue ;; esac
    [ -z "$(worktree_holds "$p" "$h")" ] || continue
    [ -z "$(find "$p" -mmin "-$((stale * 60))" -print -quit 2>/dev/null)" ] || continue
    wts+=("$p"); plan+=("remove landed subagent worktree ${p#"$ROOT"/} ($(human_kb "$(du -sk "$p" 2>/dev/null | cut -f1)"))${b:+, branch $b}")
    [ -n "$b" ] && brs+=("$b")
  done < <(worktrees)

  # What it keeps: `keeps: [path, …]` in the task's frontmatter.
  local keeps max; keeps=$(fm "$tf" keeps | tr -d '[]"' | tr ',' '\n' | sed 's/^ *//; s/ *$//' | grep -v '^$' || true)
  max=$(cfg keep_max_kb 1024); case "$max" in ''|*[!0-9]*) max=1024 ;; esac
  local k size rel
  while read -r k; do
    [ -n "$k" ] || continue
    case "$k" in /*|*..*) die "keeps: $k must be a path inside the repository" ;; esac
    # Kept by an earlier release already.
    rel=${k#"$sdir"/}; rel=${rel#*/}
    if [ ! -e "$ROOT/$k" ] && [ -f "$DD/evidence/$task/$rel" ]; then continue; fi
    [ -f "$ROOT/$k" ] && [ ! -L "$ROOT/$k" ] || die "keeps: $k is not a file here"
    size=$(( ($(wc -c < "$ROOT/$k") + 1023) / 1024 ))
    [ "$size" -le "$max" ] || die "keeps: $k is $(human_kb "$size"), over keep_max_kb ($max). Record its sha256 ($(sha256sum "$ROOT/$k" 2>/dev/null | cut -c1-16 || shasum -a 256 "$ROOT/$k" | cut -c1-16)…) and how to rebuild it in the Result, and drop it from keeps:."
    kept+=("$k"); plan=("keep $k in ${DD#"$ROOT"/}/evidence/$task/" "${plan[@]}")
  done <<< "$keeps"

  if [ ${#plan[@]} -eq 0 ] && [ ${#held[@]} -eq 0 ]; then echo "$task holds nothing on disk."; return 0; fi
  [ ${#plan[@]} -gt 0 ] && printf '%s\n' "${plan[@]/#/- }"
  [ ${#held[@]} -gt 0 ] && printf '%s\n' "${held[@]/#/- KEPT: }"
  [ "$dry" = 1 ] && { echo "(dry run: nothing changed)"; return 0; }
  [ ${#plan[@]} -gt 0 ] || { echo "nothing to release; the above stays."; return 0; }

  # 1. Kept files into git, first: if this fails, nothing is deleted.
  if [ ${#kept[@]} -gt 0 ]; then
    local ev="$DD/evidence/$task"
    for k in "${kept[@]}"; do
      rel=${k#"$sdir"/}; rel=${rel#*/}
      mkdir -p "$(dirname "$ev/$rel")" && cp -p "$ROOT/$k" "$ev/$rel" || die "could not copy $k; nothing deleted"
    done
    git -C "$ROOT" add -- "$ev" && git -C "$ROOT" commit -q --no-verify -m "evidence: $task's kept files, before its environment is released" -- "$ev" \
      || die "could not commit ${ev#"$ROOT"/}; nothing deleted"
  fi
  # 2. Worktrees, then their folders, then branches (-d: git refuses an unmerged one again).
  for p in ${wts[@]+"${wts[@]}"}; do git -C "$ROOT" worktree remove --force "$p" 2>/dev/null || warn "could not remove worktree ${p#"$ROOT"/}"; done
  for d in ${rmdirs[@]+"${rmdirs[@]}"}; do
    case "$d" in "$sroot"/?*) ;; *) die "refusing to delete $d: not under $sroot" ;; esac
    if [ -L "$d" ]; then rm -f -- "$d"; else rm -rf -- "$d"; fi
  done
  git -C "$ROOT" worktree prune 2>/dev/null
  # -D: landed() has checked it, by ancestry or by patch, which `branch -d` cannot see.
  for b in ${brs[@]+"${brs[@]}"}; do landed "$b" && git -C "$ROOT" branch -q -D "$b" 2>/dev/null || warn "kept branch $b"; done
  echo "released."
}

# What finished tasks still hold, without sizes (cheap enough for --check):
# one line per item, `<TASK>\t<path or branch>`, and `-\t<path>` for a landed,
# idle subagent worktree, which no task owns by name.
litter_scan() {
  local sdir; sdir=$(cfg scratch scratch)
  local done_ids; done_ids=$(ls "$TD/done" 2>/dev/null | sed -n 's/^\([A-Za-z0-9._]*\)-.*\.md$/\1/p' | sort -u)
  [ -n "$done_ids" ] || return 0
  local up; up=$(printf '%s\n' "$done_ids" | tr '[:lower:]' '[:upper:]')
  local d n id
  if [ -d "$ROOT/$sdir" ] && [ ! -L "$ROOT/$sdir" ]; then
    for d in "$ROOT/$sdir"/*; do
      [ -e "$d" ] || [ -L "$d" ] || continue
      n=$(basename "$d" | tr '[:lower:]' '[:upper:]'); id=${n%%[-_/]*}
      printf '%s\n' "$up" | grep -qxF -- "$id" || continue
      printf '%s\t%s\n' "$(printf '%s\n' "$done_ids" | awk -v u="$id" 'toupper($0)==u{print; exit}')" "${d#"$ROOT"/}"
    done
  fi
  local b main; main=$(trunk) || return 0
  while read -r b; do
    [ -n "$b" ] && [ "$b" != "$main" ] || continue
    n=$(printf '%s' "$b" | tr '[:lower:]' '[:upper:]'); id=${n%%[-_/]*}
    printf '%s\n' "$up" | grep -qxF -- "$id" || continue
    landed "$b" && printf '%s\tbranch %s\n' "$(printf '%s\n' "$done_ids" | awk -v u="$id" 'toupper($0)==u{print; exit}')" "$b"
  done < <(git -C "$ROOT" for-each-ref --format='%(refname:short)' refs/heads)
  local p h stale; stale=$(cfg stale_hours 24); case "$stale" in ''|*[!0-9]*) stale=24 ;; esac
  while IFS=$'\t' read -r p h b; do
    case "$p" in "$ROOT"/.claude/worktrees/*) ;; *) continue ;; esac
    [ -z "$(worktree_holds "$p" "$h")" ] || continue
    [ -z "$(find "$p" -mmin "-$((stale * 60))" -print -quit 2>/dev/null)" ] || continue
    printf -- '-\t%s\n' "${p#"$ROOT"/}"
  done < <(worktrees)
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
  ckpt.sh release <TASK> [--dry-run] a done task's scratch folder, worktrees and branches go (rule 13);
                                    its keeps: files are committed to AA/evidence/<TASK>/ first
  ckpt.sh board ...                 -> AA/board.sh

doing BEFORE the act, did after it, end whenever you stop. Every entry carries --next.
USAGE
     exit 1 ;;
esac
