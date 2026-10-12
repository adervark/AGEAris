import { answer, at, card, data, did, doing, HANDOFF, kase, ME, more, open, owner, proc, rules, task } from '../corpus.mjs';

// Row 0: a caller bound to a task, such as a subagent with its brief (rule 7).

const TITLE = 'Fold the importer';
const P = 'Sat Oct 10 09:58:00 2026';   // the parent session's process
const SUB = `${ME}.b2c3`;               // a subagent of that session
const claimed = [
  { at: at('09:30', 1), ops: [task('T001', TITLE)] },
  { at: at('08:00'), subject: 'claim T001', ops: [task('T001', TITLE, { at: 'tasks', owner: owner(ME) })] },
];
const mine = { task: 'T001', column: 'in_progress' };

export default [
  kase({
    name: 'bound-subagent',
    rows: [0],
    story: "A subagent bound to its parent's task. The parent runs in the same process, and it is the subagent's family: continue.",
    commits: claimed,
    tree: { trails: { T001: [
      open(at('10:00'), ME, proc(4001, P)),
      did(at('11:00'), ME, { what: 'fold plan written', next: 'review the fold' }),
      open(at('11:50'), SUB, proc(4001, P)),
    ] } },
    view: { alive: [{ pid: 4001, lstart: P }] },
    call: { run: SUB, task: 'T001' },
    answer: answer({
      next: { do: 'continue', task: 'T001', reasons: ['bound'], rule: [7] },
      rules: rules({ used: 1 }),
      you: [mine],
      data: data({ T001: card('T001', TITLE, { next: 'review the fold', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'bound-subagent-parent-doing',
    rows: [0],
    story: "The parent's newest entry is the doing that started the subagent. It is in flight, and the subagent continues: same family.",
    commits: claimed,
    tree: { trails: { T001: [
      open(at('10:00'), ME, proc(4001, P)),
      did(at('11:00'), ME, { what: 'fold plan written', next: 'review the fold' }),
      doing(at('11:45'), ME, { act: 'a subagent reviews the fold plan', tell: 'its end line in this trail' }),
      open(at('11:50'), SUB, proc(4001, P)),
    ] } },
    view: { alive: [{ pid: 4001, lstart: P }] },
    call: { run: SUB, task: 'T001' },
    answer: answer({
      next: { do: 'continue', task: 'T001', reasons: ['bound'], rule: [7] },
      rules: rules({ used: 1 }),
      you: [mine],
      inFlight: [{ task: 'T001', run: ME, kind: 'doing', since: at('11:45'), state: 'running', by: 'process' }],
      data: data({ T001: card('T001', TITLE, { next: 'review the fold', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'bound-subagent-other-session',
    rows: [0],
    story: 'Another session of the same operator runs on the task, outside the family: the subagent stops and names it (D4, D6).',
    commits: claimed,
    tree: { trails: { T001: [
      open(at('10:00'), ME, proc(4001, P)),
      did(at('11:00'), ME, { what: 'fold plan written', next: 'review the fold' }),
      open(at('11:20'), 'bbbb2222', { profile: 'c' }),
      did(at('11:40'), 'bbbb2222', { what: 'ported the fold', next: 'port the fold to v2' }),
      open(at('11:50'), SUB, proc(4001, P)),
    ] } },
    view: { alive: [{ pid: 4001, lstart: P }] },
    call: { run: SUB, task: 'T001' },
    answer: answer({
      next: { do: 'stop', task: 'T001', run: 'bbbb2222', by: 'clock', since: at('11:40'), until: at('12:10'), reasons: ['held-elsewhere'], rule: [7] },
      rules: rules({ used: 1 }),
      you: [{ ...mine, heldBy: 'bbbb2222' }],
      inFlight: [{ task: 'T001', run: 'bbbb2222', kind: 'did', since: at('11:40'), state: 'running', by: 'clock', until: at('12:10') }],
      data: data({ T001: card('T001', TITLE, { next: 'port the fold to v2', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'bound-subagent-resumed',
    rows: [0],
    story: "The session was resumed in a new process. The subagent's own run stopped mid-act in the old one: it resumes, checking the tell first.",
    commits: claimed,
    tree: { trails: { T001: [
      open(at('10:00'), ME, proc(4001, P)),
      open(at('11:00'), SUB, proc(4001, P)),
      doing(at('11:05'), SUB, { act: 'fold 2 of 5 under runs/fold2', tell: 'runs/fold2/done exists', next: 'collect fold 2' }),
    ] } },
    view: { alive: [{ pid: 5001, lstart: 'Sat Oct 10 11:55:00 2026' }] },
    call: { run: SUB, task: 'T001' },
    answer: answer({
      next: { do: 'resume', task: 'T001', run: SUB, by: 'process', since: at('11:05'), verify: 'tell', reasons: ['stopped-mid-act'], rule: [7] },
      rules: rules({ used: 1 }),
      you: [mine],
      inFlight: [{ task: 'T001', run: SUB, kind: 'doing', since: at('11:05'), state: 'closed', by: 'process' }],
      data: data({ T001: card('T001', TITLE, { next: 'collect fold 2', act: 'fold 2 of 5 under runs/fold2', tell: 'runs/fold2/done exists', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'bound-not-yours',
    rows: [0],
    story: 'A subagent is bound to a task another operator holds: it stops, whatever else the caller holds.',
    commits: [
      { at: at('09:30', 1), ops: [task('T001', TITLE), task('T002', 'Clean the cache')] },
      { at: at('08:00'), subject: 'claim T001', ops: [task('T001', TITLE, { at: 'tasks', owner: owner(ME) })] },
      { at: at('08:30'), by: 'bea', subject: 'claim T002', ops: [task('T002', 'Clean the cache', { at: 'tasks', owner: owner('cccc3333', { operator: 'bea', profile: 'k' }) })] },
    ],
    call: { run: `${ME}.d4e5`, task: 'T002' },
    answer: answer({
      next: { do: 'stop', task: 'T002', reasons: ['not-yours'], rule: [7] },
      rules: rules({ used: 2 }),
      you: [mine],
      data: data({
        T002: card('T002', 'Clean the cache', { author: 'bea' }),
        T001: card('T001', TITLE),
      }),
      more: more('T002'),
    }),
  }),

  kase({
    name: 'bound-unknown-task',
    rows: [0],
    story: "A subagent is bound to T999, whose file its parent wrote and never committed. A claim is a commit, so T999 is not the caller's: stop. Its data entry has only the trail's next: with no file at HEAD, it has no title, file or author.",
    commits: claimed,
    tree: {
      files: { [task('T999', 'Draft the plan', { at: 'tasks' }).path]: task('T999', 'Draft the plan', { at: 'tasks', owner: owner(ME) }).content },
      trails: { T999: [
        open(at('11:30'), ME, proc(4001, P)),
        did(at('11:40'), ME, { what: 'drafted the outline', next: "draft the plan's risks" }),
      ] },
    },
    view: { alive: [{ pid: 4001, lstart: P }] },
    call: { run: SUB, task: 'T999' },
    answer: answer({
      next: { do: 'stop', task: 'T999', reasons: ['not-yours'], rule: [7] },
      rules: rules({ used: 1 }),
      you: [mine],
      warnings: [{ code: 'uncommitted-task-change', task: 'T999' }],
      data: data({
        T999: { next: "draft the plan's risks" },
        T001: card('T001', TITLE),
      }),
      more: more('T999', null),
    }),
  }),
];
