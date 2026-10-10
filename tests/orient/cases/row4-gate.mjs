import { answer, at, card, data, HANDOFF, kase, ME, more, owner, rules, task } from '../corpus.mjs';

// Row 4, on the server only: the caller's task waits on an operator decision
// at a pipeline gate. board.sh cannot see gates, so it has no runner here.

const TITLE = 'Write the parser';

export default [
  kase({
    name: 'gate-waiting',
    rows: [4],
    serverOnly: true,
    story: "The caller's task waits on an approval gate in AGE Aris's pipeline since 11:00: wait for the operator.",
    commits: [
      { at: at('09:30', 1), ops: [task('T001', TITLE)] },
      { at: at('08:00'), subject: 'claim T001', ops: [task('T001', TITLE, { at: 'tasks', owner: owner(ME) })] },
    ],
    view: { gates: { T001: at('11:00') } },
    call: { run: ME },
    answer: answer({
      next: { do: 'wait', task: 'T001', since: at('11:00'), reasons: ['gate'], rule: [] },
      rules: rules({ used: 1 }),
      you: [{ task: 'T001', column: 'in_progress' }],
      data: data({ T001: card('T001', TITLE, { handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),
];
