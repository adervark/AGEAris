import { answer, at, card, data, did, doing, HANDOFF, kase, ME, more, open, OTHER_BOOT, owner, proc, rules, task } from '../corpus.mjs';

// Row 5: the caller holds the task, and another run holds it: a running run
// outside the caller's family, the same operator's included (D4). Wait, and
// name the holder (D6).

const TITLE = 'Migrate the schema';
const NEW = 'dddd4444';
const HOLDER = 'ffff6666';
const claimed = [
  { at: at('09:30', 1), ops: [task('T001', TITLE)] },
  { at: at('08:00'), subject: 'claim T001', ops: [task('T001', TITLE, { at: 'tasks', owner: owner(ME) })] },
];
// held-by-open-session's open writes its pid as 6001.0, as JSON may: the
// whole number 6001.
const PID_WITH_FRACTION = JSON.stringify(open(at('08:50'), HOLDER, proc(6001, 'Fri Oct 9 23:00:00 2026'))).replace('"pid":6001,', '"pid":6001.0,');
const wait = (by, since, until) => ({ do: 'wait', task: 'T001', run: HOLDER, by, since, ...(until ? { until } : {}), reasons: ['held-elsewhere'], rule: [3, 6] });
const heldBy = [{ task: 'T001', column: 'in_progress', heldBy: HOLDER }];

