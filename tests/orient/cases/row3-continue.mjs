import { answer, at, card, data, did, doing, end, HANDOFF, kase, ME, more, open, owner, proc, rules, task } from '../corpus.mjs';

// Row 3: the caller holds a task in progress that no other run holds: continue
// it, from the trail's newest next, else from the Handoff.

const TITLE = 'Write the parser';
const P = 'Sat Oct 10 10:58:00 2026';   // the caller's process, alive
const claimed = [
  { at: at('09:30', 1), ops: [task('T001', TITLE)] },
  { at: at('08:00'), subject: 'claim T001', ops: [task('T001', TITLE, { at: 'tasks', owner: owner(ME) })] },
];
const mine = [{ task: 'T001', column: 'in_progress' }];
const go = (...more) => ({ do: 'continue', task: 'T001', reasons: ['in-progress', ...more], rule: [3, 8] });
const worktreeHandoff = ['- **Last touched:** 2026-10-10, tests written', '- **Resume with:** run the tests'];

export default [
  kase({
    name: 'held-continue',
    rows: [3],
    story: "The caller holds the task, and its own run is running: continue from the trail's next.",
    commits: claimed,
    tree: { trails: { T001: [
      open(at('11:00'), ME, proc(4001, P)),
      did(at('11:40'), ME, { what: 'parser skeleton', next: 'write the parser tests' }),
    ] } },
    view: { alive: [{ pid: 4001, lstart: P }] },
    call: { run: ME },
    answer: answer({
      next: go(),
      rules: rules({ used: 1 }),
      you: mine,
      data: data({ T001: card('T001', TITLE, { next: 'write the parser tests', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'trail-beats-handoff',
    rows: [3],
    story: 'The Handoff and the trail disagree. Both are in data, and the newest trail entry wins (rule 8).',
    commits: [
      { at: at('09:30', 1), ops: [task('T001', TITLE)] },
      { at: at('08:00', 9), subject: 'claim T001', ops: [task('T001', TITLE, { at: 'tasks', owner: owner(ME), handoff: ['- **Last touched:** 2026-10-09, parser started', '- **Resume with:** finish the parser'] })] },
    ],
    tree: { trails: { T001: [
      open(at('09:00'), ME),
      did(at('09:30'), ME, { what: 'parser finished', next: 'add the CSV importer' }),
      end(at('10:00'), ME, { left: 'parser done; the CSV importer is next' }),
    ] } },
    answer: answer({
      next: go(),
      rules: rules({ used: 1 }),
      you: mine,
      data: data({ T001: card('T001', TITLE, {
        next: 'add the CSV importer',
        left: 'parser done; the CSV importer is next',
        handoff: '**Last touched:** 2026-10-09, parser started **Resume with:** finish the parser',
      }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'idle-own-claim',
    rows: [3],
    story: "The caller's own claim from three days ago, with no trail. A claim never expires for its own operator: a new session continues it and rewrites the owner line (rule 3).",
    commits: [
      { at: at('09:30', 1), ops: [task('T001', TITLE)] },
      { at: at('08:00', 7), subject: 'claim T001', ops: [task('T001', TITLE, { at: 'tasks', owner: owner(ME) })] },
    ],
    call: { run: 'eeee5555' },
    answer: answer({
      next: go('rewrite-owner'),
      rules: rules({ used: 1 }),
      you: mine,
      data: data({ T001: card('T001', TITLE, { handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'parent-with-live-child',
    rows: [3],
    story: "The caller's subagent runs an act until 13:15. It is the caller's family, so the task is not held elsewhere: continue, with the act in flight.",
    commits: claimed,
    tree: { trails: { T001: [
      open(at('11:00'), ME, proc(4001, P)),
      open(at('11:10'), `${ME}.a1b2`, proc(4001, P)),
      doing(at('11:15'), `${ME}.a1b2`, { act: 'benchmark the parser', tell: 'bench/result.json exists', until: at('13:15') }),
    ] } },
    view: { alive: [{ pid: 4001, lstart: P }] },
    call: { run: ME },
    answer: answer({
      next: go(),
      rules: rules({ used: 1 }),
      you: mine,
      inFlight: [{ task: 'T001', run: `${ME}.a1b2`, kind: 'doing', since: at('11:15'), state: 'running', by: 'until', until: at('13:15') }],
      data: data({ T001: card('T001', TITLE, { handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'sibling-subagents',
    rows: [3],
    story: "Two subagents of one parent. The caller, one of them, sees its sibling's act in flight, and not as a holder: same family.",
    commits: claimed,
    tree: { trails: { T001: [
      open(at('11:00'), ME, proc(4001, P)),
      open(at('11:10'), `${ME}.a1b2`, proc(4001, P)),
      open(at('11:12'), `${ME}.c3d4`, proc(4001, P)),
      doing(at('11:20'), `${ME}.c3d4`, { act: 'profile the parser', tell: 'prof/out.txt exists' }),
    ] } },
    view: { alive: [{ pid: 4001, lstart: P }] },
    call: { run: `${ME}.a1b2` },
    answer: answer({
      next: go(),
      rules: rules({ used: 1 }),
      you: mine,
      inFlight: [{ task: 'T001', run: `${ME}.c3d4`, kind: 'doing', since: at('11:20'), state: 'running', by: 'process' }],
      data: data({ T001: card('T001', TITLE, { handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'rewrite-owner-session-only',
    rows: [3],
    story: "The owner line names another profile and the caller's session. rewrite-owner compares the session only, so it is not asked for (design §11).",
    commits: [
      { at: at('09:30', 1), ops: [task('T001', TITLE)] },
      { at: at('08:00'), subject: 'claim T001', ops: [task('T001', TITLE, { at: 'tasks', owner: `ade @z/${ME} 2026-10-10 — parser, before the account switch` })] },
    ],
    call: { run: ME },
    answer: answer({
      next: go(),
      rules: rules({ used: 1 }),
      you: mine,
      data: data({ T001: card('T001', TITLE, { handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'after-reap-continues',
    rows: [3],
    story: 'older-run-dead-doing after the reap: the caller found the act finished and appended the end for that run. Row 1 stops firing, row 3 continues, and the new session rewrites the owner line (design N4).',
    commits: claimed,
    tree: { trails: { T001: [
      open(at('08:00'), ME, proc(4001, 'Sat Oct 10 07:55:00 2026')),
      doing(at('08:10'), ME, { act: 'fold 3, ~1 h GPU', tell: 'outputs/fold3/last.ckpt exists', next: 'collect fold 3' }),
      open(at('10:00'), 'bbbb2222', proc(4101, 'Sat Oct 10 09:58:00 2026')),
      did(at('10:30'), 'bbbb2222', { what: 'wrote the report skeleton', next: 'fill in fold 3' }),
      end(at('10:40'), 'bbbb2222', { left: 'report skeleton in docs/report.md' }),
      open(at('11:50'), 'dddd4444', proc(6001, 'Sat Oct 10 11:49:00 2026')),
      end(at('11:55'), ME, { left: 'fold 3 finished on its own; outputs/fold3/last.ckpt exists' }),
    ] } },
    view: { alive: [{ pid: 6001, lstart: 'Sat Oct 10 11:49:00 2026' }] },
    call: { run: 'dddd4444' },
    answer: answer({
      next: go('rewrite-owner'),
      rules: rules({ used: 1 }),
      you: mine,
      data: data({ T001: card('T001', TITLE, { next: 'fill in fold 3', left: 'fold 3 finished on its own; outputs/fold3/last.ckpt exists', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'handoff-from-worktree',
    rows: [3],
    story: 'The caller rewrote the Handoff and has not committed it. The Handoff is read from the working tree, and a change to the body alone is not an uncommitted-task-change.',
    commits: claimed,
    tree: { files: { [task('T001', TITLE, { at: 'tasks' }).path]: task('T001', TITLE, { at: 'tasks', owner: owner(ME), handoff: worktreeHandoff }).content } },
    call: { run: ME },
    answer: answer({
      next: go(),
      rules: rules({ used: 1 }),
      you: mine,
      data: data({ T001: card('T001', TITLE, { handoff: '**Last touched:** 2026-10-10, tests written **Resume with:** run the tests' }) }),
      more: more('T001'),
    }),
  }),
];
