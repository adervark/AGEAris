#!/usr/bin/env bash
# /aa — pull up this project's AA board, and its page in AGE Aris.
#
#   aa.sh            print the board, then the AGE Aris sign-in link (starting
#                    AGE Aris if it is not running, and restarting it if its
#                    code has changed since it started)
#   aa.sh --open     the same, and open the link in the browser
#   aa.sh --link     track this repository in AGE Aris first, if it is not
#
# Read-only on the repository: it runs `board.sh` without arguments, which
# prints and writes nothing, and reads task files. It writes only what AGE Aris
# itself writes when it starts or links a repository, all of it in its data
# folder, and the server's log.
#
# The link carries the API token, so it signs in any browser, one that never
# has included. The token is no barrier against processes running as the
# operator (server.mjs), and the server prints the same link to its log.
#
# AGESIGHT_DATA_DIR  the data folder           (default ~/.agesight-data)
# AGEARIS_PORT       the port AGE Aris uses    (default 4310)
# AGEARIS_HOME       the AGE Aris checkout     (default: the one this script
#                    is in, else ~/Code/AGEAris)
set -uo pipefail

OPEN=0 LINK=0
for arg in "$@"; do
  case "$arg" in
    --open|open) OPEN=1 ;;
    --link|link) LINK=1 ;;
    *) printf 'aa: unknown argument %s (use --open or --link)\n' "$arg" >&2; exit 2 ;;
  esac
done

# What /aa needs, checked together before anything runs: each missing tool is
# named once, with the line that installs it, rather than surfacing later as a
# failure that does not say what is wrong.
OS=$(uname -s)
case "$OS" in
  MINGW*|MSYS*|CYGWIN*) echo "On Windows, AGE Aris runs inside WSL: run Claude Code there, and install the plugin there."; exit 1 ;;
esac
tools=()
# Run, not looked up: on a Mac without its developer tools, /usr/bin/git is a
# stub that only offers to install them.
for tool in git jq curl; do "$tool" --version >/dev/null 2>&1 || tools+=("$tool"); done
node_v=$(node --version 2>/dev/null)
node_major=${node_v#v}
node_major=${node_major%%.*}
case "$node_major" in ''|*[!0-9]*) node_major=0 ;; esac
if [ "${#tools[@]}" -gt 0 ] || [ "$node_major" -lt 22 ]; then
  printf 'AGE Aris needs these, and this machine does not have them:\n\n'
  [ "${#tools[@]}" -eq 0 ] || printf '  - %s\n' "${tools[@]}"
  [ "$node_major" -ge 22 ] || printf '  - Node 22 or newer%s\n' "${node_v:+ (this machine has $node_v)}"
  printf '\nInstall them, then run /aa again:\n\n'
  if [ "${#tools[@]}" -gt 0 ]; then
    if [ "$OS" = Darwin ]; then
      printf '  brew install %s\n' "${tools[*]}"
      command -v brew >/dev/null || printf '  (Homebrew itself: https://brew.sh)\n'
    elif command -v apt-get >/dev/null; then printf '  sudo apt-get install -y %s\n' "${tools[*]}"
    elif command -v dnf >/dev/null; then printf '  sudo dnf install -y %s\n' "${tools[*]}"
    elif command -v pacman >/dev/null; then printf '  sudo pacman -S --needed %s\n' "${tools[*]}"
    else printf '  %s, with your package manager\n' "${tools[*]}"
    fi
  fi
  [ "$node_major" -ge 22 ] || printf '  Node 22 or newer: https://nodejs.org/en/download\n'
  exit 1
fi

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || ROOT=$PWD
ROOT=$(realpath "$ROOT")
NAME=$(basename "$ROOT")

# The board folder, chosen as AGE Aris chooses it (lib/workspace.mjs findBoard):
# the first of AA/, deaddrop/ and pm/ that is in use, else the first with tasks/.
in_use() {
  local d="$ROOT/$1"
  [ -f "$d/STATE.md" ] || [ -f "$d/AA.yml" ] || [ -f "$d/deaddrop.yml" ] && return 0
  compgen -G "$d/tasks/T[0-9][0-9][0-9]*-*.md" >/dev/null || compgen -G "$d/backlog/T[0-9][0-9][0-9]*-*.md" >/dev/null \
    || compgen -G "$d/tasks/done/T[0-9][0-9][0-9]*-*.md" >/dev/null
}
BOARD=""
for b in AA deaddrop pm; do
  [ -d "$ROOT/$b/tasks" ] && [ ! -L "$ROOT/$b" ] && [ ! -L "$ROOT/$b/tasks" ] || continue
  if in_use "$b"; then BOARD=$b; break; fi
  [ -n "$BOARD" ] || BOARD=$b
done

