# Seeing the work: what Scrum masters use, and what AGE Aris should draw

*T029, 2026-10-08. A proposal for the operator to choose from; nothing here
is built yet. Sources are listed at the end.*

## The question

The operator asked for better visualisation, informed by the charts, metrics
and numbers Scrum masters actually use. This page records what practitioners
use, what each chart answers, how they criticise it, and whether AGE Aris's
git ledger can draw it. It ends with a ranked list.

## What AGE Aris draws today

- **Flow tab:** KPI tiles (throughput, WIP, cycle and lead time with their 85th
  percentiles, blocked time); two 6-week bar series (finished per day; WIP per
  day against the limit); risk and load tables; the history behind each number.
- **Home:** a four-week throughput sparkline per project.
- **Elsewhere:** tables and badges (aging, stale, blocked, overdue). Every
  number opens Explain.

So the numbers are there, mostly as tiles and tables. The *shapes* that
practitioners read at a glance are not.

## What practitioners use

### The four flow metrics (Scrum.org's Kanban Guide for Scrum Teams)

WIP, cycle time, throughput and **work item age**. Throughput counts items and
ignores size, which is "a major difference" from story-point velocity
([Scrum.org][s-4metrics], [kollabe][kollabe]). Cycle time is a lagging
indicator, known only once an item is finished. Work item age is its leading
counterpart, "the one metric you should check daily" ([kollabe][kollabe]).
AGE Aris already computes all four.

### Charts, by the Scrum event that uses them

| Scrum event | Question | Chart practitioners use | Sources |
|---|---|---|---|
| Daily Scrum | What is not moving? | **Aging WIP chart**: each open item a dot, by stage and age, over bands from past cycle times | [ActionableAgile][aa-aging], [Nave][nave], [Actineo][actineo], [Scrum.org][s-4metrics] |
| Sprint Planning | How many can we take? | **Throughput history** ("yesterday's weather"), **Monte Carlo: how many** | [Scrum.org forum][s-forum], [ActionableAgile][aa-mc] |
| Sprint Review / stakeholders | When will it be done? Did scope grow? | **Monte Carlo: when**; **burnup** (done against scope) | [ActionableAgile][aa-mc], [Brodzinski][burnup] |
| Retrospective | Is our process predictable? Where does work pile up? | **Cycle-time scatterplot** with 50/85/95% lines; **cumulative flow diagram**; **process behaviour chart** | [Scrum.org][s-scatter], [CFD guides][cfd], [ActionableAgile][aa-pbc] |
| Anywhere | What is blocked, and for how long? | **Impediment age**, blocked time per item | [3Cloud][impediment], [Azure DevOps][ado] |

### What the tools ship

- **Jira:** burndown, burnup, sprint report and velocity on Scrum boards;
  control chart (cycle time) and CFD on both board types
  ([Atlassian][jira]).
- **Linear:** a cycle graph of progress, effort and scope over time, plus
  Insights. Third parties add burndown, CFD and velocity ([Linear][linear]).
