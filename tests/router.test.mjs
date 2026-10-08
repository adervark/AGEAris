import assert from 'node:assert/strict';
import test from 'node:test';

import { performanceStats, route, summarize } from '../lib/router.mjs';

const KEY = (agentId, role) => `${agentId}\u0000${role}`;

function agent(id, tier, overrides = {}) {
  return { id, name: id, tier, enabled: true, runner: 'command', roles: ['implement'], maxConcurrent: 1, ...overrides };
}

function entry(overrides = {}) {
  return { attempts: 0, successes: 0, failures: 0, rejections: 0, totalDurationMs: 0, timed: 0, ...overrides };
}

function statsOf(rows) {
  return new Map(Object.entries(rows).map(([key, value]) => [KEY(...key.split('/')), entry(value)]));
}

const STAGE = { role: 'implement', tier: 'sonnet' };

function row(result, agentId) {
  const found = result.scoreboard.find((candidate) => candidate.agentId === agentId);
  assert.ok(found, `Expected ${agentId} in the scoreboard`);
  return found;
}

// --- performanceStats -----------------------------------------------------------

const dispatched = (attempt, agentId, role, gate = 'none') => ({ type: 'attempt_dispatched', data: { attempt, agentId, role, gate } });
const finished = (attempt, outcome, extra = {}) => ({ type: 'attempt_finished', data: { attempt, outcome, ...extra } });

test('performanceStats counts attempts, successes, and failures for a stage without a gate', () => {
  const stats = performanceStats([{
    events: [
      dispatched(1, 'alpha', 'implement'), finished(1, 'succeeded', { durationMs: 100 }),
      dispatched(2, 'alpha', 'implement'), finished(2, 'failed', { durationMs: 300 }),
      dispatched(3, 'alpha', 'implement'), finished(3, 'succeeded'),
    ],
  }]);
  assert.deepEqual(stats.get(KEY('alpha', 'implement')), {
    attempts: 3, successes: 2, failures: 1, rejections: 0, totalDurationMs: 400, timed: 2,
  });
});

test('performanceStats does not count a gated success until a person approves it', () => {
  const stats = performanceStats([{
    events: [dispatched(1, 'alpha', 'plan', 'approve'), finished(1, 'succeeded', { durationMs: 10 })],
  }]);
  const plan = stats.get(KEY('alpha', 'plan'));
  assert.equal(plan.attempts, 1);
  assert.equal(plan.successes, 0);
});

test('performanceStats counts an approved gated attempt as a success', () => {
  const stats = performanceStats([{
    events: [
      dispatched(1, 'alpha', 'plan', 'approve'), finished(1, 'succeeded'), { type: 'approved', data: { attempt: 1 } },
    ],
  }]);
  assert.equal(stats.get(KEY('alpha', 'plan')).successes, 1);
});

test('performanceStats counts a rejected gated attempt as a rejection and not a success', () => {
  const stats = performanceStats([{
    events: [
      dispatched(1, 'alpha', 'plan', 'approve'), finished(1, 'succeeded'), { type: 'rejected', data: { attempt: 1 } },
    ],
  }]);
  const plan = stats.get(KEY('alpha', 'plan'));
  assert.equal(plan.rejections, 1);
  assert.equal(plan.successes, 0);
});

test('performanceStats keeps the same agent separate per role', () => {
  const stats = performanceStats([{
    events: [dispatched(1, 'alpha', 'plan'), finished(1, 'failed'), dispatched(2, 'alpha', 'implement'), finished(2, 'succeeded')],
  }]);
  assert.equal(stats.get(KEY('alpha', 'plan')).failures, 1);
  assert.equal(stats.get(KEY('alpha', 'implement')).successes, 1);
  assert.equal(stats.get(KEY('alpha', 'implement')).failures, 0);
});

test('performanceStats ignores attempts assigned to a person', () => {
  const stats = performanceStats([{ events: [dispatched(1, '', 'implement'), finished(1, 'succeeded')] }]);
  assert.equal(stats.size, 0);
});

test('performanceStats merges attempts with the same number from different runs separately', () => {
  const stats = performanceStats([
    { events: [dispatched(1, 'alpha', 'implement'), finished(1, 'failed')] },
    { events: [dispatched(1, 'beta', 'implement'), finished(1, 'succeeded')] },
  ]);
  assert.equal(stats.get(KEY('alpha', 'implement')).failures, 1);
  assert.equal(stats.get(KEY('beta', 'implement')).successes, 1);
});

