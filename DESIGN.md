# AGE Aris application

AGE Aris is a project management application for an operator working with people
and agents. Its first version runs locally. Project tasks are Markdown files, and
git records changes. The existing plugin remains an integration for agents.

The primary job is to see what needs attention, choose a project, and move work
from backlog to completion without losing ownership or handoff context.

## First version

- Create projects with a name, description, color, and work in progress limit.
- Create and edit tasks with an owner, priority, due date, and description.
- Use a board or task list; search and filter the work.
- Start each day on Home: what needs the operator, what moved since the last
  visit, and each project's health, with every number explainable down to its
  commits.
- Show and check the method: each project's workflow, policies, method checks,
  agent protocol, and pipeline, in the method's own terms with a plain meaning
  beside each.
- Persist tasks and history across application restarts.
- Reject stale edits and claims beyond the project's work in progress limit.
- Track an existing repository's AA board. AGE Aris reads its files and
  history; that repository's agents keep working there. Once the operator
  switches task actions on for it, claim, release, block, unblock and done
  each commit one task file to the pinned branch, and nothing else there
  changes (the rule is in `AGENTS.md`).

Accounts, remote collaboration, and external integrations belong to later
versions. The application serves one local operator.

## Agent pipeline (0.3)

Agents carry a task through stages while the operator keeps control. The run is
reduced to one question at a time: the **decision card** at the top of the run
page asks for exactly what is needed (approve, provide input, choose an agent,
or retry), and Home's Needs you (with the Decisions inbox one click down)
collects all such questions across projects.
Audit detail sits one level down: attempts, prompts, outputs, the routing
scoreboard, and the verified event log are expanded on request. A board card
shows only the current stage and whether the run needs the operator.

Run state is computed only from the hash-chained event log, so what the
interface shows can always be traced to recorded events. Routing explains
itself with a scoreboard rather than a bare choice. Pipelines and agents are
configuration and appear outside the main flow.

## Visual direction

The method is the product, so its terms are labels: WIP, cycle time, service
level, aging WIP, stale claim, blocked time. A plain one-liner sits beside each
("Service level: 85% of tasks finish within this cycle time"). Raw machinery,
commit hashes, the ledger, and rule codes as bare ids, sits one level down.

Story first, evidence one click down: problems get full rows, and everything
that is fine collapses into one "All clear" line. One task has one look: the
same signal badges on a Home row, a card, a list row, and the drawer, which
always opens the same way.

The shell is true black: the page and its panels are `#000`, separated by thin
borders rather than shades of grey. A slim sidebar (the AGE Aris logo with ARIS centred under it in Michroma, a wide space-age face served by AGE Aris itself as a four-glyph woff2 under the SIL Open Font License,
then Home, Projects, Working, Agents, Activity, and the projects with a health dot each;
the logo is `public/logo.webp` and the tab icon `public/planet.png`, both made
from `docs/brand/age-aris-logo.png`), a top bar with search and a secondary Add
project button. Colour carries meaning only: red stuck or overdue, amber quiet
or running long, blue in progress, green done. The accent is silver, taken from
the logo, so it never reads as a status: links, focus rings, switches and
neutral chart bars. Silver on black reads as grey unless it looks like metal,
and silver-filled shapes with a gradient read as a stock app. So silver is
light on black, as in the logo: the primary button and the avatar are black
glass with a fine silver rim that catches the light and a faint glow (white
text, 15:1); the Aris wordmark is silver lit from above with the logo's fine
grain; the selected sidebar item and tab carry a light silver bar. Surfaces
keep their plain borders. Health reads as words (On track,
Watch, Needs attention) and the dot keeps the colour. Numbers are plain text
that explain themselves on hover and focus. Charts carry date ticks and a
maximum label.

A chart is drawn at the width it is shown at, so its text stays the page's
12–13 px on any screen, and redraws when the window is resized; below 650 px it
scrolls. Durations on a chart sit on a log scale with ticks people think in
(1 min, 15 min, 1 h, 1 day, 1 week), because cycle times run from minutes to
weeks and a linear axis piles them all at zero. They read in the same words as
the numbers: minutes under an hour, hours under a day. A chart with nothing to
draw (a board younger than a week, nothing in progress, too little history to
forecast) is one line saying what it needs, never an empty frame. The Flow tab
does not repeat the four numbers above every tab; on a wide screen its aging
and cycle-time charts sit side by side.

All colour, space, and type come from CSS tokens. Body text is at least 13:1
on black, muted text at least 6.5:1, and coloured fills carry black text. The type scale is 12/13/14/16/20/28px, nothing smaller than 12px. The
content security policy allows no inline styles, so agent colours are classes.

```text
Sidebar  | Search                                   Add project
Home     | AGEIS  Tracked
Projects | ● Needs attention: 5 items past 2× usual, 2 stale agent claims.
Working  | Throughput 32 | WIP 6 | Cycle time 24 min | Service level 6.2 h
Agents   | Board  Threads  List  Flow  Method
Activity | Backlog | In progress | Blocked | Done this week, newest 10 (Show all 80)
 ● AGEIS |
```

Working lists everything in progress or blocked on every board, grouped by
project and oldest first: the holder, the time in progress, the blocked reason
or the holder's last note, and the usual signal badges. Agents keeps its own
"Working now" tab, which groups the same work by agent session.

The empty workspace offers project creation and an explicitly chosen example.
The task drawer keeps the board in context and renders the task file as
Markdown does: a line break inside a paragraph is a space, and an indented
block is code. Below 1280 px a project's tabs sit above its filters and a list
row's signals sit under its title, so neither is squeezed. On a phone the
sidebar collapses, Home and the drawer read first, the tabs drop their icons,
and the board's columns scroll sideways. No page scrolls sideways.

The page takes the window's width, up to an ultrawide monitor: no column cap,
only a gutter that grows a little with the window. Width buys more columns, not
wider ones: a board column tiles its cards once it is wide enough for two, and
project cards, method checks and policies fill as many columns as fit. Prose
keeps a reading measure of 90 characters, whatever the width.

The first design review removed ornamental metrics and a marketing hero: the
application must open directly on work. Every count is computed from saved
history and cites it; a metric without enough history shows — and says why.
Keyboard focus, labeled controls, dialog focus management, plain text rendering,
and reduced motion are required throughout.