export default [
  kase({
    name: 'held-by-open-session',
    rows: [5],
    story: 'Another session of the same operator has been quiet for three hours, and its process still runs on this machine: running, by its process. ps pads the day of the month; the record does not, and writes its pid as 6001.0, which is the whole number 6001.',
    commits: claimed,
    tree: { trails: { T001: [
      PID_WITH_FRACTION,
      did(at('09:00'), HOLDER, { what: 'drafted the migration', next: 'run the migration dry' }),
    ] } },
    view: { alive: [{ pid: 6001, lstart: 'Fri Oct  9 23:00:00 2026' }] },
    call: { run: NEW },
    answer: answer({
      next: wait('process', at('09:00')),
      rules: rules({ used: 1 }),
      you: heldBy,
      inFlight: [{ task: 'T001', run: HOLDER, kind: 'did', since: at('09:00'), state: 'running', by: 'process' }],
      data: data({ T001: card('T001', TITLE, { next: 'run the migration dry', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'held-by-quiet-session',
    rows: [5],
    story: 'Another session, with no process record, wrote 15 minutes ago: the clock calls it running until 12:15.',
    commits: claimed,
    tree: { trails: { T001: [
      open(at('11:30'), HOLDER),
      did(at('11:45'), HOLDER, { what: 'renamed the tables', next: 'update the views' }),
    ] } },
    call: { run: NEW },
    answer: answer({
      next: wait('clock', at('11:45'), at('12:15')),
      rules: rules({ used: 1 }),
      you: heldBy,
      inFlight: [{ task: 'T001', run: HOLDER, kind: 'did', since: at('11:45'), state: 'running', by: 'clock', until: at('12:15') }],
      data: data({ T001: card('T001', TITLE, { next: 'update the views', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'held-running-silent',
    rows: [5],
    story: 'Another session started a five-hour act at 09:00 that runs until 14:00, and has been silent since: running, by until. Its act and tell are in data.',
    commits: claimed,
    tree: { trails: { T001: [
      open(at('08:50'), HOLDER),
      doing(at('09:00'), HOLDER, { act: 'reindex the archive, ~5 h', tell: 'archive/index.done exists', until: at('14:00') }),
    ] } },
    call: { run: NEW },
    answer: answer({
      next: wait('until', at('09:00'), at('14:00')),
      rules: rules({ used: 1 }),
      you: heldBy,
      inFlight: [{ task: 'T001', run: HOLDER, kind: 'doing', since: at('09:00'), state: 'running', by: 'until', until: at('14:00') }],
      data: data({ T001: card('T001', TITLE, { act: 'reindex the archive, ~5 h', tell: 'archive/index.done exists', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'held-resumed-session',
    rows: [5],
    story: 'Another session was resumed in a new process and has written since, naming it. The newest process record decides: the new process runs, so the session holds the task, though the process its open named is gone and the clock alone would close it.',
    commits: claimed,
    tree: { trails: { T001: [
      open(at('09:00'), HOLDER, proc(6001, 'Sat Oct 10 08:58:00 2026')),
      did(at('09:30'), HOLDER, { what: 'drafted the migration' }),
      did(at('10:15'), HOLDER, { what: 'resumed, and read the plan again', next: 'run the migration dry', ...proc(6002, 'Sat Oct 10 10:14:00 2026') }),
    ] } },
    view: { alive: [{ pid: 6002, lstart: 'Sat Oct 10 10:14:00 2026' }] },
    call: { run: NEW },
    answer: answer({
      next: wait('process', at('10:15')),
      rules: rules({ used: 1 }),
      you: heldBy,
      inFlight: [{ task: 'T001', run: HOLDER, kind: 'did', since: at('10:15'), state: 'running', by: 'process' }],
      data: data({ T001: card('T001', TITLE, { next: 'run the migration dry', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'held-other-machine',
    rows: [5],
    story: 'A session on another machine wrote 10 minutes ago. Its process cannot be checked from here, though a process here has its pid: the clock decides.',
    commits: claimed,
    tree: { trails: { T001: [
      open(at('11:20'), HOLDER, proc(9001, 'Sat Oct 10 11:00:00 2026', OTHER_BOOT)),
      did(at('11:50'), HOLDER, { what: 'split the module', next: 'move the tests' }),
    ] } },
    view: { alive: [{ pid: 9001, lstart: 'Sat Oct 10 07:00:00 2026' }] },
    call: { run: NEW },
    answer: answer({
      next: wait('clock', at('11:50'), at('12:20')),
      rules: rules({ used: 1 }),
      you: heldBy,
      inFlight: [{ task: 'T001', run: HOLDER, kind: 'did', since: at('11:50'), state: 'running', by: 'clock', until: at('12:20') }],
      data: data({ T001: card('T001', TITLE, { next: 'move the tests', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'held-by-two-sessions',
    rows: [5],
    story: "Two other sessions run on the task. The holder is the one whose newest entry comes latest in the file, though the other's is later by the clock.",
    commits: claimed,
    tree: { trails: { T001: [
      open(at('11:30'), 'eeee5555', { profile: 'c' }),
      did(at('11:50'), 'eeee5555', { what: 'wrote the down migration', next: 'test the down migration' }),
      open(at('11:40'), HOLDER),
      did(at('11:45'), HOLDER, { what: 'renamed the tables', next: 'update the views' }),
    ] } },
    call: { run: NEW },
    answer: answer({
      next: wait('clock', at('11:45'), at('12:15')),
      rules: rules({ used: 1 }),
      you: heldBy,
      inFlight: [
        { task: 'T001', run: 'eeee5555', kind: 'did', since: at('11:50'), state: 'running', by: 'clock', until: at('12:20') },
        { task: 'T001', run: HOLDER, kind: 'did', since: at('11:45'), state: 'running', by: 'clock', until: at('12:15') },
      ],
      data: data({ T001: card('T001', TITLE, { next: 'update the views', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'held-until-capped',
    rows: [5],
    story: 'Another session started a thirty-hour act at 09:00 and said it runs until 15:00 tomorrow. An until counts as at most stale_hours past its line: running, by until, until 09:00 tomorrow.',
    commits: claimed,
    tree: { trails: { T001: [
      open(at('08:50'), HOLDER),
      doing(at('09:00'), HOLDER, { act: 'rebuild every index, ~30 h', tell: 'indexes/ALL.done exists', until: at('15:00', 11) }),
    ] } },
    call: { run: NEW },
    answer: answer({
      next: wait('until', at('09:00'), at('09:00', 11)),
      rules: rules({ used: 1 }),
      you: heldBy,
      inFlight: [{ task: 'T001', run: HOLDER, kind: 'doing', since: at('09:00'), state: 'running', by: 'until', until: at('09:00', 11) }],
      data: data({ T001: card('T001', TITLE, { act: 'rebuild every index, ~30 h', tell: 'indexes/ALL.done exists', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),
];