// Events as the pipeline records them, with the stage index the stage_moved conversion relies on.
const dispatchedAt = (attempt, agentId, role, stageIndex, gate = 'none') => ({ type: 'attempt_dispatched', data: { attempt, agentId, role, gate, stageIndex } });
const movedBack = (from, to) => ({ type: 'stage_moved', data: { from, to, reason: 'review failed' } });

test('performanceStats turns the implementer\'s success into a rejection when a review VERDICT FAIL sends the run back, without charging the reviewer', () => {
  const stats = performanceStats([{
    events: [
      dispatchedAt(1, 'builder', 'implement', 0), finished(1, 'succeeded', { durationMs: 100 }),
      { type: 'stage_moved', data: { from: 0, to: 1, reason: 'Implement passed' } },
      dispatchedAt(2, 'checker', 'review', 1), finished(2, 'failed', { verdict: 'FAIL', durationMs: 50 }),
      movedBack(1, 0),
    ],
  }]);
  assert.deepEqual(stats.get(KEY('builder', 'implement')), {
    attempts: 1, successes: 0, failures: 0, rejections: 1, totalDurationMs: 100, timed: 1,
  });
  assert.deepEqual(stats.get(KEY('checker', 'review')), {
    attempts: 1, successes: 0, failures: 0, rejections: 0, totalDurationMs: 50, timed: 1,
  });
});

test('performanceStats charges a reviewer whose attempt failed without a FAIL verdict and leaves the implementer alone', () => {
  const stats = performanceStats([{
    events: [
      dispatchedAt(1, 'builder', 'implement', 0), finished(1, 'succeeded'),
      dispatchedAt(2, 'checker', 'review', 1), finished(2, 'failed', { verdict: 'MISSING' }),
      movedBack(1, 0),
    ],
  }]);
  assert.equal(stats.get(KEY('checker', 'review')).failures, 1);
  assert.equal(stats.get(KEY('builder', 'implement')).successes, 1);
  assert.equal(stats.get(KEY('builder', 'implement')).rejections, 0);
});

test('performanceStats only converts the latest accepted implement attempt and leaves a later passing one as a success', () => {
  const stats = performanceStats([{
    events: [
      dispatchedAt(1, 'builder', 'implement', 0), finished(1, 'succeeded'),
      dispatchedAt(2, 'checker', 'review', 1), finished(2, 'failed', { verdict: 'FAIL' }),
      movedBack(1, 0),
      dispatchedAt(3, 'builder', 'implement', 0), finished(3, 'succeeded'),
      { type: 'stage_moved', data: { from: 0, to: 1, reason: 'Implement passed' } },
      dispatchedAt(4, 'checker', 'review', 1), finished(4, 'succeeded', { verdict: 'PASS' }),
    ],
  }]);
  const builder = stats.get(KEY('builder', 'implement'));
  assert.equal(builder.attempts, 2);
  assert.equal(builder.rejections, 1);
  assert.equal(builder.successes, 1);
  assert.equal(stats.get(KEY('checker', 'review')).failures, 0);
});

test('performanceStats does not convert a success when the run moves back without a failed verdict', () => {
  const stats = performanceStats([{
    events: [
      dispatchedAt(1, 'builder', 'implement', 0), finished(1, 'succeeded'),
      movedBack(1, 0),
    ],
  }]);
  assert.equal(stats.get(KEY('builder', 'implement')).successes, 1);
  assert.equal(stats.get(KEY('builder', 'implement')).rejections, 0);
});

test('summarize reports null rates for an agent with no judged attempts', () => {
  assert.deepEqual(summarize(), {
    attempts: 0, successes: 0, failures: 0, rejections: 0, successRate: null, meanDurationMs: null,
  });
});

test('summarize computes the success rate over successes, failures, and rejections', () => {
  const summary = summarize(entry({ attempts: 4, successes: 1, failures: 1, rejections: 2, totalDurationMs: 600, timed: 3 }));
  assert.equal(summary.successRate, 0.25);
  assert.equal(summary.meanDurationMs, 200);
});

// --- route ------------------------------------------------------------------------

test('route prefers the agent matching the stage tier over a lower tier', () => {
  const result = route({ agents: [agent('small', 'haiku'), agent('exact', 'sonnet')], stage: STAGE, stats: new Map() });
  assert.equal(result.chosen, 'exact');
  assert.ok(row(result, 'exact').score > row(result, 'small').score);
  assert.equal(row(result, 'small').parts.tierFit, -0.3);
});

test('route prefers the agent matching the stage tier over a higher tier because of cost', () => {
  const result = route({ agents: [agent('big', 'opus'), agent('exact', 'sonnet')], stage: STAGE, stats: new Map() });
  assert.equal(result.chosen, 'exact');
  assert.equal(row(result, 'big').parts.tierFit, -0.05);
});

