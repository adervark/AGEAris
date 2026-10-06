// The sample project: six weeks of simulated history, written through the
// fabricator so every commit, date, and frontmatter field is what a real
// project would have. It shows every kind of item Today can raise: a stale
// agent claim, a human claim aging quietly, unassigned urgent work, blocked
// work (one reason only in a checkpoint), slips, reopens, a dropped task, an
// agent's branch merged by a person, and a date at risk. Every commit is the
// workspace operator's; agents differ only by their `@k/<session>` owner lines.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const TYPES = ['feature', 'bug', 'doc'];
const PEOPLE = ['Ana', 'Ben', 'Mira'];
export const SAMPLE_NAME = 'Sample: Atlas launch';
export const SAMPLE_DESCRIPTION = 'Sample project — its history is simulated. Explore Home, the project’s Flow and Method tabs, and the Explain panel behind every number; delete the project folder any time.';

// A small deterministic generator (mulberry32), so a given `now` always gives
// the same history.
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const isoMinute = (ms) => `${new Date(ms).toISOString().slice(0, 16)}:00Z`;
const dateOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const quote = (text) => JSON.stringify(text);

// Moves a time off the weekend (UTC), to the Friday before or the Monday after.
function weekday(ms, later = true) {
  const day = new Date(ms).getUTCDay();
  if (day === 6) return ms + (later ? 2 : -1) * DAY_MS;
  if (day === 0) return ms + (later ? 1 : -2) * DAY_MS;
  return ms;
}

// The first commit's time: 08:00 UTC six weeks before `now`.
export function sampleStart(now) {
  return Date.parse(`${dateOf(now - 42 * DAY_MS)}T08:00:00Z`);
}

