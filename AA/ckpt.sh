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

argify() { # --key value ... -> jq --arg pairs; also eats --commit / --run / --force
  JQARGS=(); COMMIT_MSG=""; RUN_OVERRIDE=""; AGENT=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --commit) COMMIT_MSG="${2:-}"; shift 2 ;;
      --run)    RUN_OVERRIDE="${2:-}"; shift 2 ;;
      --force|--delete|--no-commit) FLAGS="${FLAGS:-} $1"; shift ;;
      --*) k="${1#--}"; k="${k//-/_}"; [ $# -ge 2 ] || die "--$k needs a value"
           [ "$k" = agent ] && AGENT="$2"
           JQARGS+=(--arg "$k" "$2"); shift 2 ;;
      *) die "unexpected argument: $1" ;;
    esac
  done
}

emit() { # emit <file> <run> <kind>  (JQARGS already set)
  jq -cn --arg ts "$(now)" --arg run "$2" --arg kind "$3" "${JQARGS[@]}" \
     '{ts:$ts,run:$run,kind:$kind} + ($ARGS.named|del(.ts,.run,.kind))' >> "$1" \
    || die "write failed: $1"
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
      printf '%s\n' "$run"; return 0
    fi
  fi
  task_committed "$task"
  jq -cn --arg ts "$(now)" --arg run "$run" --arg kind open \
     --arg operator "$(git -C "$ROOT" config user.name 2>/dev/null)" \
     --arg profile "$(basename "${CLAUDE_CONFIG_DIR:-$HOME/.claude}" | sed 's/^\.claude-\?//; s/^$/default/')" \
     --arg session "${CLAUDE_CODE_SESSION_ID:-}" "${JQARGS[@]}" \
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
  local run="${RUN_OVERRIDE:-$(myrun)}"
  local owner; owner=$(records "$f" | jq -sr --arg r "$run" 'map(select(.run==$r and .kind=="open"))|last|.session // ""')
  [ -z "$owner" ] && warn "no open line for run $run on $task — logging anyway"
  if [ -n "$owner" ] && [ -n "${CLAUDE_CODE_SESSION_ID:-}" ] && \
     [ "$owner" != "$CLAUDE_CODE_SESSION_ID" ] && [ "$kind" != end ]; then
    warn "run $run belongs to session ${owner:0:8}, not yours — only an 'end' (reaping a dead run) belongs in someone else's run"
  fi
  emit "$f" "$run" "$kind"
  [ -n "$COMMIT_MSG" ] && commit "$COMMIT_MSG" "$f"
  return 0
}

view() { # view <files...> — one row per run: run, who, last kind, age, next
  records "$@" | jq -sr --argjson now "$(date +%s)" '
    def age($t): ($now - ($t|fromdateiso8601)) as $d
      | if $d < 90 then "just now" elif $d < 5400 then "\(($d/60)|floor)m ago"
        elif $d < 172800 then "\(($d/3600)|floor)h ago" else "\(($d/86400)|floor)d ago" end;
    group_by(.run)[] | (map(select(.kind=="open"))|last) as $h | (.[-1]) as $l |
    [ ($l.ts|fromdateiso8601), $l.run,
      (($h.agent // "session") + " @" + ($h.profile // "?") + "/" + (($h.session // "?")[0:8])),
      $l.kind, age($l.ts), ($l.next // $l.act // $l.what // $h.brief // "") ] | @tsv' 2>/dev/null \
  | sort -t'	' -k1,1nr \
  | awk -F'\t' '{printf "  %-14s %-26s %-8s %-10s %s\n", $2, $3, toupper($4), $5, substr($6,1,58)}'
}

# One trail at a time. Run ids are session-derived, so a session that works two
# tasks writes the same id into both trails; grouping every trail by run at once
# merged those runs, and a closed task's `end` hid another task's live `doing`.
# On 2026-09-14 this printed "none" with a fold queued on the card (RSNA T092).
inflight() { local f; for f in "$@"; do records "$f" | jq -sr --arg t "$(basename "$f" .jsonl)" '
    group_by(.run)[] | select(.[-1].kind == "doing") | .[-1] as $l |
    "  \($t) \($l.run)  act: \($l.act // "?")\n      tell: \($l.tell // "?")\n      next: \($l.next // "?")"' 2>/dev/null; done; }

cmd_live() { # live [TASK]
  shopt -s nullglob; local t="${1:-}"; [ -n "$t" ] && valid_task "$t"
  local files=("$CK"/${t:-*}.jsonl) f
  [ "${#files[@]}" -gt 0 ] || { echo "(no trails)"; return 0; }
  for f in "${files[@]}"; do
    printf '%s\n' "$(basename "$f" .jsonl)"
    view "$f"
    local bad; bad=$(badlines "$f")
    [ "$bad" -gt 0 ] && printf '  !! %s unparseable line(s) — ckpt.sh check %s\n' "$bad" "$(basename "$f" .jsonl)"
  done
  echo
  echo "IN FLIGHT (a doing that nothing has closed — check this before you spend):"
  inflight "${files[@]}" | grep . || echo "  none"
}

cmd_last() { # last <TASK>
  local t="${1:-}"; [ -n "$t" ] || die "usage: ckpt.sh last <TASK>"; valid_task "$t"
  local f; f=$(file "$t"); [ -f "$f" ] || die "no trail for $t"
  view "$f"; echo
  echo "resume from:"; records "$f" | jq -sr '.[-1] | "  \(.run): \(.next // "—")"'
}

cmd_check() { # check [TASK] — every line must parse
  shopt -s nullglob; local t="${1:-}"; [ -n "$t" ] && valid_task "$t"
  local files=("$CK"/${t:-*}.jsonl) f bad
  for f in "${files[@]}"; do
    bad=$(badlines "$f")
    printf '%-16s %4s records, %s unparseable\n' "$(basename "$f" .jsonl)" "$(records "$f" | wc -l)" "$bad"
    [ "$bad" -gt 0 ] && jq -Rr 'select(length>0) | input_line_number as $n | . as $l |
      (try (fromjson|empty) catch "  line \($n): \($l[0:90])")' "$f"
  done
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
  else
    warn "the file is removed and STAGED, but the removal is not committed yet.
     Its contents are safe in the previous commit; commit the removal with your next one."
  fi
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
  board) shift; exec "$DD/board.sh" "$@" ;;
  *) cat >&2 <<'USAGE'
ckpt.sh — AA checkpoints. One JSONL file per task, one line per event.

  ckpt.sh open  <TASK> --brief "..." [--agent LABEL] [--budget "..."] [--no-commit]
        prints the RUN id. --agent opens a run for a subagent you are about to spawn.
  ckpt.sh log   <TASK> <did|doing|blocked|end> [--run ID] [--key "value"]... [--commit "one line"]
  ckpt.sh live  [TASK]              every run, its age, and what is in flight now
  ckpt.sh last  <TASK>              the resume point
  ckpt.sh check [TASK]              every line parses?
  ckpt.sh close <TASK> [--delete]   digest for the Result; --delete retires the trail
  ckpt.sh board ...                 -> AA/board.sh

doing BEFORE the act, did after it, end whenever you stop. Every entry carries --next.
USAGE
     exit 1 ;;
esac
