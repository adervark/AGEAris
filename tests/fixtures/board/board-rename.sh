#!/bin/bash
# board-rename.sh <dir holding board.sh and ckpt.sh>
# A deaddrop/ board migrated to AA/ in one commit, and a twin that was always
# AA/: board.sh --all must print the same board for both (T011). Exits 1 if not.
set -euo pipefail
SRC=$1; W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1   # no hooks, signing or templates of the machine
task() { # dir id status title
  mkdir -p "$(dirname "$1")"
  printf -- '---\nid: %s\ntitle: "%s"\nstatus: %s\nowner: ade @k/e857a8c8 2026-09-01 — work\ntype: bug\ncreated: 2026-09-01\n---\n\n# %s\n\n## Decision rules — fixed in advance\n\n- pass\n\n## Result\n\nDone.\n' "$2" "$4" "$3" "$4" > "$1"
}
at() { export GIT_AUTHOR_DATE="2026-09-0$1T09:00:00Z" GIT_COMMITTER_DATE="2026-09-0$1T09:00:00Z"; }
build() { # name board
  local r=$W/$1 b=$2; git init -q "$r"; cd "$r"; git config user.name ade; git config user.email a@b.invalid
  mkdir -p $b/tasks; touch $b/tasks/.gitkeep; at 1; task $b/backlog/T001-a.md T001 open A; task $b/backlog/T002-b.md T002 open B; task $b/backlog/T003-c.md T003 open C
  git add -A; git commit -qm "add three tasks"
  at 2; git mv $b/backlog/T001-a.md $b/tasks/; task $b/tasks/T001-a.md T001 claimed A; git add -A; git commit -qm "claim T001"
  at 3; git mv $b/backlog/T002-b.md $b/tasks/; task $b/tasks/T002-b.md T002 claimed B; git add -A; git commit -qm "claim T002"
  at 4; mkdir -p $b/tasks/done; git mv $b/tasks/T001-a.md $b/tasks/done/; task $b/tasks/done/T001-a.md T001 done A; git add -A; git commit -qm "T001 done"
  at 5; task $b/tasks/T002-b.md T002 blocked B; git add -A; git commit -qm "block T002"
  if [ "$b" != AA ]; then at 6; git mv $b AA; git commit -qm "migrate: rename $b/ to AA/"; fi
  at 7; git mv AA/backlog/T003-c.md AA/tasks/; task AA/tasks/T003-c.md T003 claimed C; git add -A; git commit -qm "claim T003"
  mkdir -p AA/checkpoints; cp "$SRC"/board.sh "$SRC"/ckpt.sh AA/
  printf 'wip:\n  in_progress: 3\n  blocked: 2\nstale_hours: 24\n' > AA/AA.yml
  AA/board.sh --all > "$W/$1.out" 2>&1 || true
}
build twin AA; build migrated deaddrop
diff "$W/twin.out" "$W/migrated.out"
