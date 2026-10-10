import { answer, at, data, did, doing, kase, open, owner, proc, rules, task } from '../corpus.mjs';

// Row 9: nothing else applies. Idle, saying whether the backlog is empty or
// holds nothing ready.

const BEA = owner('cccc3333', { operator: 'bea', profile: 'k' });
const idle = (reason) => ({ do: 'idle', reasons: [reason], rule: [] });

export default [
  kase({
    name: 'idle-empty-backlog',
    rows: [9],
    story: 'Everything is done: the backlog is empty.',
    commits: [{ at: at('09:30', 1), ops: [task('T001', 'Set up CI', { at: 'done' })] }],
    answer: answer({ next: idle('empty-backlog') }),
  }),

  kase({
    name: 'idle-none-ready',
    rows: [9],
    story: 'The backlog holds only a task with no decision rule: none is ready.',
    commits: [{ at: at('09:30', 1), ops: [task('T003', 'Plan the migration', { ready: false })] }],
    answer: answer({
      next: idle('none-ready'),
      rules: rules({ notReady: ['T003'] }),
    }),
  }),

  kase({
    name: 'trail-entry-keeps-claim',
    rows: [9],
    story: "Another operator's claim is two days old, but its trail had an entry this morning: a sign of life from anyone, so it is not expired.",
    commits: [
      { at: at('09:30', 1), ops: [task('T002', 'Clean the cache')] },
      { at: at('08:00', 8), by: 'bea', subject: 'claim T002', ops: [task('T002', 'Clean the cache', { at: 'tasks', owner: BEA })] },
    ],
    tree: { trails: { T002: [
      open(at('08:50'), 'cccc3333', { operator: 'bea', profile: 'k' }),
      did(at('09:00'), 'cccc3333', { what: 'listed the cache' }),
    ] } },
    answer: answer({
      next: idle('empty-backlog'),
      rules: rules({ used: 1 }),
    }),
  }),

  kase({
    name: 'running-run-keeps-claim',
    rows: [9],
    story: "Another operator's claim was last heard from two days ago, and its until has run out, but its process still runs here: a running run keeps the claim live whatever the clock says.",
    commits: [
      { at: at('09:30', 1), ops: [task('T002', 'Run the simulation')] },
      { at: at('08:00', 7), by: 'bea', subject: 'claim T002', ops: [task('T002', 'Run the simulation', { at: 'tasks', owner: BEA })] },
    ],
    tree: { trails: { T002: [
      open(at('10:00', 8), 'cccc3333', { operator: 'bea', profile: 'k', ...proc(3001, 'Thu Oct 8 09:59:00 2026') }),
      doing(at('10:05', 8), 'cccc3333', { act: 'a long simulation, ~3 days', tell: 'sim/done exists', until: at('10:05', 11) }),
    ] } },
    view: { alive: [{ pid: 3001, lstart: 'Thu Oct  8 09:59:00 2026' }] },
    answer: answer({
      next: idle('empty-backlog'),
      rules: rules({ used: 1 }),
      inFlight: [{ task: 'T002', run: 'cccc3333', kind: 'doing', since: at('10:05', 8), state: 'running', by: 'process' }],
    }),
  }),
];
