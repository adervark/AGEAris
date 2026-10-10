import { answer, at, card, data, kase, more, owner, rules, task } from '../corpus.mjs';

// Row 7: WIP, in progress plus blocked, is at or over a limit above 0. Stop:
// finish or release something before starting (rule 10).

const BEA = owner('cccc3333', { operator: 'bea', profile: 'k' });
const stop = { do: 'stop', reasons: ['wip-full'], rule: [10] };
const T = {
  T002: 'Clean the cache',
  T003: 'Write the changelog',
  T004: 'Tag the release',
  T005: 'Announce the release',
};
const registered = { at: at('09:30', 1), ops: Object.entries(T).map(([id, title]) => task(id, title)) };
const claim = (id, hhmm, options = {}) => ({ at: at(hhmm), by: 'bea', subject: `claim ${id}`, ops: [task(id, T[id], { at: 'tasks', owner: BEA, ...options })] });

export default [
  kase({
    name: 'wip-at-limit',
    rows: [7],
    story: "Another operator's two live claims fill WIP 2/2. The caller holds nothing: stop, though two tasks are ready.",
    commits: [registered, claim('T002', '07:00'), claim('T003', '07:30')],
    answer: answer({
      next: stop,
      rules: rules({ used: 2 }),
      take: [{ task: 'T004', unblocks: 0 }, { task: 'T005', unblocks: 0 }],
      data: data({
        T004: card('T004', T.T004, { folder: 'backlog' }),
        T005: card('T005', T.T005, { folder: 'backlog' }),
      }),
    }),
  }),

  kase({
    name: 'wip-one-blocked',
    rows: [7],
    story: 'One task in progress and one blocked make WIP 2/2: a blocked task still counts against the limit.',
    commits: [
      registered,
      claim('T002', '07:00'),
      claim('T003', '07:30'),
      { at: at('08:00'), by: 'bea', subject: 'block T003', ops: [task('T003', T.T003, { at: 'blocked', owner: BEA, blockedReason: 'waiting on legal' })] },
    ],
    answer: answer({
      next: stop,
      rules: rules({ used: 2, blocked: 1 }),
      take: [{ task: 'T004', unblocks: 0 }, { task: 'T005', unblocks: 0 }],
      data: data({
        T004: card('T004', T.T004, { folder: 'backlog' }),
        T005: card('T005', T.T005, { folder: 'backlog' }),
      }),
    }),
  }),

  kase({
    name: 'wip-over',
    rows: [7],
    story: 'Three tasks in progress against a limit of 2: over the limit, stop.',
    commits: [registered, claim('T002', '07:00'), claim('T003', '07:15'), claim('T004', '07:30')],
    answer: answer({
      next: stop,
      rules: rules({ used: 3 }),
      take: [{ task: 'T005', unblocks: 0 }],
      data: data({ T005: card('T005', T.T005, { folder: 'backlog' }) }),
    }),
  }),
];
