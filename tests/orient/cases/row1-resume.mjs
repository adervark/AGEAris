import { answer, at, card, data, did, doing, end, HANDOFF, kase, ME, more, open, OTHER_BOOT, owner, proc, rules, task } from '../corpus.mjs';

// Row 1: the caller holds the task, and a run on it stopped mid-act: closed,
// with a doing as its newest entry. Resume, checking that act's tell first.

const TITLE = 'Train the folds';
const NEW = 'dddd4444';   // the caller: a new session of the same operator
const claimed = [
  { at: at('09:30', 1), ops: [task('T001', TITLE)] },
  { at: at('08:00'), subject: 'claim T001', ops: [task('T001', TITLE, { at: 'tasks', owner: owner(ME) })] },
];
const mine = [{ task: 'T001', column: 'in_progress' }];
const resume = (run, by, since) => ({ do: 'resume', task: 'T001', run, by, since, verify: 'tell', reasons: ['stopped-mid-act'], rule: [3, 6, 8] });
const stopped = (run, by, since) => ({ task: 'T001', run, kind: 'doing', since, state: 'closed', by });

export default [
  kase({
    name: 'dead-doing',
    rows: [1],
    story: 'The session holding the task is gone, its process with it, and its newest entry is a doing: resume, checking the tell first.',
    commits: claimed,
    tree: { trails: { T001: [
      open(at('09:00'), ME, proc(4001, 'Sat Oct 10 08:55:00 2026')),
      doing(at('09:30'), ME, { act: 'train fold 0, ~2 h GPU', tell: 'outputs/fold0/last.ckpt exists', cost: '2 GPU-h', next: 'collect fold 0' }),
    ] } },
    call: { run: NEW },
    answer: answer({
      next: resume(ME, 'process', at('09:30')),
      rules: rules({ used: 1 }),
      you: mine,
      inFlight: [stopped(ME, 'process', at('09:30'))],
      data: data({ T001: card('T001', TITLE, { next: 'collect fold 0', act: 'train fold 0, ~2 h GPU', tell: 'outputs/fold0/last.ckpt exists', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'crashed-a-minute-ago',
    rows: [1],
    story: 'The session crashed two minutes after starting an act. The clock alone would call it running; its process is gone, so it is closed.',
    commits: claimed,
    tree: { trails: { T001: [
      open(at('11:30'), ME, proc(4001, 'Sat Oct 10 11:29:30 2026')),
      doing(at('11:58'), ME, { act: 'migrate the cache to v2', tell: 'cache/v2/MANIFEST exists' }),
    ] } },
    call: { run: NEW },
    answer: answer({
      next: resume(ME, 'process', at('11:58')),
      rules: rules({ used: 1 }),
      you: mine,
      inFlight: [stopped(ME, 'process', at('11:58'))],
      data: data({ T001: card('T001', TITLE, { act: 'migrate the cache to v2', tell: 'cache/v2/MANIFEST exists', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'dead-doing-clock',
    rows: [1],
    story: 'A run with no process record, as a ckpt.sh from before T070 writes it, last heard an hour ago: the clock closes it. Its doing names the act in what, not act. Its until of 24:00 does not read back as a time, so it does not count.',
    commits: claimed,
    tree: { trails: { T001: [
      open(at('10:30'), ME),
      doing(at('11:00'), ME, { what: 'rebuild the index', tell: 'index/READY exists', until: '2026-10-10T24:00:00Z', next: 'check the index' }),
    ] } },
    call: { run: NEW },
    answer: answer({
      next: resume(ME, 'clock', at('11:00')),
      rules: rules({ used: 1 }),
      you: mine,
      inFlight: [stopped(ME, 'clock', at('11:00'))],
      data: data({ T001: card('T001', TITLE, { next: 'check the index', act: 'rebuild the index', tell: 'index/READY exists', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'doing-past-until',
    rows: [1],
    story: 'A doing on another machine said it would run until 10:00. That has passed, and its process cannot be checked from here, though a process here has its pid and start: the clock closes it.',
    commits: claimed,
    tree: { trails: { T001: [
      open(at('07:50'), ME, proc(7001, 'Sat Oct 10 07:45:00 2026', OTHER_BOOT)),
      doing(at('08:00'), ME, { act: 'fold 1, ~2 h GPU', tell: 'outputs/fold1/last.ckpt exists', until: at('10:00') }),
    ] } },
    view: { alive: [{ pid: 7001, lstart: 'Sat Oct 10 07:45:00 2026' }] },
    call: { run: NEW },
    answer: answer({
      next: resume(ME, 'clock', at('08:00')),
      rules: rules({ used: 1 }),
      you: mine,
      inFlight: [stopped(ME, 'clock', at('08:00'))],
      data: data({ T001: card('T001', TITLE, { act: 'fold 1, ~2 h GPU', tell: 'outputs/fold1/last.ckpt exists', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'older-run-dead-doing',
    rows: [1],
    story: 'An older run stopped mid-act and was never reaped. A later run worked and ended after it. Row 1 names the older run (design N4).',
    commits: claimed,
    tree: { trails: { T001: [
      open(at('08:00'), ME, proc(4001, 'Sat Oct 10 07:55:00 2026')),
      doing(at('08:10'), ME, { act: 'fold 3, ~1 h GPU', tell: 'outputs/fold3/last.ckpt exists', next: 'collect fold 3' }),
      open(at('10:00'), 'bbbb2222', proc(4101, 'Sat Oct 10 09:58:00 2026')),
      did(at('10:30'), 'bbbb2222', { what: 'wrote the report skeleton', next: 'fill in fold 3' }),
      end(at('10:40'), 'bbbb2222', { left: 'report skeleton in docs/report.md' }),
    ] } },
    call: { run: NEW },
    answer: answer({
      next: resume(ME, 'process', at('08:10')),
      rules: rules({ used: 1 }),
      you: mine,
      inFlight: [stopped(ME, 'process', at('08:10'))],
      data: data({ T001: card('T001', TITLE, { next: 'fill in fold 3', act: 'fold 3, ~1 h GPU', tell: 'outputs/fold3/last.ckpt exists', left: 'report skeleton in docs/report.md', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'own-run-resumed',
    rows: [1],
    story: 'The caller is its own run, resumed in a new process. In the old one it stopped mid-act: it resumes its own run.',
    commits: claimed,
    tree: { trails: { T001: [
      open(at('09:00'), ME, proc(4001, 'Sat Oct 10 08:55:00 2026')),
      doing(at('09:20'), ME, { act: 'export the dataset', tell: 'exports/ds.parquet exists', next: 'check the export' }),
    ] } },
    view: { alive: [{ pid: 5001, lstart: 'Sat Oct 10 11:50:00 2026' }] },
    call: { run: ME },
    answer: answer({
      next: resume(ME, 'process', at('09:20')),
      rules: rules({ used: 1 }),
      you: mine,
      inFlight: [stopped(ME, 'process', at('09:20'))],
      data: data({ T001: card('T001', TITLE, { next: 'check the export', act: 'export the dataset', tell: 'exports/ds.parquet exists', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'pid-reused',
    rows: [1],
    story: 'The recorded pid is alive again, but it started later: another process has the number. The run is closed.',
    commits: claimed,
    tree: { trails: { T001: [
      open(at('09:00'), ME, proc(4001, 'Sat Oct 10 08:55:00 2026')),
      doing(at('09:20'), ME, { act: 'compress the archive', tell: 'archive.tar.zst exists' }),
    ] } },
    view: { alive: [{ pid: 4001, lstart: 'Sat Oct 10 11:00:00 2026' }] },
    call: { run: NEW },
    answer: answer({
      next: resume(ME, 'process', at('09:20')),
      rules: rules({ used: 1 }),
      you: mine,
      inFlight: [stopped(ME, 'process', at('09:20'))],
      data: data({ T001: card('T001', TITLE, { act: 'compress the archive', tell: 'archive.tar.zst exists', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'two-stopped-runs',
    rows: [1],
    story: "Two of the operator's sessions stopped mid-act on the task. Row 1 names the one whose newest entry comes latest in the file, though the other's is later by the clock.",
    commits: claimed,
    tree: { trails: { T001: [
      open(at('08:00'), ME, proc(4001, 'Sat Oct 10 07:58:00 2026')),
      open(at('08:30'), 'bbbb2222', proc(4101, 'Sat Oct 10 08:28:00 2026')),
      doing(at('09:10'), 'bbbb2222', { act: 'fold 5, ~1 h GPU', tell: 'outputs/fold5/last.ckpt exists', next: 'collect fold 5' }),
      doing(at('09:00'), ME, { act: 'fold 4, ~1 h GPU', tell: 'outputs/fold4/last.ckpt exists', next: 'collect fold 4' }),
    ] } },
    call: { run: NEW },
    answer: answer({
      next: resume(ME, 'process', at('09:00')),
      rules: rules({ used: 1 }),
      you: mine,
      inFlight: [stopped(ME, 'process', at('09:00')), stopped('bbbb2222', 'process', at('09:10'))],
      data: data({ T001: card('T001', TITLE, { next: 'collect fold 4', act: 'fold 4, ~1 h GPU', tell: 'outputs/fold4/last.ckpt exists', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'resume-before-continue',
    rows: [1],
    story: 'The caller holds T001, in progress and quiet, and T002, whose run stopped mid-act. Rows come before tasks: row 1 for T002 wins over row 3 for T001, though T001 comes first by id.',
    commits: [
      { at: at('09:30', 1), ops: [task('T001', TITLE), task('T002', 'Score the folds')] },
      { at: at('08:00'), subject: 'claim T001', ops: [task('T001', TITLE, { at: 'tasks', owner: owner(ME) })] },
      { at: at('08:05'), subject: 'claim T002', ops: [task('T002', 'Score the folds', { at: 'tasks', owner: owner(ME) })] },
    ],
    tree: { trails: { T002: [
      open(at('09:00'), ME, proc(4002, 'Sat Oct 10 08:58:00 2026')),
      doing(at('09:30'), ME, { act: 'score folds 0 to 4, ~1 h', tell: 'outputs/scores.csv exists', next: 'check the scores' }),
    ] } },
    call: { run: NEW },
    answer: answer({
      next: { ...resume(ME, 'process', at('09:30')), task: 'T002' },
      rules: rules({ used: 2 }),
      you: [{ task: 'T001', column: 'in_progress' }, { task: 'T002', column: 'in_progress' }],
      inFlight: [{ ...stopped(ME, 'process', at('09:30')), task: 'T002' }],
      data: data({
        T002: card('T002', 'Score the folds', { next: 'check the scores', act: 'score folds 0 to 4, ~1 h', tell: 'outputs/scores.csv exists', handoff: HANDOFF }),
        T001: card('T001', TITLE),
      }),
      more: more('T002'),
    }),
  }),
];
