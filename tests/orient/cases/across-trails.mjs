import { answer, at, card, data, did, HANDOFF, kase, line, ME, more, open, owner, proc, rules, task } from '../corpus.mjs';

// Trails that are not as ckpt.sh writes them: malformed lines, a trail that
// is not a regular file, and one over 1 MiB.

const TITLE = 'Write the parser';
const P = 'Sat Oct 10 10:58:00 2026';
const BACKSLASH = String.fromCharCode(92);
const claimed = [
  { at: at('09:30', 1), ops: [task('T001', TITLE)] },
  { at: at('08:00'), subject: 'claim T001', ops: [task('T001', TITLE, { at: 'tasks', owner: owner(ME) })] },
];
const go = { do: 'continue', task: 'T001', reasons: ['in-progress'], rule: [3, 8] };
const mine = [{ task: 'T001', column: 'in_progress' }];

// Lines of an old backfill, enough to take the trail past 1 MiB.
const FILLER = 11000;
const filler = Array.from({ length: FILLER }, (_, index) => did(at('08:00', 5), 'old00000', { what: `step ${String(index).padStart(5, '0')} of the backfill, logged once per batch` }));

export default [
  kase({
    name: 'trail-malformed',
    rows: [3],
    story: 'Seven lines are not entries: an impossible date, text, an unpaired surrogate escape, an unknown kind, a run id of four parts, an array, and fractions of a second. A blank line is not counted.',
    commits: claimed,
    tree: { trails: { T001: [
      open(at('10:00'), ME, proc(4001, P)),
      '{"ts":"2026-02-30T00:00:00Z","run":"aaaa1111","kind":"did"}',
      '',
      'not json',
      `{"ts":"2026-10-10T10:30:00Z","run":"aaaa1111","kind":"did","what":"${BACKSLASH}ud800"}`,
      '{"ts":"2026-10-10T10:40:00Z","run":"aaaa1111","kind":"note"}',
      '{"ts":"2026-10-10T10:50:00Z","run":"a.b.c.d","kind":"did"}',
      '[1,2]',
      '{"ts":"2026-10-10T10:55:00.000Z","run":"aaaa1111","kind":"did"}',
      did(at('11:40'), ME, { what: 'parser tests pass', next: 'keep going' }),
    ] } },
    view: { alive: [{ pid: 4001, lstart: P }] },
    call: { run: ME },
    answer: answer({
      next: go,
      rules: rules({ used: 1 }),
      you: mine,
      warnings: [{ code: 'trail-malformed', task: 'T001', line: 2, n: 7 }],
      data: data({ T001: card('T001', TITLE, { next: 'keep going', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'trail-unreadable',
    rows: [3],
    story: 'The trail is a symbolic link to a file outside the board, in which another session is running. A link is not followed: the trail reads as empty, and nothing holds the task.',
    commits: claimed,
    tree: {
      files: { 'elsewhere.jsonl': line(did(at('11:55'), 'ffff6666', { what: 'not read', next: 'not this' })) },
      links: { 'AA/checkpoints/T001.jsonl': '../../elsewhere.jsonl' },
    },
    call: { run: ME },
    answer: answer({
      next: go,
      rules: rules({ used: 1 }),
      you: mine,
      warnings: [{ code: 'trail-unreadable', task: 'T001' }],
      data: data({ T001: card('T001', TITLE, { handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'trail-truncated',
    rows: [3],
    story: `A trail of ${FILLER + 3} lines, over 1 MiB, is read from its last 1 MiB. Its one malformed line, near the end, is numbered from the start of the file.`,
    commits: claimed,
    tree: { trails: { T001: [
      ...filler,
      open(at('11:00'), ME, proc(4001, P)),
      'garbage',
      did(at('11:40'), ME, { what: 'trimmed the backfill', next: 'trim the trail' }),
    ] } },
    view: { alive: [{ pid: 4001, lstart: P }] },
    call: { run: ME },
    answer: answer({
      next: go,
      rules: rules({ used: 1 }),
      you: mine,
      warnings: [{ code: 'trail-malformed', task: 'T001', line: FILLER + 2, n: 1 }, { code: 'trail-truncated', task: 'T001' }],
      data: data({ T001: card('T001', TITLE, { next: 'trim the trail', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),
];
