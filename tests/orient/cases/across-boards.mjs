import { answer, at, BASE_YML, baseState, card, data, did, file, HANDOFF, kase, ME, more, NOW_TEXT, open, owner, rules, task } from '../corpus.mjs';

// Boards in other shapes, and warnings about the board itself.

const BEA = owner('cccc3333', { operator: 'bea', profile: 'k' });
const CARA = owner('eeee5555', { operator: 'cara', profile: 'm' });
const claim = (id) => ({ do: 'claim', task: id, reasons: ['ready'], rule: [1, 5, 12] });
const backlog = (id, title, options) => card(id, title, { folder: 'backlog', ...options });

const STALE_STATE = `${baseState()}
<!-- AA:generated -->
| | id | task | owner | age | |
|---|---|---|---|---|---|
| **IN PROGRESS** 1/2 | T002 | Write the parser | bea | 2d |  |
| **BACKLOG** 2 | | \`T003\` \`T004\` | | | |
| **DONE** | T001 | Set up CI | ade | 9d |  |
<!-- /AA:generated -->
`;

// state-current: a generated region that matches HEAD, with a row that
// continues a column and a summary row whose second cell is no id.
const CURRENT_STATE = `${baseState()}
<!-- AA:generated -->
| | id | task | owner | age | |
|---|---|---|---|---|---|
| **IN PROGRESS** 2/4 | T002 | Write the parser | bea | 4h |  |
| | T003 | Write the lexer | bea | 3h |  |
| **BLOCKED** 1/2 | T005 | Sign the release | cara | 1h | waiting on legal |
| **BACKLOG** 1 | | \`T004\` | | | |
| **DONE** | T001 | Set up CI | ade | 9d |  |
<!-- /AA:generated -->
`;

// settings-crlf: CRLF line ends, blank lines inside both blocks, and two
// values that JavaScript's Number() would read but are not whole numbers.
const CRLF_YML = [
  'spend:',
  '  - push        # once others have it, it stays out there',
  '',
  '  - gpu-hour',
  'wip:',
  '',
  '  in_progress: 3',
  '  blocked: 1',
  'stale_hours: 12.0',
  'live_minutes: 1e1',
  '',
].join('\r\n');

const steps = Array.from({ length: 13 }, (_, index) => {
  const id = `T${String(index + 1).padStart(3, '0')}`;
  return { id, title: `Step ${index + 1} of the import` };
});