test('route prefers a higher tier over a lower tier when neither matches', () => {
  const result = route({ agents: [agent('small', 'haiku'), agent('big', 'opus')], stage: STAGE, stats: new Map() });
  assert.equal(result.chosen, 'big');
});

test('route prefers an agent with a better record for the role over an equal-tier agent with failures', () => {
  const stats = statsOf({
    'proven/implement': { attempts: 4, successes: 4 },
    'flaky/implement': { attempts: 4, failures: 4 },
  });
  const result = route({ agents: [agent('flaky', 'sonnet'), agent('proven', 'sonnet')], stage: STAGE, stats });
  assert.equal(result.chosen, 'proven');
  assert.ok(row(result, 'proven').parts.quality > row(result, 'flaky').parts.quality);
});

test('route ignores a record earned in a different role', () => {
  const stats = statsOf({ 'flaky/plan': { attempts: 9, failures: 9 } });
  const result = route({ agents: [agent('flaky', 'sonnet', { roles: ['plan', 'implement'] }), agent('plain', 'sonnet')], stage: STAGE, stats });
  assert.equal(row(result, 'flaky').parts.quality, row(result, 'plain').parts.quality);
});

test('route explores an untried agent when the leader has many attempts and a mediocre record', () => {
  const stats = statsOf({ 'veteran/implement': { attempts: 20, successes: 12, failures: 8 } });
  const result = route({ agents: [agent('veteran', 'sonnet'), agent('fresh', 'sonnet')], stage: STAGE, stats });
  assert.equal(result.chosen, 'fresh');
  assert.ok(row(result, 'fresh').parts.explore > row(result, 'veteran').parts.explore);
  assert.ok(row(result, 'fresh').parts.quality < row(result, 'veteran').parts.quality);
});

test('route keeps the leader when its record is strong enough to outweigh exploration', () => {
  const stats = statsOf({ 'veteran/implement': { attempts: 20, successes: 20 } });
  const result = route({ agents: [agent('veteran', 'sonnet'), agent('fresh', 'sonnet')], stage: STAGE, stats });
  assert.equal(result.chosen, 'veteran');
});

test('route gives an untried agent no exploration bonus when nobody has history', () => {
  const result = route({ agents: [agent('a', 'sonnet')], stage: STAGE, stats: new Map() });
  assert.equal(row(result, 'a').parts.explore, 0);
  assert.equal(row(result, 'a').score, 0.5);
});

test('route penalises a slow agent by up to the latency ceiling', () => {
  const stats = statsOf({
    'slow/implement': { attempts: 1, successes: 1, totalDurationMs: 20 * 60 * 1000, timed: 1 },
    'quick/implement': { attempts: 1, successes: 1, totalDurationMs: 1000, timed: 1 },
  });
  const result = route({ agents: [agent('slow', 'sonnet'), agent('quick', 'sonnet')], stage: STAGE, stats });
  assert.equal(row(result, 'slow').parts.latency, -0.1);
  assert.equal(result.chosen, 'quick');
});

test('route marks a disabled agent ineligible with the reason disabled', () => {
  const result = route({ agents: [agent('off', 'sonnet', { enabled: false }), agent('on', 'sonnet')], stage: STAGE, stats: new Map() });
  assert.deepEqual([row(result, 'off').eligible, row(result, 'off').reason, row(result, 'off').score], [false, 'disabled', null]);
  assert.equal(result.chosen, 'on');
});

test('route marks an agent that does not take the role as ineligible with that reason', () => {
  const result = route({ agents: [agent('planner', 'sonnet', { roles: ['plan'] }), agent('worker', 'haiku')], stage: STAGE, stats: new Map() });
  assert.equal(row(result, 'planner').eligible, false);
  assert.equal(row(result, 'planner').reason, 'does not take the implement role');
  assert.equal(result.chosen, 'worker');
});

test('route marks an excluded agent as ineligible with the exclusion reason', () => {
  const result = route({ agents: [agent('a', 'sonnet'), agent('b', 'sonnet')], stage: STAGE, stats: new Map(), excluded: ['a'] });
  assert.equal(row(result, 'a').eligible, false);
  assert.equal(row(result, 'a').reason, 'excluded by a person for this stage');
  assert.equal(result.chosen, 'b');
});

test('route marks every other agent ineligible when a stage is pinned', () => {
  const result = route({ agents: [agent('a', 'sonnet'), agent('b', 'sonnet')], stage: STAGE, stats: new Map(), pinned: 'b' });
  assert.equal(row(result, 'a').eligible, false);
  assert.equal(row(result, 'a').reason, 'stage is pinned to b');
});

