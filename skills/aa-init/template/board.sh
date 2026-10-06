#!/usr/bin/env bash
# AA board — the Kanban board, computed and never stored.
#
#   visualise the work      the columns              (Kanban core practice 1)
#   limit work in progress  wip: in AA.yml     (practice 2)
#   manage flow             throughput, cycle time, work item age, flow efficiency (3)
#   policies explicit       the limit, the DoR and the DoD are checked here (4)
#   the commitment point    backlog/ -> tasks/. After it, an item is WIP.
#   pull, never push        /reclaim takes work; nothing is assigned
#
# THE LOCATION IS THE STATE. backlog/ is the queue, tasks/ is work in progress,
# tasks/done/ is delivered. `status:` refines a column; it never overrides one.
# That is deliberate: a status field that can disagree with the directory will.
#
# Metrics after Vacanti's four plus Little's Law. The aging mark compares an
# item's age against the 85th percentile of THIS repo's delivered cycle times,
# so the reference line is measured here and never borrowed. Every number comes
# from the task files, the trails and git: nothing to maintain, nothing to fake.
#
# Output is markdown, so the terminal view and the STATE.md region are the same
# render. One renderer, no second copy to drift.
#
#   board.sh                 print it
#   board.sh --write         replace the generated region of STATE.md
#   board.sh --check         exit 1 if that region is stale (for CI / pre-commit)
#
# It writes nothing but that region, commits nothing, and decides nothing.
set -uo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=ckpt.sh
. "$HERE/ckpt.sh"

STATE="$DD/STATE.md"
MARK_A='<!-- AA:generated -->'
MARK_B='<!-- /AA:generated -->'

board_tasks() { # TSV: id, title, status, operator, where, has-DoR, has-Result, type
  shopt -s nullglob
  local files=("$BL"/*.md "$TD"/*.md "$TD"/done/*.md)
  [ "${#files[@]}" -gt 0 ] || return 0
  LC_ALL=C awk -v bl="$BL" -v td="$TD" '
    function trim(v) { gsub(/^[ \t]+|[ \t]+$/,"",v); return v }
    { sub(/\r$/,"") }                                  # a CRLF checkout has frontmatter too
    FNR==1 { nf++; fn[nf]=FILENAME; inb=($0=="---"); sec=""; ph=0; next }
    inb && $0=="---" { inb=0; next }
    inb {
      line=$0
      if      (line ~ /^id:/)     { v=line; sub(/^id: */,"",v);     id[nf]=trim(v) }
      else if (line ~ /^title:/)  { v=line; sub(/^title: */,"",v);  sub(/^"/,"",v); sub(/"$/,"",v); ti[nf]=trim(v) }
      else if (line ~ /^status:/) { v=line; sub(/^status: */,"",v); st[nf]=trim(v) }
      else if (line ~ /^owner:/)  { v=line; sub(/^owner: */,"",v);  ow[nf]=trim(v) }
      else if (line ~ /^type:/)   { v=line; sub(/^type: */,"",v);   ty[nf]=trim(v) }
      next
    }
    # the body: do the Definition of Ready (a registered decision rule) and the
    # Definition of Done (a filled Result) have content, or a placeholder?
    /^## / {                                    # only a top-level heading ends a section:
      h=tolower($0)                             # a ### inside Result is its content
      if      (h ~ /decision rule/) sec="dor"
      else if (h ~ /^## *result/)   sec="res"
      else                          sec=""
      next
    }
    sec != "" {
      line=$0
      if (ph) { if (line ~ /\}\}/) ph=0; next }              # inside a {{placeholder}}
      if (line ~ /\{\{/ && line !~ /\}\}/) { ph=1; next }
      gsub(/\{\{[^}]*\}\}/,"",line)
      gsub(/^[ \t]+|[ \t]+$/,"",line)
      # template guidance is an italic parenthetical, *(like this)*, over as many
      # lines as it likes. A filled section opens with prose, a list or a **bold**
      # lead — never with *( — so this tells them apart without guessing.
      if (it) { if (line ~ /\*$/) it=0; next }
      if (line ~ /^\*\(/) { if (line !~ /\*$/) it=1; next }
      if (line == "") next
      if (sec=="dor") dor[nf]=1; else res[nf]=1
    }
    END {
      for (i=1; i<=nf; i++) {
        b=fn[i]; sub(/.*\//,"",b); sub(/\.md$/,"",b)
        k=id[i]; if (k=="") { k=b; sub(/-.*$/,"",k) }
        t=ti[i]; if (t=="") { t=b; sub(/^[^-]*-*/,"",t); gsub(/-/," ",t) }
        s=tolower(st[i]); if (s=="") s="open"
        o=ow[i]                        # the operator; drop @profile/session, the date, the note
        sub(/^—.*$/,"",o); sub(/^-+ .*$/,"",o)
        sub(/ +@.*$/,"",o); sub(/ +—.*$/,"",o); sub(/ +--.*$/,"",o)
        sub(/ +[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].*$/,"",o)
        o=trim(o); if (o=="" || o=="none" || o=="-") o="-"   # a real value, so the field
        y=tolower(ty[i])                                      # cannot collapse on read
        if (y ~ /[{}]/) y=""                                  # an unfilled placeholder is not a type
        gsub(/[^a-z0-9 _-]/,"",y); gsub(/^ +| +$/,"",y); if (y=="") y="-"
        w = (index(fn[i], td "/done/")==1) ? "done" : (index(fn[i], bl "/")==1 ? "backlog" : "live")
        printf "%s\t%s\t%s\t%s\t%s\t%d\t%d\t%s\n", k, t, s, o, w, dor[i]+0, res[i]+0, y
      }
    }' "${files[@]}"
}

