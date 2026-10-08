// Deterministic, explainable agent routing. Given the agents, a stage, and the
// audit events of every run, choose the agent with the best score and explain
// the score (or the exclusion) of every candidate.

export const TIERS = ['haiku', 'sonnet', 'opus'];
const EXPLORATION = 0.3;
const UNDER_TIER_PENALTY = 0.3;
const OVER_TIER_COST = 0.05;
const LATENCY_PENALTY = 0.1;
const LATENCY_CEILING_MS = 10 * 60 * 1000;

const round = (value) => Math.round(value * 10000) / 10000 + 0; // + 0 turns -0 into 0

function emptyStats() {
  return { attempts: 0, successes: 0, failures: 0, rejections: 0, totalDurationMs: 0, timed: 0 };
}

// Stats are keyed by `${agentId}\u0000${role}`. A success is an attempt that
// finished and was approved, or finished on a stage without a gate. When a
// review or verify agent reports VERDICT: FAIL and the run goes back to an
// earlier stage, the reviewer is not charged (it did its job); the latest
// accepted attempt of the stage it returns to has its success turned into a
// rejection, so implement quality is learned from downstream verdicts.
export function performanceStats(runs) {
  const stats = new Map();
  const entryOf = (attempt) => stats.get(`${attempt.agentId}\u0000${attempt.role}`);
  for (const run of runs) {
    const attempts = new Map();
    const accepted = new Map();
    let sentBack = false;
    for (const event of run.events) {
      const data = event.data;
      if (event.type === 'attempt_dispatched') {
        if (!data.agentId) continue;
        attempts.set(data.attempt, { agentId: data.agentId, role: data.role, gate: data.gate, stageIndex: data.stageIndex, success: false });
        const key = `${data.agentId}\u0000${data.role}`;
        if (!stats.has(key)) stats.set(key, emptyStats());
        stats.get(key).attempts += 1;
        continue;
      }
      if (event.type === 'stage_moved') {
        const target = sentBack && data.to < data.from ? accepted.get(data.to) : null;
        if (target?.success) {
          entryOf(target).successes -= 1;
          entryOf(target).rejections += 1;
          target.success = false;
        }
        sentBack = false;
        continue;
      }
      const attempt = attempts.get(data?.attempt);
      if (!attempt) continue;
      const entry = entryOf(attempt);
      if (event.type === 'attempt_finished') {
        if (Number.isFinite(data.durationMs)) { entry.totalDurationMs += data.durationMs; entry.timed += 1; }
        if (data.outcome === 'failed' && data.verdict === 'FAIL') sentBack = true;
        else if (data.outcome === 'failed') entry.failures += 1;
        else if (data.outcome === 'succeeded') {
          accepted.set(attempt.stageIndex, attempt);
          if (attempt.gate !== 'approve') { entry.successes += 1; attempt.success = true; }
        }
      } else if (event.type === 'approved') {
        entry.successes += 1;
        attempt.success = true;
      } else if (event.type === 'rejected') entry.rejections += 1;
    }
  }
  return stats;
}

export function summarize(entry = emptyStats()) {
  const judged = entry.successes + entry.failures + entry.rejections;
  return {
    attempts: entry.attempts,
    successes: entry.successes,
    failures: entry.failures,
    rejections: entry.rejections,
    successRate: judged ? round(entry.successes / judged) : null,
    meanDurationMs: entry.timed ? Math.round(entry.totalDurationMs / entry.timed) : null,
  };
}

export function route({ agents, stage, stats, busy = new Map(), excluded = [], pinned = '' }) {
  const roleAttempts = agents.reduce((sum, agent) => sum + (stats.get(`${agent.id}\u0000${stage.role}`)?.attempts || 0), 0);
  const wanted = TIERS.indexOf(stage.tier);
  const scoreboard = agents.map((agent) => {
    const entry = stats.get(`${agent.id}\u0000${stage.role}`) || emptyStats();
    const summary = summarize(entry);
    const row = { agentId: agent.id, name: agent.name, tier: agent.tier, ...summary, eligible: false, score: null, reason: '' };
    if (!agent.enabled) return { ...row, reason: 'disabled' };
    if (agent.runner === 'human') return { ...row, reason: 'human executors are not routed' };
    if (!agent.roles.includes(stage.role)) return { ...row, reason: `does not take the ${stage.role} role` };
    if (excluded.includes(agent.id)) return { ...row, reason: 'excluded by a person for this stage' };
    if (pinned && agent.id !== pinned) return { ...row, reason: `stage is pinned to ${pinned}` };
    if ((busy.get(agent.id) || 0) >= agent.maxConcurrent) return { ...row, reason: `at capacity (${agent.maxConcurrent} running)` };
    const judged = entry.successes + entry.failures + entry.rejections;
    const quality = (entry.successes + 1) / (judged + 2);
    const explore = EXPLORATION * Math.sqrt(Math.log(roleAttempts + 1) / (entry.attempts + 1));
    const gap = wanted < 0 ? 0 : TIERS.indexOf(agent.tier) - wanted;
    const tierFit = gap < 0 ? gap * UNDER_TIER_PENALTY : -gap * OVER_TIER_COST;
    const latency = summary.meanDurationMs === null ? 0 : -LATENCY_PENALTY * Math.min(1, summary.meanDurationMs / LATENCY_CEILING_MS);
    const score = round(quality + explore + tierFit + latency);
    const parts = { quality: round(quality), explore: round(explore), tierFit: round(tierFit), latency: round(latency) };
    return { ...row, eligible: true, score, parts, reason: pinned ? 'pinned by a person' : 'eligible' };
  });
  const ranked = scoreboard.filter((row) => row.eligible).sort((a, b) => b.score - a.score
    || TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier)
    || a.agentId.localeCompare(b.agentId));
  scoreboard.sort((a, b) => Number(b.eligible) - Number(a.eligible) || (b.score ?? -Infinity) - (a.score ?? -Infinity) || a.agentId.localeCompare(b.agentId));
  const chosen = ranked[0] || null;
  if (chosen) chosen.reason = pinned ? 'pinned by a person' : ranked.length === 1 ? 'only eligible agent' : 'highest score';
  return { chosen: chosen?.agentId || '', scoreboard };
}