export default [
  kase({
    name: 'expired-while-holding',
    rows: [3],
    story: "The caller has its own work, and another operator's claim has expired: continue the caller's work, and warn of the expired claim. Rows 1 to 5 come before row 6.",
    commits: [
      { at: at('09:30', 1), ops: [task('T001', 'Write the parser'), task('T002', 'Clean the cache')] },
      { at: at('08:00', 8), by: 'bea', subject: 'claim T002', ops: [task('T002', 'Clean the cache', { at: 'tasks', owner: BEA })] },
      { at: at('08:00'), subject: 'claim T001', ops: [task('T001', 'Write the parser', { at: 'tasks', owner: owner(ME) })] },
    ],
    call: { run: ME },
    answer: answer({
      next: { do: 'continue', task: 'T001', reasons: ['in-progress'], rule: [3, 8] },
      rules: rules({ used: 2 }),
      you: [{ task: 'T001', column: 'in_progress' }],
      warnings: [{ code: 'claim-expired', task: 'T002' }],
      data: data({ T001: card('T001', 'Write the parser', { handoff: HANDOFF }) }),
      more: more('T001'),
    }),
  }),

  kase({
    name: 'older-board',
    rows: [3],
    story: "A board in AGEIS's layout: no settings file, no backlog/ at HEAD, and a STATE.md kept by hand. Unclaimed tasks in tasks/ are the backlog, and there is no WIP limit. A backlog file not yet committed does not change the layout, which is read at HEAD, and is warned about.",
    yml: null,
    state: '# State\n\nKept by hand.\n',
    commits: [
      { at: at('09:30', 1), ops: [task('T001', 'Map the old API', { at: 'tasks', status: 'open' }), task('T002', 'Port the client', { at: 'tasks', status: 'open' })] },
      { at: at('08:00'), subject: 'claim T002', ops: [task('T002', 'Port the client', { at: 'tasks', owner: owner(ME) })] },
    ],
    tree: { remove: ['AA/backlog'], files: { [task('T003', 'Draft the port').path]: task('T003', 'Draft the port').content } },
    call: { run: ME },
    answer: answer({
      next: { do: 'continue', task: 'T002', reasons: ['in-progress'], rule: [3, 8] },
      rules: rules({ used: 1, limit: 0, blockedLimit: 0 }),
      you: [{ task: 'T002', column: 'in_progress' }],
      take: [{ task: 'T001', unblocks: 0 }],
      warnings: [{ code: 'older-board' }, { code: 'no-wip-limit' }, { code: 'uncommitted-task-change', task: 'T003' }],
      data: data({
        T002: card('T002', 'Port the client', { handoff: HANDOFF }),
        T001: card('T001', 'Map the old API'),
      }, { spend: [], now: null }),
      more: more('T002'),
    }),
  }),

  kase({
    name: 'deaddrop-board',
    rows: [8],
    story: 'A board under the older folder name deaddrop/, with deaddrop.yml and its own STATE.md markers. Every path in the answer names it.',
    board: 'deaddrop',
    commits: [{ at: at('09:30', 1), ops: [
      task('T001', 'Index the drops', { board: 'deaddrop' }),
      task('T002', 'Set up the drop', { board: 'deaddrop', at: 'done' }),
    ] }],
    answer: answer({
      next: claim('T001'),
      take: [{ task: 'T001', unblocks: 0 }],
      warnings: [{ code: 'older-board' }],
      data: data({ T001: backlog('T001', 'Index the drops', { board: 'deaddrop' }) }, { now: { text: NOW_TEXT, file: 'deaddrop/STATE.md' } }),
      more: more('T001', 'backlog', 'deaddrop'),
    }, { board: 'deaddrop/' }),
  }),

  kase({
    name: 'duplicate-id',
    rows: [8],
    story: 'Two files claim T003, one in the backlog and one in progress. That id is in no column and every row skips it, the caller holding one copy or not.',
    commits: [
      { at: at('09:30', 1), ops: [task('T004', 'Prune the logs')] },
      { at: at('10:00', 9), subject: 'merge two boards', ops: [
        file('AA/backlog/T003-rotate-the-keys.md', task('T003', 'Rotate the keys').content),
        file('AA/tasks/T003-rotate-the-api-keys.md', task('T003', 'Rotate the API keys', { at: 'tasks', owner: owner(ME) }).content),
      ] },
    ],
    call: { run: ME },
    answer: answer({
      next: claim('T004'),
      take: [{ task: 'T004', unblocks: 0 }],
      warnings: [{ code: 'duplicate-id', task: 'T003' }],
      data: data({ T004: backlog('T004', 'Prune the logs') }),
      more: more('T004', 'backlog'),
    }),
  }),

  kase({
    name: 'state-stale',
    rows: [8],
    story: "STATE.md's generated region shows T002 in progress; at HEAD T002 is done and T003 is in progress. The board was not regenerated.",
    state: STALE_STATE,
    commits: [
      { at: at('09:30', 1), ops: [task('T001', 'Set up CI', { at: 'done' }), task('T002', 'Write the parser'), task('T003', 'Write the lexer'), task('T004', 'Tag the release')] },
      { at: at('08:00', 8), by: 'bea', subject: 'claim T002', ops: [task('T002', 'Write the parser', { at: 'tasks', owner: BEA })] },
      { at: at('09:00'), by: 'bea', subject: 'T002 done', ops: [task('T002', 'Write the parser', { at: 'done', owner: BEA })] },
      { at: at('09:30'), by: 'bea', subject: 'claim T003', ops: [task('T003', 'Write the lexer', { at: 'tasks', owner: BEA })] },
    ],
    answer: answer({
      next: claim('T004'),
      rules: rules({ used: 1 }),
      take: [{ task: 'T004', unblocks: 0 }],
      warnings: [{ code: 'state-stale' }],
      data: data({ T004: backlog('T004', 'Tag the release') }),
      more: more('T004', 'backlog'),
    }),
  }),

  kase({
    name: 'state-current',
    rows: [8],
    story: "STATE.md's generated region matches HEAD: two tasks in progress, the second on a row that continues the column, one blocked, and the backlog's summary row, whose second cell is no id. There is no warning.",
    state: CURRENT_STATE,
    yml: BASE_YML.replace('in_progress: 2', 'in_progress: 4'),
    commits: [
      { at: at('09:30', 1), ops: [task('T001', 'Set up CI', { at: 'done' }), task('T002', 'Write the parser'), task('T003', 'Write the lexer'), task('T004', 'Tag the release'), task('T005', 'Sign the release')] },
      { at: at('08:00'), by: 'bea', subject: 'claim T002', ops: [task('T002', 'Write the parser', { at: 'tasks', owner: BEA })] },
      { at: at('09:00'), by: 'bea', subject: 'claim T003', ops: [task('T003', 'Write the lexer', { at: 'tasks', owner: BEA })] },
      { at: at('10:00'), by: 'cara', subject: 'claim T005', ops: [task('T005', 'Sign the release', { at: 'tasks', owner: CARA })] },
      { at: at('11:00'), by: 'cara', subject: 'block T005', ops: [task('T005', 'Sign the release', { at: 'blocked', owner: CARA, blockedReason: 'waiting on legal' })] },
    ],
    answer: answer({
      next: claim('T004'),
      rules: rules({ used: 3, limit: 4, blocked: 1 }),
      take: [{ task: 'T004', unblocks: 0 }],
      data: data({ T004: backlog('T004', 'Tag the release') }),
      more: more('T004', 'backlog'),
    }),
  }),

  kase({
    name: 'settings-crlf',
    rows: [7],
    story: 'AA.yml has CRLF line ends, and blank lines inside its blocks, which end neither. Its limit is 3, which three claims fill: stop. stale_hours 12.0 and live_minutes 1e1 are not whole numbers, so both take their defaults.',
    yml: CRLF_YML,
    commits: [
      { at: at('09:30', 1), ops: [task('T002', 'Clean the cache'), task('T003', 'Write the changelog'), task('T004', 'Tag the release'), task('T005', 'Announce the release')] },
      { at: at('07:00'), by: 'bea', subject: 'claim T002', ops: [task('T002', 'Clean the cache', { at: 'tasks', owner: BEA })] },
      { at: at('07:15'), by: 'bea', subject: 'claim T003', ops: [task('T003', 'Write the changelog', { at: 'tasks', owner: BEA })] },
      { at: at('07:30'), by: 'bea', subject: 'claim T004', ops: [task('T004', 'Tag the release', { at: 'tasks', owner: BEA })] },
    ],
    answer: answer({
      next: { do: 'stop', reasons: ['wip-full'], rule: [10] },
      rules: rules({ used: 3, limit: 3, blockedLimit: 1 }),
      take: [{ task: 'T005', unblocks: 0 }],
      data: data({ T005: backlog('T005', 'Announce the release') }),
    }),
  }),

  kase({
    name: 'live-minutes-clamped',
    rows: [6],
    story: 'live_minutes 90 is not below stale_hours 1, so it is 59. A run heard 61 minutes ago is closed, and its claim, with no other sign of life, is expired. With 90 it would be neither.',
    yml: BASE_YML.replace('stale_hours: 24', 'stale_hours: 1').replace('live_minutes: 30', 'live_minutes: 90'),
    commits: [
      { at: at('09:30', 1), ops: [task('T002', 'Clean the cache')] },
      { at: at('08:00'), by: 'bea', subject: 'claim T002', ops: [task('T002', 'Clean the cache', { at: 'tasks', owner: BEA })] },
    ],
    tree: { trails: { T002: [
      open(at('10:50'), 'cccc3333', { operator: 'bea', profile: 'k' }),
      did(at('10:59'), 'cccc3333', { what: 'sampled the cache' }),
    ] } },
    answer: answer({
      next: { do: 'release', task: 'T002', since: at('10:59'), reasons: ['expired'], rule: [4] },
      rules: rules({ used: 1, staleHours: 1, liveMinutes: 59 }),
      warnings: [{ code: 'live-minutes-clamped' }],
      data: data({ T002: card('T002', 'Clean the cache', { author: 'bea' }) }),
      more: more('T002'),
    }),
  }),

  kase({
    name: 'uncommitted-many',
    rows: [8],
    story: 'Twelve task files have uncommitted frontmatter changes and one has a change to its body alone: ten warnings, two cut, and the body-only change is none. Thirteen tasks are claimable, and three are cut from take.',
    commits: [{ at: at('09:30', 1), ops: steps.map(({ id, title }) => task(id, title)) }],
    tree: { files: Object.fromEntries(steps.map(({ id, title }, index) => {
      const changed = index < 12 ? task(id, title, { priority: 'high' }) : task(id, title, { handoff: ['- **Last touched:** 2026-10-10, read the task'] });
      return [changed.path, changed.content];
    })) },
    answer: answer({
      next: claim('T001'),
      take: steps.slice(0, 10).map(({ id }) => ({ task: id, unblocks: 0 })),
      warnings: steps.slice(0, 10).map(({ id }) => ({ code: 'uncommitted-task-change', task: id })),
      data: data(Object.fromEntries(steps.slice(0, 10).map(({ id, title }) => [id, backlog(id, title)]))),
      more: more('T001', 'backlog'),
      cut: { warnings: 2, take: 3 },
    }),
  }),
];