# One frontmatter value, unquoted: `key: value` between the first two `---`.
field() {
  awk -v k="$2" 'NR == 1 && $0 != "---" { exit } NR > 1 && $0 == "---" { exit }
    NR > 1 && index($0, k ": ") == 1 { v = substr($0, length(k) + 3); gsub(/^"|"$/, "", v); print v; exit }' "$1"
}
clip() { local s="$1" n="$2"; [ "${#s}" -gt "$n" ] && s="${s:0:$((n - 1))}…"; printf '%s' "$s"; }

if [ -z "$BOARD" ]; then
  printf '%s has no AA board (no AA/tasks/, deaddrop/tasks/ or pm/tasks/). The aa-init skill makes one.\n' "$NAME"
else
  B="$ROOT/$BOARD"
  # The hand-written NOW block, where the board has one.
  if [ -f "$B/STATE.md" ] && grep -q "<!-- $BOARD:now -->" "$B/STATE.md"; then
    sed -n "/<!-- $BOARD:now -->/,/<!-- \/$BOARD:now -->/p" "$B/STATE.md" | sed '1d;$d'
    echo
  fi
  if [ -x "$B/board.sh" ]; then
    (cd "$ROOT" && "$B/board.sh" 2>&1)
  else
    # An older board with no board.sh: list the work from the task files. Where
    # backlog/ is missing, unclaimed work waits in tasks/ marked open.
    printf '`%s/` · no board.sh, so this is read from the task files · the narrative is in %s/STATE.md\n\n' "$BOARD" "$BOARD"
    active=() waiting=()
    for f in "$B"/tasks/T[0-9][0-9][0-9]*-*.md; do
      [ -f "$f" ] && [ ! -L "$f" ] || continue
      id=$(basename "$f" | cut -d- -f1)
      status=$(field "$f" status | tr 'A-Z' 'a-z' | sed 's/^[^a-z]*//')
      title=$(clip "$(field "$f" title)" 70)
      owner=$(field "$f" owner | sed 's/ — .*//; s/ -- .*//')
      word=${status%%[!a-z]*}
      case "$word" in
        open|unclaimed|todo|backlog|"") [ -d "$B/backlog" ] && active+=("| $id | $title | ${status:-—} | $owner |") || waiting+=("$id") ;;
        *) active+=("| $id | $title | $(clip "$status" 30) | $(clip "$owner" 40) |") ;;
      esac
    done
    backlog=$(compgen -G "$B/backlog/T[0-9][0-9][0-9]*-*.md" | wc -l)
    done_n=$(compgen -G "$B/tasks/done/T[0-9][0-9][0-9]*-*.md" | wc -l)
    printf 'IN PROGRESS / BLOCKED %d · WAITING %d · DONE %d\n\n' "${#active[@]}" $(( ${#waiting[@]} + backlog )) "$done_n"
    if [ "${#active[@]}" -gt 0 ]; then
      printf '| id | task | status | owner |\n|---|---|---|---|\n'
      printf '%s\n' "${active[@]}"
    fi
    [ "${#waiting[@]}" -gt 0 ] && printf '\nwaiting: %s\n' "${waiting[*]}"
  fi
fi
echo

# --- AGE Aris -----------------------------------------------------------------
DATA=${AGESIGHT_DATA_DIR:-$HOME/.agesight-data}
PORT=${AGEARIS_PORT:-4310}
URL="http://127.0.0.1:$PORT"
HERE=$(dirname "$(realpath "${BASH_SOURCE[0]}")")
APP=${AGEARIS_HOME:-}
[ -n "$APP" ] || { [ -f "$HERE/../../server.mjs" ] && APP=$(realpath "$HERE/../..") || APP=$HOME/Code/AGEAris; }
LOG=${XDG_STATE_HOME:-$HOME/.local/state}/agearis/server.log

token() { [ -f "$DATA/.api-token" ] && tr -d '\n' < "$DATA/.api-token"; }
api() { curl -s -o /dev/null -w '%{http_code}' --max-time 2 -H "X-AGESight-Token: $(token)" "$URL/api/settings"; }

# The project tracking this repository, or this project's own folder.
project_id() {
  local p
  # Not `realpath -m`: macOS's realpath has no -m.
  case "$ROOT/" in "$(realpath "$DATA" 2>/dev/null || printf '%s' "$DATA")/projects/"*) basename "$ROOT"; return ;; esac
  for p in "$DATA"/projects/*/project.json; do
    [ -f "$p" ] || continue
    jq -er --arg r "$ROOT" 'select(.repository == $r) | .id' "$p" 2>/dev/null && return
  done
}

start() {
  # The server prints its sign-in link to the log, so the log is the operator's
  # alone, wherever the folder's own mode would let others read it.
  mkdir -p "$(dirname "$LOG")" && chmod 700 "$(dirname "$LOG")"
  [ ! -f "$LOG" ] || chmod 600 "$LOG"
  # A detached child leads a new session, so the server outlives this script and
  # holds none of its output. Node does this on Linux and macOS alike; setsid(1)
  # is Linux-only. argv0 keeps the command line `node server.mjs`, which
  # stale_pid matches, where node is a link to a binary named node-22.
  (cd "$APP" && AGESIGHT_DATA_DIR="$DATA" PORT="$PORT" node -e '
    const log = require("node:fs").openSync(process.argv[1], "a", 0o600);
    require("node:child_process").spawn(process.execPath, ["server.mjs"], { argv0: "node", detached: true, stdio: ["ignore", log, log] }).unref();
  ' "$LOG")
  for _ in $(seq 50); do sleep 0.2; state=$(api); [ "$state" = 000 ] || break; done
}

# The PID of this checkout's AGE Aris on the port, if it started before the
# newest change to server.mjs or lib/: the page in public/ is read on every
# request, the server's code only at start, so an old server meets a new page.
# Prints nothing when any of it cannot be told (no ss or /proc, another
# program, another checkout); that server is left alone.
stale_pid() {
  local pid cmd started newest
  command -v ss >/dev/null || return 0
  pid=$(ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
  [ -n "$pid" ] && [ -d "/proc/$pid" ] || return 0
  [ "$(readlink "/proc/$pid/cwd" 2>/dev/null)" = "$(realpath "$APP")" ] || return 0
  cmd=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null)
  case "$cmd" in node\ server.mjs\ |*/node\ server.mjs\ ) ;; *) return 0 ;; esac
  started=$(ps -o etimes= -p "$pid" 2>/dev/null | tr -d ' ')
  [ -n "$started" ] || return 0
  started=$(( $(date +%s) - started ))
  newest=$(stat -c %Y "$APP/server.mjs" "$APP"/lib/*.mjs 2>/dev/null | sort -n | tail -1)
  [ -n "$newest" ] && [ "$newest" -gt "$started" ] && echo "$pid"
}

state=$(api)
if [ "$state" = 200 ] && [ -f "$APP/server.mjs" ]; then
  old=$(stale_pid)
  if [ -n "$old" ]; then
    kill "$old" 2>/dev/null
    for _ in $(seq 50); do kill -0 "$old" 2>/dev/null || break; sleep 0.1; done
    if kill -0 "$old" 2>/dev/null; then
      echo "AGE Aris (PID $old) is older than its code and did not stop; restart it by hand."
    else
      start
      [ "$state" = 200 ] && echo "Restarted AGE Aris on port $PORT: its code had changed since it started (log: $LOG)."
    fi
  fi
fi
if [ "$state" != 200 ]; then
  if [ "$state" = 000 ]; then
    if [ ! -f "$APP/server.mjs" ]; then echo "AGE Aris is not running, and there is no checkout at $APP to start (set AGEARIS_HOME)."; exit 0; fi
    start
    [ "$state" = 200 ] && echo "Started AGE Aris on port $PORT (log: $LOG)."
  fi
  if [ "$state" != 200 ]; then
    if [ "$state" = 401 ]; then echo "Something on port $PORT is not the AGE Aris for $DATA (it refused that folder's token). Set AGEARIS_PORT."
    else echo "AGE Aris did not answer on port $PORT (HTTP $state); see $LOG."; fi
    exit 0
  fi
fi

ID=$(project_id)
if [ -z "$ID" ] && [ "$LINK" = 1 ] && [ -n "$BOARD" ]; then
  body=$(jq -cn --arg path "$ROOT" --arg name "$NAME" '{path: $path, name: $name}')
  reply=$(curl -s --max-time 30 -H "X-AGESight-Token: $(token)" -H 'Content-Type: application/json' -d "$body" "$URL/api/projects/link")
  ID=$(jq -r '.id // empty' <<<"$reply" 2>/dev/null)
  if [ -n "$ID" ]; then echo "Now tracking $NAME in AGE Aris."
  else echo "AGE Aris could not track $NAME: $(jq -r '.error // .' <<<"$reply" 2>/dev/null)"; exit 0; fi
fi
if [ -z "$ID" ]; then
  [ -n "$BOARD" ] && echo "AGE Aris is running at $URL/?token=$(token) but does not track $NAME yet: \`/aa link\` tracks it (AGE Aris only reads it)."
  exit 0
fi

# The sign-in answer redirects to / without a fragment, so #project/ survives it.
LINK_URL="$URL/?token=$(token)#project/$ID"
echo "AGE Aris: $LINK_URL"
if [ "$OPEN" = 1 ]; then
  if command -v xdg-open >/dev/null; then xdg-open "$LINK_URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null; then open "$LINK_URL" &
  else echo "No browser opener found; open the link above."; fi
fi
