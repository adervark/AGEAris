import { answer, at, budgeted, card, clean, data, did, HANDOFF, kase, NOW_TEXT, more, open, owner, blocked, rules, task } from '../corpus.mjs';

// The budget (§8). Each answer here is written whole, then cut as §8 says:
// the last key of data first, then the last entry of take, then of you.

// budget-cuts: titles over their 160-byte cap, and trail nexts just under
// their 240, which are kept whole.
const LONG = 'migrate the ledger to the new storage format without losing a single entry, then check every balance against the old ledger, account by account, and keep the old one readable until the auditors have signed it off';
const NEXT = 'compare the balances of the first hundred accounts by hand, then run the full comparison overnight and read its report in the morning before anything else is touched, because a mismatch found late costs a day of unwinding';
const steps = Array.from({ length: 12 }, (_, index) => {
  const id = `T${String(index + 1).padStart(3, '0')}`;
  return { id, title: `Step ${index + 1}: ${LONG}`, next: `${NEXT} (step ${index + 1})` };
});

// budget-worst-case: a board near the largest answer, with six-digit ids and
// run ids of three parts of twelve characters. The caller holds twelve
// tasks, and another session runs on each.
const CALLER = 'aaaaaaaaaaaa.bbbbbbbbbbbb.cccccccccccc';
const held = Array.from({ length: 12 }, (_, index) => ({
  id: `T${100001 + index}`,
  title: `Hold line ${index + 1}`,
  run: `zzzzzzzzzz${String(index + 1).padStart(2, '0')}.yyyyyyyyyyyy.xxxxxxxxxxxx`,
}));
const unready = Array.from({ length: 21 }, (_, index) => ({ id: `T${200001 + index}`, title: `Idea ${index + 1}` }));
const ready = Array.from({ length: 12 }, (_, index) => ({ id: `T${300001 + index}`, title: `Chore ${index + 1}` }));
const SPEND = Array.from({ length: 12 }, (_, index) => `${String.fromCharCode(97 + index)}-${'cost'.repeat(12)}`);
const WORST_YML = [
  'spend:',
  ...SPEND.map((word) => `  - ${word}`),
  'wip:',
  '  in_progress: 9999',
  '  blocked: 9999',
  'stale_hours: 8760',
  'live_minutes: 525600',
  '',
].join('\n');
const UNTIL = '2027-10-10T11:44:00Z';   // 11:45, plus 525599 minutes

export default [
  kase({
    name: 'budget-cuts',
    rows: [8],
    story: 'Twelve ready tasks whose titles are over their cap, and whose trail nexts are just under theirs and kept whole. take keeps ten, and the budget of 4096 cuts entries from the end of data.',
    commits: [{ at: at('09:30', 1), ops: steps.map(({ id, title }) => task(id, title)) }],
    tree: { trails: Object.fromEntries(steps.map(({ id, next }, index) => [id, [
      open(at('09:00', 5), `bbbb${String(index + 1).padStart(4, '0')}`),
      did(at('09:30', 5), `bbbb${String(index + 1).padStart(4, '0')}`, { what: 'scoped it', next }),
    ]])) },
    call: { budget: 4096 },
    answer: budgeted(answer({
      next: { do: 'claim', task: 'T001', reasons: ['ready'], rule: [1, 5, 12] },
      take: steps.slice(0, 10).map(({ id }) => ({ task: id, unblocks: 0 })),
      data: data(Object.fromEntries(steps.slice(0, 10).map(({ id, title, next }) => [id, card(id, clean(title, 160), {
        folder: 'backlog',
        file: task(id, title).path.split('/').at(-1),
        next: clean(next, 240),
      })]))),
      more: more('T001', 'backlog'),
      cut: { take: 2 },
    }), 4096),
  }),

  kase({
    name: 'budget-worst-case',
    rows: [5],
    story: 'A board near the largest answer: twelve tasks of the caller each held by another session, twelve runs in flight, thirteen warnings, twenty-one tasks not ready, twelve spend words, six-digit ids and the longest run ids. At the least budget, 4096, data and take are cut whole and you in part, and the rest fits.',
    yml: WORST_YML,
    commits: [
      { at: at('09:30', 1), ops: [
        ...held.map(({ id, title }) => task(id, title)),
        ...unready.map(({ id, title }) => task(id, title, { ready: false })),
        ...ready.map(({ id, title }) => task(id, title)),
      ] },
      { at: at('08:00'), subject: 'claim the held tasks', ops: held.map(({ id, title }) => task(id, title, { at: 'tasks', owner: owner('aaaaaaaaaaaa') })) },
    ],
    tree: { trails: Object.fromEntries(held.map(({ id, run }) => [id, [
      open(at('11:40'), run, { operator: 'bea', profile: 'k' }),
      '{not json',
      blocked(at('11:45'), run, { what: 'waiting on the vendor', unblocks: 'the vendor answers', next: 'retry the call' }),
    ]])) },
    call: { run: CALLER, budget: 4096, remote: true },
    answer: budgeted(answer({
      remote: { moved: 'unknown', checkedAt: '2026-10-10T12:00:00Z' },
      next: { do: 'wait', task: 'T100001', run: held[0].run, by: 'clock', since: at('11:45'), until: UNTIL, reasons: ['held-elsewhere'], rule: [3, 6] },
      rules: rules({ used: 12, limit: 9999, blockedLimit: 9999, staleHours: 8760, liveMinutes: 525599, notReady: unready.slice(0, 20).map(({ id }) => id) }),
      you: held.slice(0, 10).map(({ id, run }) => ({ task: id, column: 'in_progress', heldBy: run })),
      inFlight: held.slice(0, 10).map(({ id, run }) => ({ task: id, run, kind: 'blocked', since: at('11:45'), state: 'running', by: 'clock', until: UNTIL })),
      take: ready.slice(0, 10).map(({ id }) => ({ task: id, unblocks: 0 })),
      warnings: [
        { code: 'live-minutes-clamped' },
        ...held.slice(0, 9).map(({ id }) => ({ code: 'trail-malformed', task: id, line: 2, n: 1 })),
      ],
      data: data({
        T100001: card('T100001', held[0].title, { next: 'retry the call', handoff: HANDOFF }),
        ...Object.fromEntries(held.slice(1, 10).map(({ id, title }) => [id, card(id, title, { next: 'retry the call' })])),
        ...Object.fromEntries(ready.slice(0, 10).map(({ id, title }) => [id, card(id, title, { folder: 'backlog' })])),
      }, { spend: SPEND.slice(0, 10).map((word) => clean(word, 40)), now: { text: NOW_TEXT, file: 'AA/STATE.md' } }),
      more: more('T100001'),
      cut: { inFlight: 2, warnings: 3, notReady: 1, you: 2, take: 2, spend: 2 },
    }), 4096),
  }),
];
