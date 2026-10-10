import { answer, at, blocked, card, data, HANDOFF, kase, ME, more, open, owner, proc, rules, task } from '../corpus.mjs';

// Row 2: the caller holds a blocked task, by the board or by its trail's
// newest entry. See whether what blocks it has cleared.

const TITLE = 'Train the folds';

export default [
  kase({
    name: 'dead-blocked',
    rows: [2],
    story: 'The holding session wrote a blocked entry and is gone. On the board the task is still in progress: check whether it can unblock, from the entry.',
    commits: [
      { at: at('09:30', 1), ops: [task('T001', TITLE)] },
      { at: at('08:00'), subject: 'claim T001', ops: [task('T001', TITLE, { at: 'tasks', owner: owner(ME) })] },
    ],
    tree: { trails: { T001: [
      open(at('08:00'), ME, proc(4001, 'Sat Oct 10 07:58:00 2026')),
      blocked(at('09:00'), ME, { what: 'the GPU quota is spent', unblocks: 'the GPU quota is raised', next: 'rerun fold 2' }),
    ] } },
    call: { run: 'dddd4444' },
    answer: answer({
      next: { do: 'check-unblock', task: 'T001', reasons: ['blocked'], rule: [8] },
      rules: rules({ used: 1 }),
      you: [{ task: 'T001', column: 'in_progress' }],
      data: data({ T001: card('T001', TITLE, { next: 'rerun fold 2', blocked: 'the GPU quota is raised', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'blocked-no-trail',
    rows: [2],
    story: 'A task the caller holds is blocked on the board and has no trail: check whether it can unblock, from its blockedReason.',
    commits: [
      { at: at('09:30', 1), ops: [task('T001', TITLE)] },
      { at: at('08:00'), subject: 'claim T001', ops: [task('T001', TITLE, { at: 'tasks', owner: owner(ME) })] },
      { at: at('09:00'), subject: 'block T001', ops: [task('T001', TITLE, { at: 'blocked', owner: owner(ME), blockedReason: "waiting on the vendor's API key" })] },
    ],
    answer: answer({
      next: { do: 'check-unblock', task: 'T001', reasons: ['blocked'], rule: [8] },
      rules: rules({ used: 1, blocked: 1 }),
      you: [{ task: 'T001', column: 'blocked' }],
      data: data({ T001: card('T001', TITLE, { blocked: "waiting on the vendor's API key", handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),
];