board_trails() { # TSV: task, newest entry (epoch), runs in flight, touch time (s)
  shopt -s nullglob
  local f t
  for f in "$CK"/*.jsonl; do
    t=$(basename "$f" .jsonl)
    # touch time is the UNION of the runs' intervals, not their sum: two agents on
    # one task occupy one stretch of wall clock, and flow efficiency is wall clock.
    records "$f" | jq -sr --arg t "$t" 'select(length>0)
      | ( [ group_by(.run)[]
            | { s: ([.[] | (.ts|fromdateiso8601?) // empty] | min),
                e: ([.[] | (.ts|fromdateiso8601?) // empty] | max) }
            | select(.s != null and .e != null) ] | sort_by(.s) ) as $iv
      | ( reduce $iv[] as $r ([];
            if (length == 0) or ($r.s > .[-1].e) then . + [$r]
            else .[0:-1] + [{ s: .[-1].s, e: (if $r.e > .[-1].e then $r.e else .[-1].e end) }] end)
          | map(.e - .s) | add // 0 ) as $touch
      | [ $t,
          ((([.[] | (.ts|fromdateiso8601?) // 0] | max) // 0) | tostring),
          ([group_by(.run)[] | select(.[-1].kind=="doing")] | length | tostring),
          ($touch | floor | tostring) ] | @tsv'
  done
}

board_history() { # TSV: task, created, entered WIP (latest claim), delivered, blocked since
  git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1 || return 0
  # One pass. -G keeps only commits that touched a status line, which is the
  # state-transition history. A bulk sweep is excluded by subject, or the day of
  # the sweep becomes every task's claim date (WHY § the staleness clock).
  git -C "$ROOT" -c core.quotePath=false log --format='%x01%at%x09%s' -p -G'^status:' \
      -- AA/tasks AA/backlog 2>/dev/null \
  | LC_ALL=C awk '
      /^\001/ { split(substr($0,2), h, "\t"); ts=h[1]+0
                 mech = (h[2] ~ /^(migrate|ckpt): /) ? 1 : 0
                 next }
      /^\+\+\+ / { p=$0; id=(match(p,/[A-Z]+-?[0-9]+/) ? substr(p,RSTART,RLENGTH) : ""); next }
      id=="" || ts==0 || mech { next }
      /^\+status: / {
        s=tolower(substr($0,10)); if (!match(s,/[a-z]+/)) next
        w=substr(s,RSTART,RLENGTH)
        seen[id]=1
        created[id]=ts                                  # log is newest first: this ends up earliest
        if (w=="claimed" && !(id in claim))  claim[id]=ts       # the latest claim: this stint
        if ((w=="done" || w=="killed") && !(id in deliv)) deliv[id]=ts
        if (w=="blocked" && !(id in blk))    blk[id]=ts
      }
      END { for (i in seen) printf "%s\t%d\t%d\t%d\t%d\n", i, created[i], claim[i], deliv[i], blk[i] }'
}

board_commits() { # TSV: task, epoch, author, mechanical — the sign-of-life fallback (rule 4)
  git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1 || return 0
  git -C "$ROOT" -c core.quotePath=false log --format='%x01%at%x09%an%x09%s' --name-only \
      -- AA/tasks AA/backlog AA/checkpoints 2>/dev/null \
  | LC_ALL=C awk -F'\t' '
      /^\001/ { ts=substr($1,2)+0; who=$2; mech=($3 ~ /^(migrate|ckpt): /) ? 1 : 0; next }
      NF==1 && $1 != "" && ts>0 {
        if (match($1,/[A-Z]+-?[0-9]+/)) printf "%s\t%d\t%s\t%d\n", substr($1,RSTART,RLENGTH), ts, who, mech
      }'
}

render() { # the whole board, as markdown, on stdout
  local all="${1:-0}" win="${2:-30}" wipflag="${3:--1}"
  local ME NOW lim_wip lim_blk stale_h
  ME=$(git -C "$ROOT" config user.name 2>/dev/null || true)
  NOW=$(date +%s)
  lim_wip=$(cfg_sub wip in_progress 0); lim_blk=$(cfg_sub wip blocked 0)
  stale_h=$(cfg stale_hours 24)
  case "$lim_wip" in ''|*[!0-9]*) lim_wip=0 ;; esac
  case "$lim_blk" in ''|*[!0-9]*) lim_blk=0 ;; esac
  case "$stale_h" in ''|*[!0-9]*) stale_h=24 ;; esac
  [ "$wipflag" -ge 0 ] 2>/dev/null && lim_wip="$wipflag"

  { board_tasks   | sed 's/^/task\t/'
    board_trails  | sed 's/^/trail\t/'
    board_history | sed 's/^/hist\t/'
    board_commits | sed 's/^/commit\t/'
  } | LC_ALL=C awk -F'\t' -v now="$NOW" -v me="$ME" -v all="$all" -v win="$win" \
        -v limwip="$lim_wip" -v limblk="$lim_blk" -v staleh="$stale_h" '
    function dur(d) {
      if (d < 0)      return "?"
      if (d < 90)     return "now"
      if (d < 5400)   return sprintf("%dm", d/60)
      if (d < 172800) return sprintf("%dh", d/3600)
      return sprintf("%dd", d/86400)
    }
    function addl(k, id) { LC[k]++; if (LC[k] <= 10) LL[k] = LL[k] (LL[k]=="" ? "" : " ") id }
    function emitl(k, msg) {
      if (LC[k] > 0) NOTE[++nn] = "- **" LC[k] "** " msg ": " LL[k] (LC[k] > 10 ? " +" (LC[k]-10) " more" : "")
    }
    function pct(a, n, p,  b,i,j,t,k) {           # nearest-rank; mawk has no asort
      if (n < 5) return 0
      for (i=1; i<=n; i++) b[i]=a[i]
      for (i=2; i<=n; i++) { t=b[i]; j=i-1; while (j>=1 && b[j]>t) { b[j+1]=b[j]; j-- } b[j+1]=t }
      k = int(p*n/100); if (k*100 < p*n) k++
      if (k<1) k=1; if (k>n) k=n
      return b[k]
    }
    function pct_t(ty, p,  a,i,n) {
      n = tn[ty]; if (n < 5) return 0
      for (i=1; i<=n; i++) a[i] = tsam[ty SUBSEP i]
      return pct(a, n, p)
    }
    $1=="task"   { id=$2
                   if (id in SEENID) addl("dup", id)          # one id, two files: the key is not a key
                   SEENID[id]=1
                   TI[id]=$3; ST[id]=$4; OW[id]=($5=="-" ? "" : $5); WH[id]=$6
                   DOR[id]=$7+0; RES[id]=$8+0; TY[id]=($9=="-" ? "" : $9)
                   ids[++nid]=id; next }
    $1=="trail"  { NEW[$2]=$3+0; FLY[$2]=$4+0; TOUCH[$2]=$5+0; TRAIL[$2]=1; next }
    $1=="hist"   { CREA[$2]=$3+0; CLAIM[$2]=$4+0; DELIV[$2]=$5+0; BLK[$2]=$6+0; next }
    $1=="commit" { id=$2; ts=$3+0
                   if ($5+0 == 0) {                        # a mechanical sweep is not a sign of life
                     if (ts > CANY[id]) CANY[id]=ts
                     if ($4 != me && ts > COTH[id]) COTH[id]=ts
                   }
                   next }
    END {
      if (nid == 0) { print "(no task files in AA/backlog/ or AA/tasks/)"; exit }
      cutoff = now - win*86400

      # ---- THE LOCATION IS THE STATE. status only refines a column.
      for (i=1; i<=nid; i++) {
        id=ids[i]; if (SEEN2[id]++) continue
        w=WH[id]; s=ST[id]
        if      (w=="backlog") col="BACKLOG"
        else if (w=="done")    col=(s=="killed" ? "KILLED" : "DONE")
        else                   col=(s=="blocked" ? "BLOCKED" : "IN PROGRESS")
        C[id]=col
        claim = CLAIM[id]; if (!claim) claim = CREA[id]
        CL[id]=claim
        if (col=="BACKLOG")     n_back++
        if (col=="IN PROGRESS") { n_prog++; n_wip++ }
        if (col=="BLOCKED")     { n_blk++;  n_wip++ }
        if (col=="DONE")        n_deliv++
        if (col=="KILLED")      n_kill++
        if (col=="DONE" || col=="KILLED") {
          if (DELIV[id] >= cutoff) n_thr++
          if (DELIV[id] > 0 && claim > 0 && DELIV[id] > claim) {
            cyc[++n_cyc] = DELIV[id] - claim
            if (TY[id] != "") { tn[TY[id]]++; tsam[TY[id] SUBSEP tn[TY[id]]] = DELIV[id] - claim }
          }
          if (DELIV[id] > 0 && CREA[id] > 0 && DELIV[id] > CREA[id]) led[++n_led] = DELIV[id] - CREA[id]
        }
        if ((col=="IN PROGRESS" || col=="BLOCKED") && TRAIL[id] && claim > 0 && now > claim) {
          fe_touch += TOUCH[id]; fe_elapsed += now - claim; fe_n++
        }
      }
      p50 = pct(cyc, n_cyc, 50); p85 = pct(cyc, n_cyc, 85); l85 = pct(led, n_led, 85)
      thr = n_thr / (win/7.0)

      # ---- header and flow
      h = sprintf("%d task%s: %d backlog, %d WIP (%d in progress", nid, (nid==1?"":"s"), n_back, n_wip, n_prog)
      h = h (n_blk ? sprintf(" + %d blocked", n_blk) : "") ")"
      h = h sprintf(", %d delivered", n_deliv) (n_kill ? sprintf(", %d killed", n_kill) : "")
      printf "`board · %s · %s`\n\n", strftime("%Y-%m-%dT%H:%MZ", now, 1), h

      f = sprintf("**WIP %d", n_wip)
      if (limwip > 0) f = f sprintf("/%d**%s", limwip, (n_wip > limwip ? " ⚠ **over the limit**" : ""))
      else            f = f "** (no limit set — Kanban practice 2 is to set one, in `AA.yml`)"
      f = f sprintf(" · throughput %.1f/wk (%d in %dd)", thr, n_thr, win)
      if (p85 > 0) f = f sprintf(" · cycle time 50th %s / 85th %s (n=%d)", dur(p50), dur(p85), n_cyc)
      else         f = f sprintf(" · cycle time: too few delivered with a claim commit (n=%d)", n_cyc)
      print "FLOW · " f
      f = ""
      if (thr > 0) f = sprintf("Little%s Law: %d ÷ %.1f/wk ≈ %s expected", "\047s", n_wip, thr, dur(n_wip/thr*7*86400))
      if (fe_n > 0 && fe_elapsed > 0)
        f = f (f=="" ? "" : " · ") sprintf("flow efficiency %d%% (touch %s of %s, n=%d trails)", \
                                           int(100*fe_touch/fe_elapsed + 0.5), dur(fe_touch), dur(fe_elapsed), fe_n)
      if (l85 > 0) f = f (f=="" ? "" : " · ") sprintf("lead time 85th %s", dur(l85))
      if (f != "") print "FLOW · " f

      # ---- age and marks, once per task, before anything is ordered
      for (i=1; i<=nid; i++) {
        id=ids[i]; col=C[id]; if (MARKED[id]++) continue
        if      (col=="BACKLOG")     age = (CREA[id] ? now - CREA[id] : -1)
        else if (col=="IN PROGRESS") age = (CL[id]   ? now - CL[id]   : -1)
        else if (col=="BLOCKED")     age = (BLK[id]  ? now - BLK[id]  : (CL[id] ? now - CL[id] : -1))
        else                         age = (DELIV[id]? now - DELIV[id]: -1)
        AGE[id]=age
        wip = (col=="IN PROGRESS" || col=="BLOCKED")
        m=""
        if (FLY[id] > 0) { m = m "⚙"; n_fly += FLY[id] }
        ref = (TY[id] != "" ? pct_t(TY[id], 85) : 0); if (!ref) ref = p85
        if (wip && ref > 0 && age > ref) { m = m "⚠"; n_aging++ }
        if (wip) {
          # sign of life: the trail first, then commits — by anyone but me, since
          # my own tidying edit is not proof that somebody else is alive (rule 4)
          mine = (OW[id] != "" && me != "" && OW[id] == me)
          life = NEW[id]
          if (mine) { if (CANY[id] > life) life = CANY[id] }
          else      { if (COTH[id] > life) life = COTH[id] }
          if (life == 0 || now - life > staleh*3600) { m = m (mine ? "↩" : "⊘"); if (mine) n_mine++; else n_exp++ }
        }
        if (col=="BACKLOG" && !DOR[id]) { m = m "⚑"; n_notready++ }
        MK[id]=m
      }

      # ---- the cards. Oldest first where it is WIP: pull the oldest, do not
      # start new work. Newest delivery first once delivered. Id order queued.
      print ""
      print "| | id | task | owner | age | |"
      print "|---|---|---|---|---|---|"
      ORD[1]="IN PROGRESS"; ORD[2]="BLOCKED"; ORD[3]="BACKLOG"; ORD[4]="DONE"; ORD[5]="KILLED"
      for (oi=1; oi<=5; oi++) {
        col=ORD[oi]; nq=0
        for (i=1; i<=nid; i++) {
          id=ids[i]
          if (C[id] != col || QUEUED[id]++) continue
          if ((col=="DONE" || col=="KILLED") && !all && DELIV[id] < cutoff) continue
          Q[++nq]=id
        }
        if (nq == 0) continue
        # insertion sort on the column key: WIP descends by age, delivered
        # ascends by age (newest first), the backlog keeps id order.
        if (col != "BACKLOG") {
          for (i=2; i<=nq; i++) {
            t=Q[i]; j=i-1
            while (j>=1 && ((col=="DONE"||col=="KILLED") ? AGE[Q[j]] > AGE[t] : AGE[Q[j]] < AGE[t])) { Q[j+1]=Q[j]; j-- }
            Q[j+1]=t
          }
        }
        # a long backlog is one line, not a hundred: the board shows committed
        # work in full and the queue as a count (WHY § scale)
        if (col=="BACKLOG" && !all && nq > 6) {
          q=""
          for (i=1; i<=6; i++) q = q (q==""?"":" ") "`" Q[i] "`" MK[Q[i]]
          printf "| **BACKLOG** %d | | %s +%d more (`--all`) | | | ⚑ %d not ready |\n", nq, q, nq-6, n_notready
          continue
        }
        head = "**" col "**"
        if (col=="IN PROGRESS" && limwip > 0) head = head " " n_prog "/" limwip (n_prog > limwip ? "⚠" : "")
        if (col=="BLOCKED"     && limblk > 0) head = head " " n_blk  "/" limblk (n_blk  > limblk ? "⚠" : "")
        for (i=1; i<=nq; i++) {
          id=Q[i]
          printf "| %s | %s | %s | %s | %s | %s |\n", (i==1 ? head : ""), id, TI[id],
                 (OW[id]=="" ? "—" : OW[id]), (AGE[id] < 0 ? "?" : dur(AGE[id])), MK[id]
        }
      }

      # ---- the legend, only for marks actually drawn
      print ""
      print "age: in the queue (BACKLOG) · since the claim (IN PROGRESS) · since blocking (BLOCKED) · since delivery (DONE)"
      if (n_fly)      print "- ⚙ a run is IN FLIGHT (a `doing` nothing closed) — `ckpt.sh live` before you spend anything"
      if (n_aging)    print "- ⚠ work item age past the 85th-percentile cycle time this repo has delivered — finish or split it; it is not a lock"
      if (n_exp)      print "- ⊘ no sign of life in " staleh "h from anyone but the owner — the claim has expired and is pullable (rule 4)"
      if (n_mine)     print "- ↩ your own idle claim — take it straight back, no staleness wait (rule 3)"
      if (n_notready) print "- ⚑ no decision rule registered — not ready to pull if it will spend (rule 5)"

      # ---- policy and drift
      if (limwip > 0 && n_wip > limwip)
        NOTE[++nn] = sprintf("- **WIP is %d against a limit of %d** — finish or release before pulling more (rule 10)", n_wip, limwip)
      if (limblk > 0 && n_blk > limblk)
        NOTE[++nn] = sprintf("- **%d blocked against a limit of %d** — a blocker nobody is clearing is the flow problem", n_blk, limblk)
      for (i=1; i<=nid; i++) {
        id=ids[i]; col=C[id]
        if (col=="BACKLOG" && OW[id] != "")                 addl("ownbl", id)
        if ((col=="DONE"||col=="KILLED") && !RES[id])       addl("nores", id)
        if ((col=="DONE"||col=="KILLED") && TRAIL[id])      addl("trail", id)
        if (col=="IN PROGRESS" && !DOR[id])                 addl("nodor", id)
        if (col=="IN PROGRESS" && OW[id]=="")               addl("noown", id)
        if (col=="IN PROGRESS" && ST[id]=="done")           addl("stuck", id)
      }
      emitl("nodor", "task(s) past the commitment point with no decision rule registered (DoR, rule 5)")
      emitl("noown", "task(s) in tasks/ with no owner — claiming writes the owner line (rule 1)")
      emitl("ownbl", "backlog task(s) carrying an owner — a claim is a move to tasks/, not a line edit")
      emitl("nores", "delivered task(s) with no Result filled in (DoD)")
      emitl("trail", "delivered task(s) whose trail is still in the tree (`ckpt.sh close ID --delete`)")
      emitl("stuck", "task(s) marked done but still in tasks/ (`git mv` them to tasks/done/)")
      emitl("dup",   "task id(s) used by more than one file — the id is the coordination key, and its trail is shared")
      if (nn > 0) {
        print ""
        print "**POLICY AND DRIFT** — the board reports; the owner and `/reclaim` decide."
        print ""
        for (i=1; i<=nn; i++) print NOTE[i]
      }
    }'

  # trails the task files know nothing about, and lines that no longer parse
  shopt -s nullglob
  local f t bad m extra=""
  for f in "$CK"/*.jsonl; do
    t=$(basename "$f" .jsonl)
    bad=$(badlines "$f")
    [ "$bad" -gt 0 ] && extra="$extra"$'\n'"- \`$t\`: $bad unparseable trail line(s) — \`ckpt.sh check $t\`"
    m=("$TD"/"$t"-*.md "$TD"/done/"$t"-*.md "$BL"/"$t"-*.md)
    [ "${#m[@]}" -gt 0 ] || extra="$extra"$'\n'"- \`$t\` has a trail but no task file"
  done
  [ -n "$(printf '%s' "$extra" | tr -d '[:space:]')" ] && printf '%s\n' "$extra"
  return 0
}

write_state() { # replace only the generated region; the NOW block is never touched
  [ -f "$STATE" ] || die "no $STATE to write into"
  grep -qF "$MARK_A" "$STATE" || die "$STATE has no $MARK_A marker — add it, or the render has nowhere to go"
  grep -qF "$MARK_B" "$STATE" || die "$STATE has no $MARK_B marker"
  local tmp body
  tmp=$(mktemp); body=$(mktemp)
  render "$@" > "$body"
  LC_ALL=C awk -v a="$MARK_A" -v b="$MARK_B" -v f="$body" '
    index($0,a) { print; while ((getline l < f) > 0) print l; skip=1; next }
    index($0,b) { skip=0 }
    !skip' "$STATE" > "$tmp" && mv "$tmp" "$STATE"
  rm -f "$body"
  echo "wrote the generated region of AA/STATE.md"
}

# WHAT "STALE" MEANS, AND WHAT IT MUST NOT MEAN.
#
# The gate exists for ONE failure: somebody claimed, delivered or added a task
# and did not re-render, so the board names the wrong columns. That is drift a
# human caused and a human must fix.
#
# It must NOT fire on the passage of time. Ages (`now` -> `2h`), the timestamp,
# ⚙ from a live trail, ⊘ from an expiring claim and every FLOW number are
# derived from the clock and move on their own. Comparing the whole render made
# the board "stale" minutes after every write, forever — and a gate that cries
# wolf gets switched off, which brings back exactly the drift it was added to
# stop (WHY § the board that ate itself).
#
# So the comparison is STRUCTURAL: which task sits in which column, under what
# title, owned by whom. Those change only when a file changes.
structural() { # read a rendered board on stdin -> its structural rows
  LC_ALL=C awk -F'|' '
    /^\| *-+ *\|/ { next }                       # the separator row
    /^\|/ && NF >= 7 {
      if ($2 ~ /^ *$/ && $3 ~ /^ *$/) next        # a spacer row carries nothing
      h=$2; id=$3; ti=$4; ow=$5                   # drop $6 age and $7 marks: clock-derived
      gsub(/⚠/,"",h)                              # the limit breach is re-derived, not stored
      gsub(/^ +| +$/,"",h); gsub(/^ +| +$/,"",id); gsub(/^ +| +$/,"",ti); gsub(/^ +| +$/,"",ow)
      print h "\t" id "\t" ti "\t" ow
    }'
}

check_state() { # exit 1 when the region is stale — for CI or a pre-commit hook
  [ -f "$STATE" ] || die "no $STATE"
  local cur new
  cur=$(LC_ALL=C awk -v a="$MARK_A" -v b="$MARK_B" '
          index($0,b) { inb=0 } inb { print } index($0,a) { inb=1 }' "$STATE" | structural)
  new=$(render "$@" | structural)
  if [ "$cur" = "$new" ]; then
    echo "STATE.md is current"; return 0
  fi
  echo "STATE.md generated region is STALE — run: AA/board.sh --write" >&2
  if command -v diff >/dev/null; then
    diff <(printf '%s\n' "$cur") <(printf '%s\n' "$new") \
      | sed -n 's/^</  on the board but not in the files: /p; s/^>/  in the files but not on the board: /p' >&2
  fi
  return 1
}

main() {
  local all=0 win=30 wip=-1 mode=print
  while [ $# -gt 0 ]; do
    case "$1" in
      --all)    all=1; shift ;;
      --write)  mode=write; shift ;;
      --check)  mode=check; shift ;;
      --window) [ $# -ge 2 ] || die "--window needs a value"; win="$2"; shift 2 ;;
      --wip)    [ $# -ge 2 ] || die "--wip needs a value"; wip="$2"; shift 2 ;;
      -h|--help) cat <<'USAGE'
usage: board.sh [--write|--check] [--all] [--window DAYS] [--wip N]

  The Kanban board of the task files, as markdown. The location is the state:
  backlog/ is the queue, tasks/ is work in progress, tasks/done/ is delivered.

  (no flag)       print the board
  --write         replace the generated region of AA/STATE.md
  --check         exit 1 if that region is stale — for CI or a pre-commit hook
  --all           show the whole backlog and every delivered task, not just the window
  --window DAYS   window for throughput and the DONE column (default 30)
  --wip N         override this run's WIP limit (normally from AA.yml)
USAGE
        return 0 ;;
      *) die "unexpected argument: $1" ;;
    esac
  done
  case "$win" in ''|*[!0-9]*) die "--window takes a number of days" ;; esac
  case "$wip" in ''|-1) ;; *[!0-9]*) die "--wip takes a number" ;; esac
  [ "$win" -lt 1 ] && win=1
  [ -d "$TD" ] || die "no AA/tasks/ at $ROOT — is the board scaffolded here?"
  case "$mode" in
    write) write_state "$all" "$win" "$wip" ;;
    check) check_state "$all" "$win" "$wip" ;;
    *)     render "$all" "$win" "$wip" ;;
  esac
}

main "$@"