test('route chooses the pinned agent even when another agent scores higher', () => {
  const stats = statsOf({
    'proven/implement': { attempts: 4, successes: 4 },
    'weak/implement': { attempts: 4, failures: 4 },
  });
  const result = route({ agents: [agent('proven', 'sonnet'), agent('weak', 'haiku')], stage: STAGE, stats, pinned: 'weak' });
  assert.equal(result.chosen, 'weak');
  assert.equal(row(result, 'weak').reason, 'pinned by a person');
});

test('route chooses nothing when the pinned agent is not usable', () => {
  const result = route({ agents: [agent('a', 'sonnet'), agent('b', 'sonnet', { enabled: false })], stage: STAGE, stats: new Map(), pinned: 'b' });
  assert.equal(result.chosen, '');
});

test('route marks an agent at capacity as ineligible with the running count', () => {
  const busy = new Map([['a', 2]]);
  const result = route({ agents: [agent('a', 'sonnet', { maxConcurrent: 2 }), agent('b', 'haiku')], stage: STAGE, stats: new Map(), busy });
  assert.equal(row(result, 'a').eligible, false);
  assert.equal(row(result, 'a').reason, 'at capacity (2 running)');
  assert.equal(result.chosen, 'b');
});

test('route keeps an agent eligible while it is below its concurrency limit', () => {
  const busy = new Map([['a', 1]]);
  const result = route({ agents: [agent('a', 'sonnet', { maxConcurrent: 2 })], stage: STAGE, stats: new Map(), busy });
  assert.equal(result.chosen, 'a');
});

test('route never routes to a human executor', () => {
  const result = route({ agents: [agent('person', 'sonnet', { runner: 'human' })], stage: STAGE, stats: new Map() });
  assert.equal(result.chosen, '');
  assert.equal(row(result, 'person').reason, 'human executors are not routed');
});

test('route breaks a score tie in favour of the cheaper tier', () => {
  const stage = { role: 'implement', tier: 'unspecified' };
  const result = route({ agents: [agent('a-opus', 'opus'), agent('z-haiku', 'haiku')], stage, stats: new Map() });
  assert.equal(row(result, 'a-opus').score, row(result, 'z-haiku').score);
  assert.equal(result.chosen, 'z-haiku');
});

test('route breaks a tie within a tier by agent id', () => {
  const result = route({ agents: [agent('b', 'sonnet'), agent('a', 'sonnet')], stage: STAGE, stats: new Map() });
  assert.equal(result.chosen, 'a');
});

test('route returns an empty choice when no agent is eligible', () => {
  const result = route({ agents: [agent('a', 'sonnet', { enabled: false }), agent('b', 'sonnet', { roles: ['plan'] })], stage: STAGE, stats: new Map() });
  assert.equal(result.chosen, '');
  assert.equal(result.scoreboard.length, 2);
  assert.ok(result.scoreboard.every((candidate) => !candidate.eligible));
});

test('route returns an empty choice and scoreboard for an empty agent list', () => {
  assert.deepEqual(route({ agents: [], stage: STAGE, stats: new Map() }), { chosen: '', scoreboard: [] });
});

test('route labels a lone eligible agent as the only eligible agent and the winner as highest score', () => {
  const alone = route({ agents: [agent('a', 'sonnet')], stage: STAGE, stats: new Map() });
  assert.equal(row(alone, 'a').reason, 'only eligible agent');
  const contested = route({ agents: [agent('a', 'sonnet'), agent('b', 'haiku')], stage: STAGE, stats: new Map() });
  assert.equal(row(contested, 'a').reason, 'highest score');
});

test('route lists eligible agents before ineligible ones, best score first', () => {
  const result = route({
    agents: [agent('off', 'opus', { enabled: false }), agent('small', 'haiku'), agent('exact', 'sonnet')],
    stage: STAGE,
    stats: new Map(),
  });
  assert.deepEqual(result.scoreboard.map((candidate) => candidate.agentId), ['exact', 'small', 'off']);
});

test('route is deterministic for identical input', () => {
  const agents = [agent('veteran', 'sonnet'), agent('fresh', 'sonnet'), agent('off', 'opus', { enabled: false }), agent('small', 'haiku')];
  const stats = statsOf({ 'veteran/implement': { attempts: 20, successes: 12, failures: 8, totalDurationMs: 5000, timed: 2 } });
  const input = { agents, stage: STAGE, stats, busy: new Map([['small', 1]]), excluded: [], pinned: '' };
  assert.deepEqual(route(input), route(input));
});
