import { answer, at, BASE_YML, card, data, kase, ME, more, open, owner, rules, task } from '../corpus.mjs';

// Row 8: a backlog task is claimable: ready, its depends done and none killed
// or missing, and not held by another run. Claim the first by priority, then
// by how many it unblocks, then by id.

const BEA = owner('cccc3333', { operator: 'bea', profile: 'k' });
const claim = (id) => ({ do: 'claim', task: id, reasons: ['ready'], rule: [1, 5, 12] });
const backlog = (id, title, options) => card(id, title, { folder: 'backlog', ...options });

export default [
  kase({
    name: 'claim-best',
    rows: [8],
    story: 'Ranked by priority, then by how many tasks each unblocks, then by id as a number: T999 comes before T1000. Tasks waiting on a dependency are not claimable.',
    commits: [{ at: at('09:30', 1), ops: [
      task('T003', 'Tidy the docs', { priority: 'low' }),
      task('T004', 'Speed up the build', { priority: 'high' }),
      task('T005', 'Fix the crash on save', { priority: 'urgent' }),
      task('T006', 'Split the parser', { priority: 'high' }),
      task('T007', 'Parse CSV', { depends: ['T006'] }),
      task('T008', 'Parse TSV', { depends: ['T006'] }),
      task('T010', 'Rename the flags'),
      task('T999', 'Cache the index', { priority: 'medium' }),
      task('T1000', 'Cache the thumbnails', { priority: 'medium' }),
    ] }],
    answer: answer({
      next: claim('T005'),
      take: [
        { task: 'T005', priority: 'urgent', unblocks: 0 },
        { task: 'T006', priority: 'high', unblocks: 2 },
        { task: 'T004', priority: 'high', unblocks: 0 },
        { task: 'T999', priority: 'medium', unblocks: 0 },
        { task: 'T1000', priority: 'medium', unblocks: 0 },
        { task: 'T003', priority: 'low', unblocks: 0 },
        { task: 'T010', unblocks: 0 },
      ],
      data: data({
        T005: backlog('T005', 'Fix the crash on save'),
        T006: backlog('T006', 'Split the parser'),
        T004: backlog('T004', 'Speed up the build'),
        T999: backlog('T999', 'Cache the index'),
        T1000: backlog('T1000', 'Cache the thumbnails'),
        T003: backlog('T003', 'Tidy the docs'),
        T010: backlog('T010', 'Rename the flags'),
      }),
      more: more('T005', 'backlog'),
    }),
  }),

  kase({
    name: 'skip-unready',
    rows: [8],
    story: 'A task with no Decision rules section, and one whose section holds only a placeholder, are not ready. Template guidance does not count; a rule after it does.',
    commits: [{ at: at('09:30', 1), ops: [
      task('T003', 'Plan the migration', { priority: 'high', ready: false }),
      task('T004', 'Archive old runs', { priority: 'medium', rules: '{{what counts as done,\nand what it may spend}}' }),
      task('T005', 'Fix the flaky test', { priority: 'low', rules: '*(say what done means,\nand what it may spend)*\n- Done means: it passes 20 runs in a row.' }),
      task('T006', 'Drop the old flag'),
    ] }],
    answer: answer({
      next: claim('T005'),
      rules: rules({ notReady: ['T003', 'T004'] }),
      take: [{ task: 'T005', priority: 'low', unblocks: 0 }, { task: 'T006', unblocks: 0 }],
      data: data({
        T005: backlog('T005', 'Fix the flaky test'),
        T006: backlog('T006', 'Drop the old flag'),
      }),
      more: more('T005', 'backlog'),
    }),
  }),

  kase({
    name: 'skip-unmet-depends',
    rows: [8],
    story: 'A task waiting on one in progress, and one depending on an id no file has, are skipped. A task whose dependency is done is claimable.',
    commits: [
      { at: at('09:30', 1), ops: [
        task('T001', 'Set up CI', { at: 'done' }),
        task('T002', 'Write the parser'),
        task('T003', 'Parse CSV', { depends: ['T002'] }),
        task('T004', 'Parse XML', { depends: ['T009'] }),
        task('T005', 'Badge the README', { depends: ['T001'] }),
      ] },
      { at: at('07:00'), by: 'bea', subject: 'claim T002', ops: [task('T002', 'Write the parser', { at: 'tasks', owner: BEA })] },
    ],
    answer: answer({
      next: claim('T005'),
      rules: rules({ used: 1 }),
      take: [{ task: 'T005', unblocks: 0 }],
      data: data({ T005: backlog('T005', 'Badge the README') }),
      more: more('T005', 'backlog'),
    }),
  }),

  kase({
    name: 'skip-killed-depends',
    rows: [8],
    story: 'A task depending on a killed one is never claimable, and is warned about.',
    commits: [{ at: at('09:30', 1), ops: [
      task('T001', 'Port to Python 2', { at: 'killed' }),
      task('T003', 'Ship the Python 2 wheels', { depends: ['T001'] }),
      task('T004', 'Ship the docs'),
    ] }],
    answer: answer({
      next: claim('T004'),
      take: [{ task: 'T004', unblocks: 0 }],
      warnings: [{ code: 'depends-killed', task: 'T003', on: 'T001' }],
      data: data({ T004: backlog('T004', 'Ship the docs') }),
      more: more('T004', 'backlog'),
    }),
  }),

  kase({
    name: 'skip-held-backlog',
    rows: [8],
    story: 'Another session runs on a backlog task it has not claimed yet: that task is held by another run, so the next one is claimed.',
    commits: [{ at: at('09:30', 1), ops: [task('T003', 'Rotate the keys'), task('T004', 'Prune the logs')] }],
    tree: { trails: { T003: [open(at('11:50'), 'ffff6666')] } },
    call: { run: ME },
    answer: answer({
      next: claim('T004'),
      inFlight: [{ task: 'T003', run: 'ffff6666', kind: 'open', since: at('11:50'), state: 'running', by: 'clock', until: at('12:20') }],
      take: [{ task: 'T004', unblocks: 0 }],
      data: data({ T004: backlog('T004', 'Prune the logs') }),
      more: more('T004', 'backlog'),
    }),
  }),

  kase({
    name: 'claim-on-other-branch',
    rows: [8],
    story: 'Another operator claimed the task on a branch not merged here. A claim is a commit on this branch (rule 1): at HEAD it is still in the backlog.',
    commits: [
      { at: at('09:30', 1), ops: [task('T003', 'Rotate the keys')] },
      'branch feature',
      { at: at('08:00'), by: 'bea', subject: 'claim T003', ops: [task('T003', 'Rotate the keys', { at: 'tasks', owner: BEA })] },
      'checkout main',
    ],
    answer: answer({
      next: claim('T003'),
      take: [{ task: 'T003', unblocks: 0 }],
      data: data({ T003: backlog('T003', 'Rotate the keys') }),
      more: more('T003', 'backlog'),
    }),
  }),

  kase({
    name: 'uncommitted-claim',
    rows: [8],
    story: 'The caller moved a task to tasks/ and has not committed the move. A claim is a commit, so at HEAD it is still claimable, and the change is warned about.',
    commits: [{ at: at('09:30', 1), ops: [task('T003', 'Rotate the keys'), task('T004', 'Prune the logs')] }],
    tree: {
      remove: [task('T003', 'Rotate the keys').path],
      files: { [task('T003', 'Rotate the keys', { at: 'tasks' }).path]: task('T003', 'Rotate the keys', { at: 'tasks', owner: owner(ME) }).content },
    },
    call: { run: ME },
    answer: answer({
      next: claim('T003'),
      take: [{ task: 'T003', unblocks: 0 }, { task: 'T004', unblocks: 0 }],
      warnings: [{ code: 'uncommitted-task-change', task: 'T003' }],
      data: data({
        T003: backlog('T003', 'Rotate the keys'),
        T004: backlog('T004', 'Prune the logs'),
      }),
      more: more('T003', 'backlog'),
    }),
  }),

  kase({
    name: 'no-wip-limit',
    rows: [8],
    story: 'wip.in_progress is 0: no limit, so three tasks in progress do not stop a claim. The board is warned about it (design N6).',
    yml: BASE_YML.replace('in_progress: 2', 'in_progress: 0'),
    commits: [
      { at: at('09:30', 1), ops: [task('T002', 'Clean the cache'), task('T003', 'Write the changelog'), task('T004', 'Tag the release'), task('T005', 'Announce the release')] },
      { at: at('07:00'), by: 'bea', subject: 'claim T002', ops: [task('T002', 'Clean the cache', { at: 'tasks', owner: BEA })] },
      { at: at('07:15'), by: 'bea', subject: 'claim T003', ops: [task('T003', 'Write the changelog', { at: 'tasks', owner: BEA })] },
      { at: at('07:30'), by: 'bea', subject: 'claim T004', ops: [task('T004', 'Tag the release', { at: 'tasks', owner: BEA })] },
    ],
    answer: answer({
      next: claim('T005'),
      rules: rules({ used: 3, limit: 0 }),
      take: [{ task: 'T005', unblocks: 0 }],
      warnings: [{ code: 'no-wip-limit' }],
      data: data({ T005: backlog('T005', 'Announce the release') }),
      more: more('T005', 'backlog'),
    }),
  }),
];
