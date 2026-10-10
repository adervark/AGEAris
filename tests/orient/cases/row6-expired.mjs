import { answer, at, card, data, did, kase, more, open, owner, rules, task, trail } from '../corpus.mjs';

// Row 6: another operator's claim has had no sign of life within stale_hours
// (rule 4). Release it, or take it over, before any new work.

const BEA = owner('cccc3333', { operator: 'bea', profile: 'k' });
const CACHE = 'Clean the cache';
const NOTES = 'Write the changelog';
const release = (since) => ({ do: 'release', task: 'T002', since, reasons: ['expired'], rule: [4] });

export default [
  kase({
    name: 'expired-under-limit',
    rows: [6],
    story: "Another operator's claim has had no sign of life for 52 hours. Releasing it comes before new work, under the limit too (rule 4).",
    commits: [
      { at: at('09:30', 1), ops: [task('T002', CACHE), task('T003', NOTES)] },
      { at: at('08:00', 8), by: 'bea', subject: 'claim T002', ops: [task('T002', CACHE, { at: 'tasks', owner: BEA })] },
    ],
    answer: answer({
      next: release(at('08:00', 8)),
      rules: rules({ used: 1 }),
      take: [{ task: 'T003', unblocks: 0 }],
      data: data({
        T002: card('T002', CACHE, { author: 'bea' }),
        T003: card('T003', NOTES, { folder: 'backlog' }),
      }),
      more: more('T002'),
    }),
  }),

  kase({
    name: 'wip-full-expired',
    rows: [6],
    story: 'WIP is full, and one of its two claims has expired: release that before anything else.',
    commits: [
      { at: at('09:30', 1), ops: [task('T002', CACHE), task('T003', NOTES)] },
      { at: at('08:00', 8), by: 'bea', subject: 'claim T002', ops: [task('T002', CACHE, { at: 'tasks', owner: BEA })] },
      { at: at('07:00'), by: 'bea', subject: 'claim T003', ops: [task('T003', NOTES, { at: 'tasks', owner: BEA })] },
    ],
    answer: answer({
      next: release(at('08:00', 8)),
      rules: rules({ used: 2 }),
      data: data({ T002: card('T002', CACHE, { author: 'bea' }) }),
      more: more('T002'),
    }),
  }),

  kase({
    name: 'expired-commit-by-reader-ignored',
    rows: [6],
    story: "The caller edited another operator's stale task 20 hours ago. Commits count only when made by anyone but the reader (rule 4), so the claim is still expired.",
    commits: [
      { at: at('09:30', 1), ops: [task('T002', CACHE)] },
      { at: at('08:00', 8), by: 'bea', subject: 'claim T002', ops: [task('T002', CACHE, { at: 'tasks', owner: BEA })] },
      { at: at('16:00', 9), subject: 'T002: say what clean means', ops: [task('T002', CACHE, { at: 'tasks', owner: BEA, rules: '- Done means: no entry older than 30 days.' })] },
    ],
    answer: answer({
      next: release(at('08:00', 8)),
      rules: rules({ used: 1 }),
      data: data({ T002: card('T002', CACHE) }),
      more: more('T002'),
    }),
  }),

  kase({
    name: 'expired-sweep-ignored',
    rows: [6],
    story: "A third operator's sweeps, a ckpt: commit of the trail and a migrate: commit of the task file, are not signs of life. The trail's entries are, at their own times.",
    commits: [
      { at: at('09:30', 1), ops: [task('T002', CACHE)] },
      { at: at('08:00', 8), by: 'bea', subject: 'claim T002', ops: [task('T002', CACHE, { at: 'tasks', owner: BEA })] },
      { at: at('09:00'), by: 'cara', subject: 'ckpt: T002 trail', ops: [trail('T002', [
        open(at('08:30', 8), 'cccc3333', { operator: 'bea', profile: 'k' }),
        did(at('09:00', 8), 'cccc3333', { what: 'listed the cache', next: 'delete the stale entries' }),
      ])] },
      { at: at('09:30'), by: 'cara', subject: 'migrate: priorities', ops: [task('T002', CACHE, { at: 'tasks', owner: BEA, priority: 'low' })] },
    ],
    answer: answer({
      next: release(at('09:00', 8)),
      rules: rules({ used: 1 }),
      data: data({ T002: card('T002', CACHE, { author: 'cara', next: 'delete the stale entries' }) }),
      more: more('T002'),
    }),
  }),
];