// The sample's history as fabricator lines. The first commit writes
// project.json (`project`) and `files` (the AA board's template and settings).
// Returns the epoch the fabricator needs and the script.
export function sampleScript({ project, now, operator, files }) {
  const nowMs = typeof now === 'number' ? now : Date.parse(now);
  const rand = random(7);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const session = () => Math.floor(rand() * 0xffffffff).toString(16).padStart(8, '0');
  const start = sampleStart(nowMs);
  // Everything lands at least two minutes before `now`.
  const latest = nowMs - 2 * 60 * 1000;
  const events = [];
  const at = (ms, line, extra = []) => events.push({ ms: Math.min(ms, latest), lines: [line, ...extra] });
  const op = (text) => `${operator}: ${text}`;
  const ui = (title, ms) => `${operator} @agesight/web ${dateOf(ms)} — working on ${title}`;
  const agent = (id, ms, sessionId) => `${operator} @k/${sessionId} ${dateOf(ms)} — ${id}`;

  at(start, op(`project ${JSON.stringify(project)}`), Object.entries(files).map(([path, content]) => `+ write ${path} ${quote(content)}`));

  // Finished flow work: 28 tasks over five weeks, cycle times mostly 3–7 days.
  const cycles = [3, 4, 5, 6, 3, 4, 7, 5, 2, 4, 6, 5, 3, 8, 4, 5, 6, 3, 1, 5, 4, 6, 7, 3, 5, 4, 6, 2];
  for (let index = 0; index < cycles.length; index += 1) {
    const id = `T${String(index + 1).padStart(3, '0')}`;
    const type = TYPES[index % 3];
    const title = `${type === 'bug' ? 'Fix' : type === 'doc' ? 'Document' : 'Build'} ${['search', 'export', 'billing', 'login', 'import', 'sharing', 'reports'][index % 7]} ${['flow', 'edge cases', 'settings', 'limits'][index % 4]}`;
    const created = weekday(start + (1 + index * 1.15) * DAY_MS + (index % 5) * HOUR_MS);
    const started = weekday(created + (1 + (index % 2)) * DAY_MS + 2 * HOUR_MS);
    let finished = weekday(started + cycles[index] * DAY_MS + (index % 3) * HOUR_MS);
    if (finished > latest - 6 * HOUR_MS) finished = latest - (6 + index) * HOUR_MS;
    const viaAgent = index % 3 === 1;
    at(created, op(`create ${id} backlog ${quote(title)} ${JSON.stringify({ type, priority: pick(['low', 'medium', 'medium', 'high']) })} via=ui`));
    if (viaAgent) {
      const sessionId = session();
      at(started, op(`move ${id} tasks ${JSON.stringify({ owner: agent(id, started, sessionId) })}`));
      at(started + 3 * HOUR_MS, op(`ckpt ${id} did ${quote('first pass done')} ts=${isoMinute(started + 3 * HOUR_MS)} session=${sessionId}`));
    } else {
      at(started, op(`move ${id} tasks ${JSON.stringify({ owner: ui(title, started), assignee: PEOPLE[index % 3] })} via=ui`));
    }
    at(finished, op(`move ${id} done${viaAgent ? '' : ' via=ui'}`));
    // Two items come back after they were finished, and are finished again.
    if (index === 4 || index === 11) {
      const reopened = Math.min(finished + DAY_MS, latest - 5 * HOUR_MS);
      at(reopened, op(`move ${id} tasks ${JSON.stringify({ priority: 'high' })} via=ui`));
      at(Math.min(reopened + 2 * DAY_MS, latest - 4 * HOUR_MS), op(`move ${id} done via=ui`));
    }
  }

  const ago = (hours) => nowMs - hours * HOUR_MS;
  const inDays = (days) => dateOf(nowMs + days * DAY_MS);

  // Blocked, with its reason in the task.
  at(ago(24 * 9), op(`create T029 backlog ${quote('Payment retries')} ${JSON.stringify({ type: 'feature', priority: 'high' })} via=ui`));
  at(ago(24 * 7), op(`move T029 tasks ${JSON.stringify({ owner: ui('Payment retries', ago(24 * 7)), assignee: 'Ana' })} via=ui`));
  at(ago(24 * 3), op(`move T029 blocked ${JSON.stringify({ blockedReason: "Waiting on the payment vendor's sandbox keys" })} via=ui`));
  // Blocked by an agent, with its reason only in the checkpoint trail.
  const importer = session();
  at(ago(24 * 8), op(`create T030 backlog ${quote('Importer for legacy CSV')} ${JSON.stringify({ type: 'feature' })} via=ui`));
  at(ago(24 * 5), op(`move T030 tasks ${JSON.stringify({ owner: agent('T030', ago(24 * 5), importer) })}`));
  at(ago(50), op(`move T030 blocked`), [`+ ckpt T030 blocked ${quote('Staging database access has not been granted')} ts=${isoMinute(ago(50))} session=${importer}`]);
  at(ago(2), op(`ckpt T030 did ${quote('asked ops for staging access again')} ts=${isoMinute(ago(2))} session=${importer}`));

  // Slips: two dates moved later, one cleared.
  at(ago(24 * 12), op(`create T031 backlog ${quote('Onboarding emails')} ${JSON.stringify({ type: 'feature', dueDate: inDays(-2) })} via=ui`));
  at(ago(24 * 4), op(`set T031 ${JSON.stringify({ dueDate: inDays(9) })} via=ui`));
  at(ago(24 * 11), op(`create T032 backlog ${quote('Usage dashboard')} ${JSON.stringify({ type: 'feature', dueDate: inDays(3) })} via=ui`));
  at(ago(24 * 2), op(`set T032 ${JSON.stringify({ dueDate: '' })} via=ui`));
  at(ago(24 * 10), op(`create T033 backlog ${quote('API reference')} ${JSON.stringify({ type: 'doc', dueDate: inDays(-1) })} via=ui`));
  at(ago(24 * 1.5), op(`set T033 ${JSON.stringify({ dueDate: inDays(6) })} via=ui`));

  // Dropped: removed from scope, never a finish.
  at(ago(24 * 20), op(`create T034 backlog ${quote('Fax export')} ${JSON.stringify({ type: 'feature' })} via=ui`));
  at(ago(24 * 8), op(`kill T034 via=ui`));

  // A stale agent claim: the only recent commit is a UI edit, which is no
  // sign of the agent's life.
  const quiet = session();
  at(ago(24 * 6), op(`create T035 backlog ${quote('Search index rebuild')} ${JSON.stringify({ type: 'bug' })} via=ui`));
  at(ago(24 * 4), op(`move T035 tasks ${JSON.stringify({ owner: agent('T035', ago(24 * 4), quiet) })}`));
  at(ago(24 * 3.5), op(`ckpt T035 did ${quote('reproduced the slow rebuild')} ts=${isoMinute(ago(24 * 3.5))} session=${quiet}`));
  at(ago(2), op(`set T035 ${JSON.stringify({ priority: 'high' })} via=ui`));

  // A person's claim, idle for three days: aging, never stale.
  at(ago(24 * 14), op(`create T036 backlog ${quote('Accessibility audit')} ${JSON.stringify({ type: 'doc' })} via=ui`));
  at(ago(24 * 12), op(`move T036 tasks ${JSON.stringify({ owner: ui('Accessibility audit', ago(24 * 12)), assignee: 'Mira' })} via=ui`));
  at(ago(24 * 3), op(`set T036 ${JSON.stringify({ priority: 'medium' })} via=ui`));

  // Claimed in AGE Aris with nobody assigned: unassigned urgent work.
  at(ago(30), op(`create T037 backlog ${quote('Rotate leaked API token')} ${JSON.stringify({ type: 'bug', priority: 'urgent' })} via=ui`));
  at(ago(26), op(`move T037 tasks ${JSON.stringify({ owner: ui('Rotate leaked API token', ago(26)) })} via=ui`));

  // An agent's claim made on a branch and merged by a person.
  const brancher = session();
  const fork = ago(24 * 2 + 1);
  at(ago(24 * 3), op(`create T038 backlog ${quote('Rate limiting')} ${JSON.stringify({ type: 'feature' })} via=ui`));
  at(fork, 'branch agent-t038', [
    `${isoMinute(fork + 10 * 60 * 1000)} ${op(`move T038 tasks ${JSON.stringify({ owner: agent('T038', fork, brancher) })}`)}`,
    `${isoMinute(fork + 40 * 60 * 1000)} ${op(`ckpt T038 did ${quote('token bucket in place')} ts=${isoMinute(fork + 40 * 60 * 1000)} session=${brancher}`)}`,
    'checkout main',
    `${isoMinute(fork + 60 * 60 * 1000)} ${op('merge agent-t038')}`,
  ]);
  at(ago(3), op(`ckpt T038 did ${quote('limits configurable per key')} ts=${isoMinute(ago(3))} session=${brancher}`));

  // A date at risk: just started, due in two days, and work like it usually
  // takes longer.
  const rushed = session();
  at(ago(24 * 2), op(`create T039 backlog ${quote('Status page')} ${JSON.stringify({ type: 'feature', dueDate: inDays(2), priority: 'high' })} via=ui`));
  at(ago(20), op(`move T039 tasks ${JSON.stringify({ owner: agent('T039', ago(20), rushed) })}`));
  at(ago(4), op(`ckpt T039 did ${quote('layout drafted')} ts=${isoMinute(ago(4))} session=${rushed}`));

  // Overdue and urgent.
  at(ago(24 * 9), op(`create T040 backlog ${quote('Fix invoice rounding')} ${JSON.stringify({ type: 'bug', priority: 'urgent', dueDate: inDays(-2) })} via=ui`));
  at(ago(24 * 6), op(`move T040 tasks ${JSON.stringify({ owner: ui('Fix invoice rounding', ago(24 * 6)), assignee: 'Ben' })} via=ui`));

  // The backlog.
  at(ago(24 * 5), op(`create T041 backlog ${quote('Dark mode')} ${JSON.stringify({ type: 'feature', priority: 'low' })} via=ui`));
  at(ago(24 * 4), op(`create T042 backlog ${quote('Bulk archive')} ${JSON.stringify({ type: 'feature' })} via=ui`));
  at(ago(24 * 1), op(`create T043 backlog ${quote('Release notes for 2.0')} ${JSON.stringify({ type: 'doc', dueDate: inDays(12) })} via=ui`));

  events.sort((a, b) => a.ms - b.ms);
  const script = events.map(({ ms, lines }) => {
    const [first, ...rest] = lines;
    // A directive line (branch) carries no time; its commits carry their own.
    return [/^(branch|checkout|ff) /.test(first) ? first : `${isoMinute(ms)} ${first}`, ...rest].join('\n');
  }).join('\n');
  return { epoch: new Date(start).toISOString(), script };
}