- **ActionableAgile (Vacanti's tool):** aging WIP, cycle-time scatterplot,
  CFD, throughput run chart, Monte Carlo when and how many, and process
  behaviour charts ([55 Degrees][aa-aging]).

### What practitioners warn against

- **Velocity as a score.** "It is a metric to measure capacity, not
  productivity," and rising velocity is not success ([Scrum.org][s-velocity]).
  Do not share it in reports; it becomes a vanity metric
  ([Scrum.org forum][s-forum]).
- **Burndown hides scope.** It shows only what remains, so work finished and
  work added on the same day cancel out. Use a burnup when scope changes
  ([Brodzinski][burnup], [ProjectManagement.com][pmc]). A burndown also
  cannot show work in progress.
- **None of these charts is mandatory.** Scrum prescribes no burndown, burnup
  or CFD; keep what drives a conversation ([Scrum.org][s-myths]).
- **Metrics as pressure.** Keep the dashboard small, tie each chart to a
  decision, and never rank teams with it ([Axify][axify],
  [resumelens][resumelens]).
- **CFD mistakes.** A CFD must be cumulative, must keep waiting states,
  should have five or six bands at most, and without WIP limits "will just
  show growing chaos" ([CFD guides][cfd]).

## Fit with AGE Aris

AGE Aris's method is flow: WIP limits, cycle time, a service level, aging WIP.
The AA convention has **no sprints, estimates or velocity**
(`docs/PLUGIN.md`). The charts practitioners rate highest (aging WIP,
scatterplot, CFD, Monte Carlo, burnup by item count) need none of those.
The charts they criticise most (velocity, burndown, story points) are the
ones AGE Aris should not draw. That is a position worth stating on the
Method view, not an omission.

AGE Aris also has data most teams lack, and a chart can use it:

- **Agents checkpoint before and after work.** That gives real touch time,
  where flow efficiency usually fails for lack of reliable state data.
- **Pipeline gates record when work waited on a person.** So "waiting on you"
  can be drawn as time.
- **Every point is a commit.** Any dot can open the task and the commits
  behind it, through the existing Explain drawer.

What the ledger holds: per task, created, every status change (backlog, in
progress, blocked, done, dropped), blocked reasons, owner (agent or person),
milestone and due date, checkpoint signs of life; per run, stages, gates and
approvals. All with commit times (`lib/history.mjs`, `lib/metrics.mjs`).

## Proposal, ranked

Each is inline SVG drawn like `seriesChart` (no library, CSP-safe, classes
for colour), each point a button that opens the task, and each chart has a
one-line plain meaning and an Explain link, as everywhere else.

1. **Aging WIP chart** (Flow tab, and Home's "Needs you" in small).
   - **Draws:** each open task as a dot: x is its column (In progress,
     Blocked), y its age. Background bands at the 50th, 70th, 85th and 95th
     percentiles of finished cycle times. Agent claims show their last sign
     of life, and stale ones are marked.
   - **Answers:** the Daily Scrum's "what is not moving?".
   - **Data:** `aging`, `cycles()`, stale claims; all present.
   - **Cost:** small.
2. **Cycle-time scatterplot** (Flow tab).
   - **Draws:** each finished task as a dot: x its finish date, y its cycle
     time. Lines at the 50th, 85th and 95th percentiles, the 85th labelled as
     the service level. Sweeps are excluded and say so.
   - **Answers:** "how long does a task take here, and is it changing?" It
     also forecasts a single task.
   - **Data:** `cycles()`; present.
   - **Cost:** small.
3. **Forecast** (project header and Flow).
   - **Draws:** a Monte Carlo over the last weeks' daily throughput, in two
     forms. *When:* "the 9 tasks in the backlog: 50% by 21 Oct, 85% by
     30 Oct". *How many by a date:* "by 31 Oct: 85% likely at least 7".
   - **Answers:** the stakeholder's "when?", with no estimates, just
     history. It also replaces guesswork on due-date risk.
   - **Data:** `throughput_series`.
   - **Cost:** medium (the simulation is ~40 lines; it must be seeded so a
     number is reproducible and explainable).
4. **Cumulative flow diagram** (Flow tab).
   - **Draws:** Backlog, In progress, Blocked and Done stacked over time; the
     WIP limit marked.
   - **Answers:** whether work is arriving faster than it finishes, and
     where it piles up.
   - **Data:** status transitions; present.
   - **Cost:** medium.
5. **Burnup by item count** (per milestone, or the whole project).
   - **Draws:** a done line against a scope line, where scope is items
     created in the milestone, and growth shows.
   - **Answers:** the Sprint Review's "did scope grow, and are we
     converging?", without points.
   - **Data:** milestone, created, done; present where milestones are used.
   - **Cost:** small.
6. **Where a task's time went** (task drawer).
   - **Draws:** one horizontal bar per task, split into In progress, Blocked
     and Waiting on you (gates). Agent touch time from checkpoints shows as
     a darker part.
   - **Answers:** "why did this take so long?", the retrospective at task
     level.
   - **Data:** transitions, runs, trails; present.
   - **Cost:** medium.
7. **Process behaviour chart** for throughput and cycle time.
   - **Draws:** natural process limits on the existing series, so a spike is
     called signal or noise.
   - **Answers:** "is this week unusual?" (Vacanti's newer work).
   - **Cost:** medium, and it needs 20+ points, so later.

**Not proposed:** velocity, story points, burndown, and sprint reports. Also
team rankings and health surveys (Spotify's squad health check is a team
conversation, not a chart AGE Aris can draw from git).

## Suggested first slice

The first slice is items 1, 2 and 3: aging WIP, the scatterplot and the
forecast. Together they cover the daily, the retrospective and the
stakeholder question, from data AGE Aris already computes, and they are the
three charts flow coaches put first. Each would be one AA task with its own
decision rules, registered when the operator chooses.

## Sources

[s-4metrics]: https://www.scrum.org/resources/blog/4-key-flow-metrics-and-how-use-them-scrums-events
[s-scatter]: https://www.scrum.org/resources/blog/when-story-points-arent-enough
[s-velocity]: https://www.scrum.org/node/6970
[s-myths]: https://www.scrum.org/node/5717
[s-forum]: https://www.scrum.org/node/78731
[kollabe]: https://kollabe.com/posts/flow-metrics-for-scrum-teams
[aa-aging]: https://55degrees.atlassian.net/wiki/spaces/AAS/pages/2454290433/Aging+Work+in+Progress
[aa-mc]: https://55degrees.atlassian.net/wiki/spaces/AAS/pages/2405826697/Monte+Carlo+When
[aa-pbc]: https://55degrees.atlassian.net/wiki/spaces/AAS/pages/699236831/Process+Behavior+Chart
[nave]: https://getnave.com/blog/health-zones-aging-chart/
[actineo]: https://actineo.xyz/blog/what-shall-i-work-on-next-using-ageing-charts-in-your-daily-scrum/
[burnup]: https://brodzinski.com/?p=2952
[pmc]: https://www.projectmanagement.com/blog-post/40731/Burndown-vs-Burnup-Chart
[cfd]: https://docondev.substack.com/p/cumulative-flow-diagrams
[impediment]: https://3cloudsolutions.com/?p=11247
[ado]: https://dotnet.territoriali.olinfo.it/en-us/azure/devops/boards/backlogs/manage-issues-impediments
[jira]: https://support.atlassian.com/jira-software-cloud/docs/track-and-analyze-your-teams-work-with-reports/
[linear]: https://linear.app/docs/jira-terminology-translated
[axify]: https://axify.io/blog/scrum-metrics
[resumelens]: https://www.resumelens.org/blog/scrum-master/scrum-master-metrics

- Scrum.org: [4 key flow metrics and Scrum's events][s-4metrics];
  [when story points aren't enough][s-scatter]; [velocity][s-velocity];
  [metrics myths][s-myths]; [forum: metrics][s-forum].
- ActionableAgile (55 Degrees): [aging WIP][aa-aging];
  [Monte Carlo: when][aa-mc]; [process behaviour chart][aa-pbc].
- Other: [kollabe][kollabe], [Nave][nave], [Actineo][actineo],
  [Brodzinski: burnup][burnup], [ProjectManagement.com][pmc], [CFD][cfd],
  [3Cloud: impediments][impediment], [Azure DevOps impediments][ado],
  [Jira reports][jira], [Linear][linear], [Axify][axify],
  [resumelens][resumelens].
- Caveats: several sources are vendor blogs that sell metrics tools. Reddit
  threads could not be found by search, so practitioner opinion here is from
  the Scrum.org forum and practitioner blogs. Vacanti's books were not read
  directly; his methods are described through his tool's documentation.
