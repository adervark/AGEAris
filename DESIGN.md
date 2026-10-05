# AGESight application

AGESight is a project management application for an operator working with people
and agents. Its first version runs locally. Project tasks are Markdown files, and
git records changes. The existing plugin remains an integration for agents.

The primary job is to see what needs attention, choose a project, and move work
from backlog to completion without losing ownership or handoff context.

## First version

- Create projects with a name, description, color, and work in progress limit.
- Create and edit tasks with an owner, priority, due date, and description.
- Use a board or task list; search and filter the work.
- Review project progress, overdue work, blocked tasks, and saved activity.
- Persist tasks and history across application restarts.
- Reject stale edits and claims beyond the project's work in progress limit.

Accounts, remote collaboration, and external integrations belong to later
versions. The application serves one local operator.

## Agent pipeline (0.3)

Agents carry a task through stages while the operator keeps control. The run is
reduced to one question at a time: the **decision card** at the top of the run
page asks for exactly what is needed (approve, provide input, choose an agent,
or retry), and the Decisions page collects all such questions across projects.
Audit detail sits one level down: attempts, prompts, outputs, the routing
scoreboard, and the verified event log are expanded on request. A board card
shows only the current stage and whether the run needs the operator.

Run state is computed only from the hash-chained event log, so what the
interface shows can always be traced to recorded events. Routing explains
itself with a scoreboard rather than a bare choice. Pipelines and agents are
configuration and appear outside the main flow.

## Visual direction

The board is the central working surface. A narrow navy rail keeps projects
available while a quiet, cool white canvas puts attention on task titles. Blue
marks selected actions; amber and coral identify waiting and urgent work.

Tokens: canvas `#f5f7fb`, surface `#ffffff`, ink `#19263c`, rail `#182b49`,
action `#3265df`, muted `#69788f`. Status colors carry meaning, not decoration.
Segoe UI (with native sans-serif fallbacks) gives the interface familiar, legible
text without a font download. Titles use 28px, section titles 18px, body 14px,
and metadata 12px. Text is left aligned.

```text
Projects rail | Search                          New task
              | Project title / progress
              | Board / List     Owner / Priority filters
              | Backlog | In progress | Blocked | Done
```

Overview uses project rows and an attention list instead of unrelated charts.
The empty workspace offers project creation and an explicitly chosen example.
The task editor is a drawer so the board remains in context. On mobile the rail
collapses, the task list remains readable, and the board scrolls horizontally.

The first design review removed ornamental metrics and a marketing hero: the
application must open directly on work. Every count is computed from saved tasks.
Keyboard focus, labeled controls, dialog focus management, plain text rendering,
and reduced motion are required throughout.
