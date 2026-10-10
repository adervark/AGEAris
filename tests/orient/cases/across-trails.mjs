import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { answer, at, card, data, did, doing, HANDOFF, kase, line, ME, more, open, owner, proc, rules, task } from '../corpus.mjs';

// Trails that are not as ckpt.sh writes them: malformed lines, a trail that
// is not a regular file, ones over 1 MiB, and trails with no task to match.

const TITLE = 'Write the parser';
const P = 'Sat Oct 10 10:58:00 2026';
const BACKSLASH = String.fromCharCode(92);
const NO_BREAK_SPACE = String.fromCharCode(0xa0);
const MiB = 1048576;
const claimed = [
  { at: at('09:30', 1), ops: [task('T001', TITLE)] },
  { at: at('08:00'), subject: 'claim T001', ops: [task('T001', TITLE, { at: 'tasks', owner: owner(ME) })] },
];
const go = { do: 'continue', task: 'T001', reasons: ['in-progress'], rule: [3, 8] };
const mine = [{ task: 'T001', column: 'in_progress' }];

// Lines of an old backfill, enough to take the trail past 1 MiB.
const FILLER = 11000;
const filler = Array.from({ length: FILLER }, (_, index) => did(at('08:00', 5), 'old00000', { what: `step ${String(index).padStart(5, '0')} of the backfill, logged once per batch` }));

// trail-truncated-at-line: over 8 MiB, its last 1 MiB starting exactly at a
// line. That line is malformed, so a door that keeps it counts one more.
const backfill = (index) => JSON.stringify(did(at('08:00', 4), 'old00000', { what: `step ${String(index).padStart(6, '0')} of the backfill, logged once per batch` }));
const LINE_BYTES = backfill(0).length + 1;
const BEFORE = 80000;                     // lines before the last 1 MiB: over 8 MiB with it
const ending = [
  JSON.stringify(open(at('11:00'), ME, proc(4001, P))),
  'garbage',
  JSON.stringify(did(at('11:40'), ME, { what: 'trimmed the backfill', next: 'trim the trail' })),
];
const ENDING_BYTES = ending.reduce((sum, text) => sum + text.length + 1, 0);
const WITHIN = Math.floor((MiB - ENDING_BYTES - 40) / LINE_BYTES);   // backfill lines inside it
const CUT_LINE = 'x'.repeat(MiB - ENDING_BYTES - WITHIN * LINE_BYTES - 1);
const longTrail = [
  ...Array.from({ length: BEFORE }, (_, index) => backfill(index)),
  CUT_LINE,
  ...Array.from({ length: WITHIN }, (_, index) => backfill(BEFORE + index)),
  ...ending,
];
const GARBAGE_LINE = BEFORE + 1 + WITHIN + 2;

export default [
  kase({
    name: 'trail-malformed',
    rows: [3],
    story: 'Nine lines are not entries: an impossible date, text, an unpaired high surrogate escape and an unpaired low one, an unknown kind, a run id of four parts, an array, fractions of a second, and a no-break space. Blank lines, empty or of spaces and tabs, with a carriage return or without, are not counted.',
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
      `{"ts":"2026-10-10T10:56:00Z","run":"aaaa1111","kind":"did","what":"${BACKSLASH}udc00"}`,
      '   \t ',
      ' \r',
      NO_BREAK_SPACE,
      did(at('11:40'), ME, { what: 'parser tests pass', next: 'keep going' }),
    ] } },
    view: { alive: [{ pid: 4001, lstart: P }] },
    call: { run: ME },
    answer: answer({
      next: go,
      rules: rules({ used: 1 }),
      you: mine,
      warnings: [{ code: 'trail-malformed', task: 'T001', line: 2, n: 9 }],
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

  kase({
    name: 'trail-truncated-at-line',
    rows: [3],
    story: `A trail of ${longTrail.length} lines, over 8 MiB, whose last 1 MiB starts exactly at a line. That whole line is still dropped, though it is malformed, and the malformed line near the end is numbered from the start of the file.`,
    commits: claimed,
    tree: { trails: { T001: longTrail } },
    // The build checks what the story says of the file.
    setup: async ({ dir }) => {
      const bytes = await readFile(join(dir, 'AA/checkpoints/T001.jsonl'));
      if (bytes.length <= 8 * MiB) throw new Error(`the trail is ${bytes.length} bytes, not over 8 MiB`);
      if (bytes[bytes.length - MiB - 1] !== 10) throw new Error('the last 1 MiB does not start at a line');
      if (bytes.subarray(bytes.length - MiB, bytes.length - MiB + CUT_LINE.length).toString() !== CUT_LINE) throw new Error('the last 1 MiB does not start with the cut line');
    },
    view: { alive: [{ pid: 4001, lstart: P }] },
    call: { run: ME },
    answer: answer({
      next: go,
      rules: rules({ used: 1 }),
      you: mine,
      warnings: [{ code: 'trail-malformed', task: 'T001', line: GARBAGE_LINE, n: 1 }, { code: 'trail-truncated', task: 'T001' }],
      data: data({ T001: card('T001', TITLE, { next: 'trim the trail', handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'trails-without-tasks',
    rows: [9],
    story: 'Every trail named by a task id counts, whatever its task\'s column and whether a file has the id: a run on T001, which is done, stopped mid-act, and a run on T009, which has no file, is running. Both are in flight. T01.jsonl is named by no id, and is not read.',
    commits: [{ at: at('09:30', 1), ops: [task('T001', 'Set up CI', { at: 'done' })] }],
    tree: { trails: {
      T001: [
        open(at('07:00'), 'bbbb2222'),
        doing(at('07:30'), 'bbbb2222', { act: 'deploy the docs site', tell: 'docs.example.invalid shows v2' }),
      ],
      T009: [open(at('11:45'), 'cccc3333', { operator: 'bea', profile: 'k' })],
      T01: [open(at('11:50'), 'eeee5555')],
    } },
    call: { run: ME },
    answer: answer({
      next: { do: 'idle', reasons: ['empty-backlog'], rule: [] },
      inFlight: [
        { task: 'T009', run: 'cccc3333', kind: 'open', since: at('11:45'), state: 'running', by: 'clock', until: at('12:15') },
        { task: 'T001', run: 'bbbb2222', kind: 'doing', since: at('07:30'), state: 'closed', by: 'clock' },
      ],
    }),
  }),
];
