// The method's own words, each with one plain line of meaning. AGE Aris is a
// method for running work with people and agents, so its views label things
// with the method's terms (WIP, cycle time, service level, stale claim) and
// explain each where it appears instead of replacing it with vaguer words.

export function escape(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

export const HEALTH_TONES = { green: 'done', amber: 'wait', red: 'fail', grey: 'idle' };
const HEALTH_WORDS = { green: 'On track', amber: 'Watch', red: 'Needs attention' };

// Green, amber and red read as words; grey keeps the engine's own label
// ("Not enough history", "Idle", "No work").
export function healthWord(health) {
  if (!health) return 'Not computed yet';
  return HEALTH_WORDS[health.level] || health.label || 'Not computed yet';
}

export function healthTone(health) {
  return HEALTH_TONES[health?.level] || 'idle';
}

// What needs a person, in the order Home lists it. `help` is the policy the
// items break.
export const NEEDS = [
  { kind: 'decision', term: 'Decisions', help: 'Runs stopped at a gate or waiting for input', tone: 'wait' },
  { kind: 'overdue', term: 'Overdue', help: 'Past the due date and not done', tone: 'fail' },
  { kind: 'stale', term: 'Stale claims', help: 'Agent claims with no commit or checkpoint within the stale threshold', tone: 'wait' },
  { kind: 'due_risk', term: 'Dates at risk', help: 'Unlikely to finish by the due date at the current pace', tone: 'wait' },
  { kind: 'aging', term: 'Aging WIP', help: 'In progress longer than 85% of finished work took', tone: 'wait' },
  { kind: 'blocked', term: 'Blocked', help: 'Waiting on something outside the task', tone: 'fail' },
  { kind: 'unassigned', term: 'No owner', help: 'Urgent work in progress that nobody holds', tone: 'wait' },
];
export const NEED = Object.fromEntries(NEEDS.map((entry) => [entry.kind, entry]));

// The health rules, read as the method's checks.
export const CHECKS = {
  H2: { name: 'Nothing overdue', help: 'Red when high or urgent work is past its due date; amber for any overdue task.' },
  H3: { name: 'WIP within its service level', help: 'Amber when a task in progress is older than the 85th-percentile cycle time of its type (or the project); red past twice that.' },
  H4: { name: 'Blocked work gets unblocked', help: 'Amber when a task stays blocked two working days; red when half or more of WIP is blocked.' },
  H5: { name: 'Work keeps flowing', help: 'Amber when there is WIP but nothing finished in the last five working days, or open work and nothing started or finished.' },
  H6: { name: 'Decisions answered within a working day', help: 'Amber when a run has waited more than a working day for a person.' },
  H7: { name: 'WIP within its limit', help: 'Amber when work in progress exceeds the board’s WIP limit.' },
  H8: { name: 'Agent claims show life', help: 'Amber when an agent’s claim shows no commit or checkpoint within the stale threshold.' },
};

// Flow terms with their one-line meaning.
export const TERMS = {
  throughput: ['Throughput', 'Tasks finished in the last 7 days'],
  usualWeek: ['Usual week', 'Finished per week in the 4 weeks before this one'],
  wip: ['WIP', 'Work in progress: tasks in progress or blocked'],
  cycle: ['Cycle time', 'Median time from the claim to done'],
  service: ['Service level', '85% of tasks finish within this cycle time'],
  lead: ['Lead time', 'Median time from filing to done'],
  lead85: ['Lead time, 85%', '85% of tasks finish this long after filing'],
  blockedShare: ['Blocked time', 'Share of WIP time spent blocked, last 30 days'],
  repeatSlips: ['Repeat slips', 'Tasks whose due date moved later more than once'],
};

// An agent session's short name: "adervark @k/b6192924" is "k·b619". The
// full identity goes in the title. Anything else is shown as given.
export function agentShort(identity) {
  const text = String(identity || '').replace(/^agent\s+/, '');
  const match = /@([^\s/]+)\/(\S+)/.exec(text);
  return match ? `${match[1]}·${match[2].slice(0, 4)}` : text;
}

// One of eight dot colours, stable per identity (the CSP allows no inline
// styles, so the colours are classes).
function hue(text) {
  let h = 0;
  for (const character of String(text)) h = (h * 31 + character.codePointAt(0)) % 9973;
  return h % 8;
}

// Who holds something: an agent session as a chip with a stable colour, a
// person as a name. `owner` is an identity string ("agent ade @k/b619…",
// "ade @k/b619…", a person's name) or the metrics' { kind, name, via } object.
export function ownerChip(owner) {
  if (!owner) return '';
  if (typeof owner === 'object') {
    if (owner.kind === 'unassigned') return '<span class="muted">Unassigned</span>';
    const via = owner.via ? ` <small class="muted">${escape(owner.via)}</small>` : '';
    return owner.kind === 'agent' ? `${agentChip(owner.name)}${via}` : `<span class="person-chip">${escape(owner.name)}</span>${via}`;
  }
  const text = String(owner).replace(/^agent\s+/, '');
  return /@[^\s/]+\/\S+/.test(text) ? agentChip(text) : `<span class="person-chip">${escape(text)}</span>`;
}

export function agentChip(identity) {
  const full = String(identity || '').replace(/^agent\s+/, '');
  return `<span class="agent-chip hue-${hue(full)}" title="Agent ${escape(full)}">${escape(agentShort(full))}</span>`;
}
