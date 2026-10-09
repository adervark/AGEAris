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

**Work moving is the thing you see first.** Every board is drawn as a flow
strip (`public/strip.js`): one track running Backlog, In progress, Blocked,
Done this week, each stretch named above the line with its count. Waiting
tasks queue as rings at the In progress gate. Work in progress sits on the
track at its age, on a log scale from a minute, with the service level and
twice it marked; it turns amber past the first and red past the second, the
levels the aging metric gives. Blocked work sits in its own stretch, oldest
first. Finished work stacks up from the track, a column a day with today last;
the dots shrink until the busiest day fits, and only then is a day counted
instead. Over the WIP limit, the In progress and Blocked stretch of track
turns red and the count with it. Every task mark opens its task, by click or
by Enter and Space. A strip is drawn at the width it is shown at and redraws
when that changes; below 560 px it scrolls.

Home leads with its headline in Michroma ("Nothing needs you", "2 things need
you"). Beside it, in a side column of 30% of the page (300 to 440 px), sit
Needs you and what changed since the last visit; the rest of the width holds
every board as a strip with its name, health word and one quiet line of its
numbers. Below 1000 px the side column sits above the strips. Projects is
the same strips, one per project. A project page leads with its title in
Michroma and its health word, then its four numbers in one line (the figure,
the method's term, its meaning), then its strip across the page; the tabs
follow. The board's columns are open lanes divided by a line, and a task is a
quiet row with a line above it, not a box.

Story first, evidence one click down: problems get full rows, and everything
that is fine collapses into one "All clear" line. One task has one look: the
same signal badges on a Home row, a board row, a list row, and the drawer,
which always opens the same way.

Boxes only where a thing is a separate object: dialogs, the drawer, inputs,
badges and warnings. Sections are separated by space and thin lines, never a
rounded bordered card each. Labels are sentence case, never capitals; meta
reads as words and commas, never strings joined with middle dots; numbers set
in the text face with tabular figures, never a monospace face, which is kept
for code, paths and commits. No entrance animations.

Type is two faces, both served by AGE Aris itself, cut to Latin, under the SIL
Open Font License (`docs/brand/`): Michroma, wide and machined, for the Aris
wordmark, page titles and the Home headline; Hanken Grotesk for everything
else. The body is 15 px; the scale runs 12/13/14/15/16/18/24/26–32 px, nothing
smaller than 12 px.

The shell is true black: the page and its panels are `#000`, separated by thin
borders rather than shades of grey. A slim sidebar (the AGE Aris logo with
ARIS centred under it in Michroma, then Home, Projects, Working, Agents,
Activity, and the projects with a health dot each; the logo is
`public/logo.webp` and the tab icon `public/planet.png`, both made from
`docs/brand/age-aris-logo.png`), a top bar with search and a secondary Add
project button. Colour carries meaning only: red stuck or overdue, amber quiet
or running long, blue in progress, green done. The accent is silver, taken
from the logo, so it never reads as a status: links, focus rings, switches and
neutral chart bars. Silver on black reads as grey unless it looks like metal,
and silver-filled shapes with a gradient read as a stock app. So silver is
light on black, as in the logo: the primary button and the avatar are black
glass with a fine silver rim that catches the light and a faint glow (white
text, 15:1); the Aris wordmark is silver lit from above with the logo's fine
grain; the selected sidebar item and tab carry a light silver bar. Health
reads as words (On track, Watch, Needs attention) and the dot keeps the
colour. Numbers are plain text that explain themselves on hover and focus.
Charts carry date ticks and a maximum label.

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
on black, muted text at least 6.5:1, the faintest text (a strip's weekdays)
4.6:1, and coloured fills carry black text. The content security policy allows
no inline styles, so agent colours and strip marks are classes.

```text
Sidebar  | Search                                          Add project
Home     | 1 thing needs you                                Friday 9 October
Projects | Needs you            | AGEIS  On track
Working  |  Aging WIP 1         | Finished this week 33, usually 5.5  Cycle time 29 min
Agents   |  T044 Restructure…   | Backlog 2 | In progress 0 | Blocked 0 | Done this week 33
Activity | Since your last visit|   oo|———— • • •  ┆85% ┆2×|———————|  ⁘ ⁘ ⁘ ⁘ ⁘ ⁘
 ● AGEIS |  38 finished         | AGE Aris  Needs attention
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
and the board's columns scroll sideways. No page scrolls sideways. The menu
button at the left of the top bar hides and shows the sidebar everywhere: on a
phone it slides over the page; on a wider screen it folds away so the page
takes the width, and the browser remembers the choice.

The page takes the window's width, up to an ultrawide monitor: no column cap,
only a gutter that grows a little with the window. Width buys more columns, not
wider ones: a board lane tiles its rows once it is wide enough for two, and
method checks and policies fill as many columns as fit; a flow strip is the
exception and spreads its stretches, and grows a little taller. Prose
keeps a reading measure of 90 characters, whatever the width.

The first design review removed ornamental metrics and a marketing hero: the
application must open directly on work. Every count is computed from saved
history and cites it; a metric without enough history shows — and says why.
Keyboard focus, labeled controls, dialog focus management, plain text rendering,
and reduced motion are required throughout.
