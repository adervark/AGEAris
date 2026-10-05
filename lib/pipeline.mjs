import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { appendEvents, buildEvent, readEvents, sha256, verifyChain } from './audit.mjs';
import { ROLES } from './agents.mjs';
import { performanceStats, route, summarize, TIERS } from './router.mjs';
import { assertNotSymlink, cleanLine, cleanText, fail, git, hash, PROJECT_ID } from './workspace.mjs';

const RUN_ID = /^R(\d{3,})$/;
const STAGE_ID = /^[a-z][a-z0-9-]{0,29}$/;
const MAX_CAPTURE = 512 * 1024;
const MAX_PROMPT_SECTION = 12000;
const MAX_ATTEMPTS_PER_RUN = 50;
const ACTIVE = new Set(['queued', 'running', 'awaiting_input']);
const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
const SYSTEM = { type: 'system', id: 'agesight' };

const DEFAULT_STAGES = [
  { id: 'triage', name: 'Triage', role: 'triage', tier: 'haiku', executor: 'agent', gate: 'none', verdict: false, maxAttempts: 2, onFail: 'retry', pinnedAgent: '', instructions: 'Assess scope, risk, and unknowns. Say what is in and out of scope, and name anything a person must decide first.' },
  { id: 'plan', name: 'Plan', role: 'plan', tier: 'opus', executor: 'agent', gate: 'approve', verdict: false, maxAttempts: 3, onFail: 'retry', pinnedAgent: '', instructions: 'Write the smallest numbered plan that meets the goal, with an acceptance check for each step.' },
  { id: 'implement', name: 'Implement', role: 'implement', tier: 'sonnet', executor: 'agent', gate: 'none', verdict: false, maxAttempts: 3, onFail: 'retry', pinnedAgent: '', instructions: 'Carry out the approved plan. Report what you did for each step and anything you could not do.' },
  { id: 'review', name: 'Review', role: 'review', tier: 'opus', executor: 'agent', gate: 'approve', verdict: true, maxAttempts: 3, onFail: 'goto:implement', pinnedAgent: '', instructions: 'Review the implementation against the plan and the goal. List defects by severity.' },
  { id: 'verify', name: 'Verify', role: 'verify', tier: 'sonnet', executor: 'agent', gate: 'none', verdict: true, maxAttempts: 2, onFail: 'goto:implement', pinnedAgent: '', instructions: 'Check every acceptance check in the plan against the results, citing evidence for each.' },
];

function cleanStages(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 20) fail(400, 'A pipeline needs 1 to 20 stages');
  const ids = [];
  return input.map((raw, index) => {
    if (!raw || typeof raw !== 'object') fail(400, `Stage ${index + 1} is invalid`);
    const label = `Stage ${index + 1}`;
    const stage = {
      id: cleanLine(raw.id, `${label} id`, { required: true, max: 30 }),
      name: cleanLine(raw.name, `${label} name`, { required: true, max: 60 }),
      role: raw.role,
      tier: raw.tier ?? 'sonnet',
      executor: raw.executor ?? 'agent',
      gate: raw.gate ?? 'none',
      verdict: raw.verdict ?? false,
      maxAttempts: raw.maxAttempts ?? 3,
      onFail: raw.onFail ?? 'retry',
      pinnedAgent: cleanLine(raw.pinnedAgent ?? '', `${label} pinned agent`, { max: 40 }),
      instructions: cleanText(raw.instructions ?? '', `${label} instructions`, { max: 8000 }),
    };
    if (!STAGE_ID.test(stage.id)) fail(400, `${label} id must start with a letter and use lowercase letters, digits, and hyphens`);
    if (ids.includes(stage.id)) fail(400, `Stage id ${stage.id} is used twice`);
    if (!ROLES.includes(stage.role)) fail(400, `${label} role must be one of: ${ROLES.join(', ')}`);
    if (!TIERS.includes(stage.tier)) fail(400, `${label} tier must be one of: ${TIERS.join(', ')}`);
    if (!['agent', 'human'].includes(stage.executor)) fail(400, `${label} executor must be agent or human`);
    if (!['none', 'approve'].includes(stage.gate)) fail(400, `${label} gate must be none or approve`);
    if (typeof stage.verdict !== 'boolean') fail(400, `${label} verdict must be true or false`);
    if (!Number.isInteger(stage.maxAttempts) || stage.maxAttempts < 1 || stage.maxAttempts > 10) fail(400, `${label} maxAttempts must be an integer from 1 to 10`);
    const target = /^goto:(.+)$/.exec(stage.onFail)?.[1];
    if (!['retry', 'stop'].includes(stage.onFail) && !(target && ids.includes(target))) {
      fail(400, `${label} onFail must be retry, stop, or goto:<an earlier stage id>`);
    }
    ids.push(stage.id);
    return stage;
  });
}

function serializeEvents(events) {
  return events.map((event) => `${JSON.stringify(event)}\n`).join('');
}

function inside(run, relative) {
  const path = resolve(run.dir, relative);
  if (!path.startsWith(run.dir + sep)) fail(500, `Run ${run.localId} refers to a file outside its folder`);
  return path;
}

// The exact argument list for a stage: an agent's acting arguments (such as a
// permission flag) are added only in the roles it is trusted to act in.
function argvFor(agent, role) {
  return [...agent.command, ...((agent.actRoles || []).includes(role) ? agent.actArgs || [] : [])];
}

function killTree(child, signal) {
  try { process.kill(-child.pid, signal); } catch {
    try { child.kill(signal); } catch { /* already gone */ }
  }
}

function clip(text, limit = MAX_PROMPT_SECTION) {
  return text.length > limit ? `${text.slice(0, limit)}\n\n[… ${text.length - limit} more characters in the stored artifact]` : text;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// --- Run state is a pure projection of the audit events. ---------------------

// A run can dispatch its next attempt: it is moving, not paused, and has no
// attempt in flight.
function canAdvance(state) {
  return !state.paused && ['running', 'waiting'].includes(state.status) && !state.attempts.some((attempt) => ACTIVE.has(attempt.status));
}

function attemptOf(state, n) {
  return state.attempts.find((attempt) => attempt.n === n);
}

function applyEvent(state, event) {
  const data = event.data;
  const attempt = data && 'attempt' in data ? attemptOf(state, data.attempt) : null;
  if (data && 'attempt' in data && event.type !== 'attempt_dispatched' && !attempt) {
    throw new Error(`event ${event.seq} refers to unknown attempt ${data.attempt}`);
  }
  switch (event.type) {
    case 'run_started':
      Object.assign(state, {
        id: data.runId, taskId: data.taskId, taskTitle: data.taskTitle, pipeline: data.pipeline,
        startedBy: event.actor.id, startedAt: event.at, status: 'running', stageIndex: 0,
      });
      break;
    case 'attempt_dispatched':
      state.attempts.push({
        n: data.attempt, stageId: data.stageId, stageIndex: data.stageIndex, role: data.role, gate: data.gate,
        agentId: data.agentId, runner: data.runner, reason: data.reason, scoreboard: data.scoreboard,
        status: data.runner === 'pull' ? 'queued' : data.runner === 'human' ? 'awaiting_input' : 'running',
        dispatchedAt: event.at, files: { prompt: data.promptFile }, promptHash: data.promptHash, command: data.command,
      });
      state.status = data.runner === 'human' ? 'awaiting_input' : 'running';
      state.waitingReason = '';
      break;
    case 'attempt_claimed':
      Object.assign(attempt, { status: 'running', leaseUntil: data.leaseUntil, claimedAt: event.at });
      break;
    case 'lease_renewed':
      attempt.leaseUntil = data.leaseUntil;
      break;
    case 'lease_expired':
      Object.assign(attempt, { status: 'queued', leaseUntil: '' });
      break;
    case 'attempt_finished':
      Object.assign(attempt, {
        status: data.outcome, finishedAt: event.at, durationMs: data.durationMs, exitCode: data.exitCode,
        error: data.error, verdict: data.verdict, outputHash: data.outputHash, finishedBy: event.actor.id,
      });
      attempt.files.output = data.outputFile;
      if (data.stderrFile) { attempt.files.stderr = data.stderrFile; attempt.stderrHash = data.stderrHash; }
      if (data.outcome === 'failed') state.failures[attempt.stageId] = (state.failures[attempt.stageId] || 0) + 1;
      if (state.status === 'awaiting_input') state.status = 'running';
      break;
    case 'attempt_cancelled':
      Object.assign(attempt, { status: 'cancelled', error: data.reason, finishedAt: event.at });
      if (state.status === 'awaiting_input') state.status = 'running';
      break;
    case 'gate_opened':
      attempt.status = 'awaiting_approval';
      state.status = 'awaiting_approval';
      break;
    case 'output_edited':
      attempt.files.edited = data.file;
      attempt.editedHash = data.outputHash;
      attempt.editedBy = event.actor.id;
      break;
    case 'approved':
      attempt.status = 'approved';
      attempt.decision = { by: event.actor.id, at: event.at, comment: data.comment };
      break;
    case 'rejected':
      attempt.status = 'rejected';
      attempt.decision = { by: event.actor.id, at: event.at, comment: data.feedback };
      (state.feedback[data.targetStage] ||= []).push({ fromStage: attempt.stageId, attempt: attempt.n, text: data.feedback, by: event.actor.id, at: event.at });
      break;
    case 'routing_set':
      if (data.pinAgent) state.pins[data.stageId] = data.pinAgent;
      else delete state.pins[data.stageId];
      state.exclusions[data.stageId] = data.exclude;
      break;
    case 'stage_moved':
      state.stageIndex = data.to;
      state.status = 'running';
      break;
    case 'waiting':
      state.status = 'waiting';
      state.waitingReason = data.reason;
      break;
    case 'paused':
      state.paused = true;
      break;
    case 'resumed':
      state.paused = false;
      break;
    case 'retried':
      state.status = 'running';
      state.attemptBase = state.attempts.length;
      state.failures = {};
      state.error = '';
      break;
    case 'cancelled':
      state.status = 'cancelled';
      for (const entry of state.attempts) if (ACTIVE.has(entry.status) || entry.status === 'awaiting_approval') entry.status = 'cancelled';
      break;
    case 'run_failed':
      state.status = 'failed';
      state.error = data.reason;
      break;
    case 'run_completed':
      state.status = 'completed';
      state.completedAt = event.at;
      break;
    case 'commented':
      state.comments.push({ by: event.actor.id, at: event.at, text: data.text, stageId: data.stageId || '' });
      break;
    case 'task_sync_failed':
      state.taskSyncError = data.error;
      break;
    default:
      break;
  }
  state.lastSeq = event.seq;
  state.updatedAt = event.at;
  return state;
}

function reduce(events) {
  const state = { status: 'running', paused: false, stageIndex: 0, attempts: [], feedback: {}, pins: {}, exclusions: {}, failures: {}, comments: [], error: '', waitingReason: '', attemptBase: 0, lastSeq: 0 };
  for (const event of events) applyEvent(state, event);
  return state;
}

function describe(event, state) {
  const stage = (id) => state.pipeline?.find((entry) => entry.id === id)?.name || id;
  const attempt = event.data?.attempt ? attemptOf(state, event.data.attempt) : null;
  const who = event.actor.id;
  switch (event.type) {
    case 'run_started': return `started by ${who}`;
    case 'attempt_dispatched': return `${stage(event.data.stageId)} attempt ${event.data.attempt} ${event.data.runner === 'human' ? 'assigned to a person' : `routed to ${event.data.agentId}`}`;
    case 'attempt_claimed': return `${attempt ? stage(attempt.stageId) : 'attempt'} claimed by ${who}`;
    case 'attempt_finished': return `${attempt ? stage(attempt.stageId) : 'attempt'} ${event.data.outcome} (${who})`;
    case 'attempt_cancelled': return `${attempt ? stage(attempt.stageId) : 'attempt'} attempt cancelled by ${who}`;
    case 'gate_opened': return `${attempt ? stage(attempt.stageId) : 'stage'} awaiting approval`;
    case 'output_edited': return `${attempt ? stage(attempt.stageId) : 'stage'} output edited by ${who}`;
    case 'approved': return `${attempt ? stage(attempt.stageId) : 'stage'} approved by ${who}`;
    case 'rejected': return `${attempt ? stage(attempt.stageId) : 'stage'} sent back to ${stage(event.data.targetStage)} by ${who}`;
    case 'routing_set': return `routing for ${stage(event.data.stageId)} changed by ${who}`;
    case 'stage_moved': return `moved to ${state.pipeline?.[event.data.to]?.name || 'next stage'}`;
    case 'run_completed': return 'completed';
    case 'run_failed': return `failed: ${event.data.reason}`;
    default: return `${event.type.replace(/_/g, ' ')} by ${who}`;
  }
}

function renderRunMarkdown(state) {
  const lines = [
    `# Run ${state.id} — ${state.taskTitle}`,
    '',
    `- **Task:** ${state.taskId.split(':').at(-1)}`,
    `- **Status:** ${state.status}${state.paused ? ' (paused)' : ''}`,
    `- **Started:** ${state.startedAt} by ${state.startedBy}`,
    `- **Updated:** ${state.updatedAt}`,
    '',
    'This file is generated from `events.jsonl`, the hash-chained audit log. Edit nothing here by hand.',
    '',
    '| # | Stage | Agent | Status | Decision |',
    '|---|---|---|---|---|',
    ...state.attempts.map((attempt) => `| ${attempt.n} | ${attempt.stageId} | ${attempt.agentId || 'person'} | ${attempt.status} | ${(attempt.decision ? `${attempt.decision.by}: ${attempt.decision.comment || ''}` : '').replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`),
    '',
  ];
  return lines.join('\n');
}

// --- Engine -------------------------------------------------------------------

export class PipelineEngine {
  constructor({ workspace, registry, maxParallel = 4, leaseMs = 10 * 60 * 1000, tickMs = 1000, workdirRoot = '' }) {
    this.workspace = workspace;
    this.workdirRoot = workdirRoot || join(workspace.dataDir, 'workdirs');
    this.registry = registry;
    this.maxParallel = maxParallel;
    this.leaseMs = leaseMs;
    this.tickMs = tickMs;
    this.runs = new Map();
    this.processes = new Map();
    this.launching = new Set();
    this.unrecorded = new Map();
    this.inflight = new Set();
    this._ticking = null;
    this._again = false;
    this._timer = null;
  }

  get human() {
    return { type: 'human', id: this.workspace.operator };
  }

  async init() {
    this._initializing = true;
    await this.workspace.init();
    for (const entry of await readdir(this.workspace.projectsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !PROJECT_ID.test(entry.name)) continue;
      const runsDir = join(this.workspace.projectsDir, entry.name, 'pipeline', 'runs');
      let runDirs;
      try { runDirs = await readdir(runsDir, { withFileTypes: true }); } catch (error) {
        if (error?.code === 'ENOENT') continue;
        throw error;
      }
      for (const runDir of runDirs) {
        if (!runDir.isDirectory() || !RUN_ID.test(runDir.name)) continue;
        await this._load(entry.name, runDir.name);
      }
    }
    await this._recoverOrphans([...this.runs.values()].filter((run) => run.integrity.ok), 'Interrupted: AGESight stopped while this attempt was running');
    this._initializing = false;
    return this;
  }

  // A run whose log cannot be read or replayed is still listed, flagged as
  // failing verification, so one damaged run never hides the others.
  async _load(projectId, localId) {
    const dir = join(this.workspace.projectsDir, projectId, 'pipeline', 'runs', localId);
    await assertNotSymlink(dir);
    const run = { id: `${projectId}:${localId}`, projectId, localId, dir, events: [], integrity: { ok: true } };
    try {
      run.events = await readEvents(join(dir, 'events.jsonl'));
      run.integrity = this._checkAnchor(run, verifyChain(run.events));
    } catch (error) {
      run.integrity = { ok: false, count: 0, brokenAt: Number(/line (\d+)/.exec(error.message)?.[1]) || 1, reason: error.message };
    }
    try { run.state = reduce(run.events); } catch (error) {
      if (run.integrity.ok) run.integrity = { ok: false, count: run.events.length, brokenAt: 1, reason: `events cannot be replayed: ${error.message}` };
      run.state = reduce(run.events.filter((event) => event.type === 'run_started').slice(0, 1));
    }
    run.state.taskId ||= '';
    run.state.taskTitle ||= `Run ${localId}`;
    run.state.startedAt ||= '';
    run.state.updatedAt ||= '';
    run.state.pipeline ||= [];
    this.runs.set(run.id, run);
    return run;
  }

  start() {
    this._stopping = false;
    if (!this._timer) {
      this._timer = setInterval(() => this.kick(), this.tickMs);
      this._timer.unref();
    }
    this.kick();
  }

  async stop() {
    this._stopping = true;
    clearInterval(this._timer);
    this._timer = null;
    for (const child of this.processes.values()) killTree(child, 'SIGKILL');
    await Promise.allSettled([...this.inflight, this._ticking]);
  }

  kick() {
    if (this._stopping || this._initializing) return;
    this.tick().catch((error) => console.error(`Pipeline tick failed: ${error.message}`));
  }

  // Drive every run until nothing is running or dispatchable. Used by tests and
  // by callers that want a deterministic point to observe.
  async settle(limit = 200) {
    for (let round = 0; round < limit; round += 1) {
      await this.tick();
      if (!this.inflight.size && !this._ticking) return;
      await Promise.allSettled([...this.inflight]);
    }
    throw new Error('Pipeline did not settle');
  }

  tick() {
    if (this._ticking) {
      this._again = true;
      return this._ticking;
    }
    this._ticking = (async () => {
      do {
        this._again = false;
        if (this._stopping) return;
        await this._tickOnce();
      } while (this._again);
    })().finally(() => { this._ticking = null; });
    return this._ticking;
  }

  async _tickOnce() {
    const now = Date.now();
    const runs = [...this.runs.values()].filter((run) => run.integrity.ok).sort((a, b) => a.state.startedAt.localeCompare(b.state.startedAt));
    for (const run of runs) {
      for (const attempt of run.state.attempts) {
        if (attempt.runner === 'pull' && attempt.status === 'running' && attempt.leaseUntil && Date.parse(attempt.leaseUntil) < now) {
          await this._locked(run, (state) => {
            const current = attemptOf(state, attempt.n);
            return current.status === 'running' && Date.parse(current.leaseUntil) < Date.now()
              ? [{ type: 'lease_expired', actor: SYSTEM, data: { attempt: attempt.n } }]
              : [];
          });
        }
      }
    }
    await this._recoverOrphans(runs);
    if (!runs.some((run) => canAdvance(run.state))) return;
    const agents = await this.registry.list();
    // A waiting run is re-routed only when the agent registry has changed.
    const signature = hash(JSON.stringify(agents.map((agent) => agent.version)));
    const stats = performanceStats([...this.runs.values()]);
    for (const run of runs) {
      const { state } = run;
      if (!canAdvance(state) || (state.status === 'waiting' && run.waitingFor === signature)) continue;
      if (this.processes.size >= this.maxParallel) return;
      try {
        await this._advance(run, agents, stats);
        if (run.state.status === 'waiting') run.waitingFor = signature;
      } catch (error) {
        console.error(`Run ${run.id} could not advance: ${error.message}`);
      }
    }
  }

  // Results that could not be recorded are retried; command attempts that
  // have no process and no pending result are finished as interrupted.
  async _recoverOrphans(runs, reason = 'Interrupted: the agent process is no longer running') {
    for (const run of runs) {
      for (const attempt of run.state.attempts) {
        const key = `${run.id}:${attempt.n}`;
        if (attempt.runner !== 'command' || attempt.status !== 'running') {
          this.unrecorded.delete(key);
          continue;
        }
        // `launching` covers a launch from before spawn until its result is recorded.
        if (this.processes.has(key) || this.launching.has(key)) continue;
        const pending = this.unrecorded.get(key);
        try {
          await this._finish(run, attempt.n, pending?.actor || SYSTEM, pending?.result || {
            outcome: 'failed', output: '', stderr: '', exitCode: null, durationMs: null,
            error: reason,
          });
          this.unrecorded.delete(key);
        } catch (error) {
          console.error(`Attempt ${key} could not be recorded yet: ${error.message}`);
        }
      }
    }
  }

  _busy() {
    const busy = new Map();
    for (const run of this.runs.values()) {
      for (const attempt of run.state.attempts) {
        if (attempt.agentId && ACTIVE.has(attempt.status)) busy.set(attempt.agentId, (busy.get(attempt.agentId) || 0) + 1);
      }
    }
    return busy;
  }

  async _advance(run, agents, stats = performanceStats([...this.runs.values()])) {
    const task = await this.workspace.getTask(run.state.taskId).catch(() => null);
    const launches = [];
    await this._locked(run, async (state) => {
      if (!canAdvance(state)) return [];
      const stage = state.pipeline[state.stageIndex];
      if (!stage) return [{ type: 'run_completed', actor: SYSTEM, data: {} }];
      if (state.attempts.length - state.attemptBase >= MAX_ATTEMPTS_PER_RUN) {
        return [{ type: 'run_failed', actor: SYSTEM, data: { reason: `Stopped after ${MAX_ATTEMPTS_PER_RUN} attempts; a person should review this run` } }];
      }
      if (stage.executor === 'human') return this._dispatch(run, state, stage, task, { agentId: '', runner: 'human', reason: 'stage is done by a person', scoreboard: [] });
      const decision = route({
        agents,
        stage,
        stats,
        busy: this._busy(),
        excluded: state.exclusions[stage.id] || [],
        pinned: state.pins[stage.id] || stage.pinnedAgent || '',
      });
      if (!decision.chosen) {
        if (decision.scoreboard.some((row) => row.reason.startsWith('at capacity'))) return [];
        const reason = `No available agent takes the ${stage.role} role. Enable or add an agent, or take over this stage yourself.`;
        return state.status === 'waiting' && state.waitingReason === reason ? [] : [{ type: 'waiting', actor: SYSTEM, data: { stageId: stage.id, reason } }];
      }
      const agent = agents.find((entry) => entry.id === decision.chosen);
      const chosen = decision.scoreboard.find((row) => row.agentId === agent.id);
      const command = agent.runner === 'command' ? argvFor(agent, stage.role) : [];
      const events = await this._dispatch(run, state, stage, task, { agentId: agent.id, runner: agent.runner, reason: chosen.reason, scoreboard: decision.scoreboard, command });
      if (agent.runner === 'command') launches.push({ agent, attempt: events[0].data.attempt });
      return events;
    });
    for (const { agent, attempt } of launches) await this._launch(run, attempt, agent);
  }

  async _dispatch(run, state, stage, task, { agentId, runner, reason, scoreboard, command = [] }) {
    const n = state.attempts.length + 1;
    const prompt = await this._prompt(run, state, stage, task);
    const promptFile = `attempts/${pad(n)}-${stage.id}/prompt.md`;
    await this._writeArtifact(run, promptFile, prompt);
    return [{
      type: 'attempt_dispatched',
      actor: SYSTEM,
      data: { attempt: n, stageId: stage.id, stageIndex: state.stageIndex, role: stage.role, gate: stage.gate, agentId, runner, reason, scoreboard, ...(command.length ? { command } : {}), promptFile, promptHash: sha256(prompt) },
    }];
  }

  async _prompt(run, state, stage, task) {
    const localTask = state.taskId.split(':').at(-1);
    const sections = [
      `Role: ${stage.role}`,
      `Stage: ${stage.name} (${state.stageIndex + 1} of ${state.pipeline.length})`,
      `Task: ${localTask} — ${task?.title || state.taskTitle}`,
      '',
      '## Goal',
      '',
      task?.description || 'No description provided.',
      '',
      '## Stage instructions',
      '',
      stage.instructions || `Complete the ${stage.name} stage.`,
    ];
    const results = [];
    for (const [index, other] of state.pipeline.entries()) {
      if (other.id === stage.id) continue;
      const attempts = state.attempts.filter((attempt) => attempt.stageId === other.id);
      const latest = attempts.at(-1);
      if (!latest) continue;
      let source = null;
      let label = '';
      if (index < state.stageIndex) {
        source = [...attempts].reverse().find((attempt) => ['approved', 'succeeded'].includes(attempt.status));
        label = source?.status === 'approved' ? 'approved' : 'accepted';
      } else if (latest.status === 'failed' && latest.verdict === 'FAIL') {
        source = latest;
        label = 'reported defects';
      } else if (latest.status === 'rejected') {
        source = latest;
        label = 'sent back by a person';
      }
      if (!source) continue;
      const text = await this._verifiedOutput(run, source);
      results.push(`### ${other.name} — ${label}${source.files.edited ? ', edited by a person' : ''}`, '', clip(text.trim() || '(empty)'), '');
    }
    if (results.length) sections.push('', '## Results from other stages', '', ...results);
    const previous = [...state.attempts].reverse().find((attempt) => attempt.stageId === stage.id && attempt.status === 'rejected');
    const feedback = state.feedback[stage.id] || [];
    if (feedback.length) {
      sections.push('', '## Feedback from people', '', ...feedback.map((entry) => `- ${entry.by} (on ${entry.fromStage}): ${entry.text}`));
    }
    if (previous) {
      sections.push('', '## Your previous answer for this stage (sent back)', '', clip((await this._verifiedOutput(run, previous)).trim()));
    }
    sections.push('', '## Response', '', 'Respond in Markdown. Be concise and concrete and state your assumptions. Do not take external, destructive, credential-gated, or irreversible actions.');
    if (stage.verdict) sections.push('End with a final line `VERDICT: PASS` if the work meets the goal, or `VERDICT: FAIL` after listing the defects.');
    return `${sections.join('\n')}\n`;
  }

  // The output a later stage builds on, after checking it still matches the
  // hash recorded when it was produced (or edited by a person).
  async _verifiedOutput(run, attempt) {
    const file = attempt.files.edited || attempt.files.output;
    const expected = attempt.files.edited ? attempt.editedHash : attempt.outputHash;
    const text = await this._readArtifact(run, file);
    if (expected && sha256(text) !== expected) {
      run.integrity = { ok: false, count: run.events.length, brokenAt: 1, reason: `${file} no longer matches its recorded hash` };
      fail(409, `Run ${run.localId}: ${file} was changed outside AGESight`);
    }
    return text;
  }

  async _writeArtifact(run, relative, content) {
    const path = inside(run, relative);
    await assertNotSymlink(dirname(path), true);
    await mkdir(dirname(path), { recursive: true });
    await assertNotSymlink(path, true);
    await writeFile(path, content);
  }

  async _readArtifact(run, relative) {
    if (!relative) return '';
    const path = inside(run, relative);
    try {
      await assertNotSymlink(path);
      return await readFile(path, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') return '';
      throw error;
    }
  }

  // Run `decide(state)` under the workspace lock; it returns events (or event
  // factories receiving the interim state) to append. All events from one call
  // land in one git commit.
  async _locked(run, decide) {
    return this.workspace._serialize(async () => {
      if (!run.integrity.ok) fail(409, `Run ${run.localId} audit log failed verification at event ${run.integrity.brokenAt}; inspect its git history`);
      const working = structuredClone(run.state);
      const pending = [];
      const queue = [...await decide(working)];
      let last = run.events.at(-1);
      while (queue.length) {
        const next = queue.shift();
        const produced = typeof next === 'function' ? await next(working) : next;
        if (!produced) continue;
        if (Array.isArray(produced)) { queue.unshift(...produced); continue; }
        const event = buildEvent(last, produced);
        applyEvent(working, event);
        pending.push(event);
        last = event;
      }
      if (!pending.length) return { events: [], state: run.state };
      const eventsPath = join(run.dir, 'events.jsonl');
      const before = await readFile(eventsPath, 'utf8').catch(() => '');
      const runMdPath = join(run.dir, 'RUN.md');
      const runMdBefore = await readFile(runMdPath, 'utf8').catch(() => null);
      // The file must still be exactly the events this engine recorded.
      if (before !== serializeEvents(run.events)) {
        run.integrity = { ok: false, count: run.events.length, brokenAt: 1, reason: 'the log on disk was changed outside AGESight' };
        fail(409, `Run ${run.localId} audit log was changed on disk; inspect its git history`);
      }
      try {
        await assertNotSymlink(run.dir, true);
        await mkdir(run.dir, { recursive: true });
        await assertNotSymlink(eventsPath, true);
        await assertNotSymlink(join(run.dir, 'RUN.md'), true);
        await appendEvents(eventsPath, pending);
        await writeFile(join(run.dir, 'RUN.md'), renderRunMarkdown(working));
        const summary = pending.map((event) => describe(event, working)).join('; ');
        const taskLabel = working.taskId.split(':').at(-1);
        // The trailer anchors the chain head in git history, so truncating the
        // log or recomputing its hashes also requires rewriting git history.
        this.workspace._commit(join(this.workspace.projectsDir, run.projectId), [run.dir], `${`Run ${run.localId} (${taskLabel}): ${summary}`.slice(0, 400)}\n\nAudit-Head: ${last.hash}\nAudit-Seq: ${last.seq}`);
      } catch (error) {
        await writeFile(eventsPath, before);
        if (runMdBefore === null) await rm(runMdPath, { force: true }); else await writeFile(runMdPath, runMdBefore);
        this.workspace._resetPaths(join(this.workspace.projectsDir, run.projectId), [run.dir]);
        throw error;
      }
      run.events.push(...pending);
      run.state = working;
      return { events: pending, state: working };
    });
  }

  async _launch(run, n, agent) {
    const key = `${run.id}:${n}`;
    this.launching.add(key);
    let prompt;
    let workdir;
    try {
      prompt = await this._readArtifact(run, attemptOf(run.state, n).files.prompt);
      workdir = join(this.workdirRoot, `${run.projectId}-${run.localId}`);
      await mkdir(workdir, { recursive: true, mode: 0o700 });
    } catch (error) {
      this.launching.delete(key);
      throw error;
    }
    // A cancel or takeover may have landed while the prompt was being read.
    if (this._stopping || attemptOf(run.state, n)?.status !== 'running') {
      this.launching.delete(key);
      return;
    }
    const started = Date.now();
    const done = new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let settled = false;
      let child;
      let timer;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.processes.delete(key);
        resolve(result);
      };
      try {
        const argv = attemptOf(run.state, n).command || argvFor(agent, attemptOf(run.state, n).role);
        child = spawn(argv[0], argv.slice(1), {
          cwd: agent.cwd || workdir,
          env: { ...process.env, AGESIGHT_RUN: run.id, AGESIGHT_TASK: run.state.taskId, AGESIGHT_STAGE: attemptOf(run.state, n).stageId, AGESIGHT_ATTEMPT: String(n), AGESIGHT_WORKDIR: agent.cwd || workdir },
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: true,
        });
      } catch (error) {
        finish({ outcome: 'failed', output: '', stderr: '', exitCode: null, error: `Could not start agent: ${error.message}` });
        return;
      }
      this.processes.set(key, child);
      timer = setTimeout(() => {
        stderr += `\n[AGESight] Timed out after ${agent.timeoutSec}s; stopping the agent.\n`;
        killTree(child, 'SIGTERM');
        setTimeout(() => { killTree(child, 'SIGKILL'); child.stdout.destroy(); child.stderr.destroy(); }, 5000).unref();
      }, agent.timeoutSec * 1000);
      timer.unref();
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => { if (stdout.length < MAX_CAPTURE) stdout += chunk; });
      child.stderr.on('data', (chunk) => { if (stderr.length < MAX_CAPTURE) stderr += chunk; });
      child.stdin.on('error', () => {});
      child.on('error', (error) => finish({ outcome: 'failed', output: stdout, stderr, exitCode: null, error: `Could not start agent: ${error.message}` }));
      // Background processes the agent left behind can hold its pipes open;
      // stop them and stop waiting shortly after the agent itself exits.
      child.on('exit', () => setTimeout(() => {
        killTree(child, 'SIGKILL');
        child.stdout.destroy();
        child.stderr.destroy();
      }, 2000).unref());
      child.on('close', (code, signal) => finish({
        outcome: code === 0 ? 'succeeded' : 'failed',
        output: stdout.slice(0, MAX_CAPTURE),
        stderr: stderr.slice(0, MAX_CAPTURE),
        exitCode: code,
        error: code === 0 ? '' : signal ? `Agent stopped by ${signal}` : `Agent exited with code ${code}`,
      }));
      child.stdin.end(prompt);
    }).then((result) => {
      // A shutdown kill is not the agent's failure; the next start records the
      // attempt as interrupted instead.
      if (this._stopping) return undefined;
      const actor = { type: 'agent', id: agent.id };
      const recorded = { ...result, durationMs: Date.now() - started };
      return this._finish(run, n, actor, recorded).catch((error) => {
        // Keep the result; the next tick retries recording it.
        this.unrecorded.set(key, { actor, result: recorded });
        throw error;
      });
    })
      .catch((error) => console.error(`Recording attempt ${key} failed: ${error.message}`))
      .finally(() => { this.launching.delete(key); this.inflight.delete(done); this.kick(); });
    this.inflight.add(done);
  }

  // Record a finished attempt and the policy decision that follows from it.
  async _finish(run, n, actor, { outcome, output, stderr, exitCode, durationMs, error }) {
    const before = run.state.status;
    const result = await this._locked(run, async (state) => {
      const attempt = attemptOf(state, n);
      if (!attempt || !['running', 'awaiting_input'].includes(attempt.status)) return [];
      const stage = state.pipeline[attempt.stageIndex];
      let verdict = '';
      let finalOutcome = outcome;
      let finalError = error || '';
      if (stage.verdict && outcome === 'succeeded') {
        verdict = [...output.matchAll(/^\s*\**VERDICT:\s*(PASS|FAIL)\b/gim)].at(-1)?.[1]?.toUpperCase() || 'MISSING';
        if (verdict === 'FAIL') { finalOutcome = 'failed'; finalError = 'The agent reported VERDICT: FAIL'; }
        if (verdict === 'MISSING') { finalOutcome = 'failed'; finalError = 'The agent did not end with VERDICT: PASS or VERDICT: FAIL'; }
      }
      const dir = `attempts/${pad(n)}-${attempt.stageId}`;
      await this._writeArtifact(run, `${dir}/output.md`, output);
      if (stderr) await this._writeArtifact(run, `${dir}/stderr.log`, stderr);
      return [
        { type: 'attempt_finished', actor, data: { attempt: n, outcome: finalOutcome, exitCode, durationMs, error: finalError, verdict, outputFile: `${dir}/output.md`, outputHash: sha256(output), ...(stderr ? { stderrFile: `${dir}/stderr.log`, stderrHash: sha256(stderr) } : {}) } },
        (interim) => this._decide(interim, n),
      ];
    });
    if (!result.events.length) return false;
    await this._afterChange(run, before, result.state.status);
    return true;
  }

  _decide(state, n) {
    const attempt = attemptOf(state, n);
    const stage = state.pipeline[attempt.stageIndex];
    if (attempt.status === 'succeeded') {
      if (stage.gate === 'approve') return { type: 'gate_opened', actor: SYSTEM, data: { attempt: n } };
      return this._next(state, `${stage.name} passed`);
    }
    const failures = state.failures[stage.id] || 0;
    if (failures >= stage.maxAttempts) {
      return { type: 'run_failed', actor: SYSTEM, data: { reason: `${stage.name} failed ${failures} time${failures === 1 ? '' : 's'} (limit ${stage.maxAttempts}): ${attempt.error}` } };
    }
    if (stage.onFail === 'stop') return { type: 'run_failed', actor: SYSTEM, data: { reason: `${stage.name} failed: ${attempt.error}` } };
    const target = /^goto:(.+)$/.exec(stage.onFail)?.[1];
    if (target) {
      const to = state.pipeline.findIndex((entry) => entry.id === target);
      return { type: 'stage_moved', actor: SYSTEM, data: { from: state.stageIndex, to, reason: `${stage.name} failed; returning to ${state.pipeline[to].name}` } };
    }
    return null;
  }

  _next(state, reason) {
    const to = state.stageIndex + 1;
    if (to >= state.pipeline.length) return { type: 'run_completed', actor: SYSTEM, data: { reason } };
    return { type: 'stage_moved', actor: SYSTEM, data: { from: state.stageIndex, to, reason } };
  }

  // Keep the task's board column in step with the run.
  async _afterChange(run, before, after) {
    this.kick();
    if (before === after) return;
    const target = after === 'completed' ? 'done' : after === 'failed' ? 'blocked' : (before === 'failed' && !TERMINAL.has(after)) ? 'in_progress' : '';
    if (!target) return;
    try {
      for (let tries = 0; ; tries += 1) {
        const task = await this.workspace.getTask(run.state.taskId);
        if (task.status === target) break;
        try {
          await this.workspace.updateTask(run.state.taskId, { status: target, version: task.version });
          break;
        } catch (error) {
          if (error?.status !== 409 || tries >= 2 || /WIP/.test(error.message)) throw error;
        }
      }
    } catch (error) {
      await this._locked(run, () => [{ type: 'task_sync_failed', actor: SYSTEM, data: { error: error.message, target } }]).catch(() => {});
    }
  }

  // --- Pipelines ---------------------------------------------------------------

  async getPipeline(projectId) {
    return this.workspace._serialize(async () => {
      const { dir } = await this.workspace._project(projectId);
      const path = join(dir, 'pipeline', 'pipeline.json');
      await assertNotSymlink(path, true);
      let raw;
      try { raw = await readFile(path, 'utf8'); } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
        return { projectId, stages: structuredClone(DEFAULT_STAGES), version: 'default', isDefault: true };
      }
      let parsed;
      try { parsed = JSON.parse(raw); } catch { fail(500, 'Pipeline definition is invalid JSON'); }
      return { projectId, stages: cleanStages(parsed.stages), version: hash(raw), isDefault: false };
    });
  }

  async savePipeline(projectId, input = {}) {
    const stages = cleanStages(input.stages);
    return this.workspace._serialize(async () => {
      const { dir } = await this.workspace._project(projectId);
      const path = join(dir, 'pipeline', 'pipeline.json');
      await assertNotSymlink(path, true);
      const raw = `${JSON.stringify({ stages }, null, 2)}\n`;
      const previous = await readFile(path, 'utf8').catch(() => null);
      if (typeof input.version !== 'string' || input.version !== (previous === null ? 'default' : hash(previous))) {
        fail(409, 'Pipeline has changed; refresh and try again');
      }
      if (previous === raw) return { projectId, stages, version: hash(raw), isDefault: false };
      try {
        await mkdir(join(dir, 'pipeline'), { recursive: true });
        await writeFile(path, raw);
        this.workspace._commit(dir, [path], `Update pipeline: ${stages.map((stage) => stage.name).join(' → ')}`.slice(0, 400));
      } catch (error) {
        if (previous === null) await rm(path, { force: true }); else await writeFile(path, previous);
        this.workspace._resetPaths(dir, [path]);
        throw error;
      }
      return { projectId, stages, version: hash(raw), isDefault: false };
    });
  }

  // --- Runs --------------------------------------------------------------------

  _run(id) {
    const run = this.runs.get(id);
    if (!run) fail(404, 'Run not found');
    return run;
  }

  async startRun(input = {}) {
    const taskId = cleanLine(input.taskId, 'taskId', { required: true, max: 60 });
    const task = await this.workspace.getTask(taskId);
    const pipeline = await this.getPipeline(task.projectId);
    const projectRuns = join(this.workspace.projectsDir, task.projectId, 'pipeline', 'runs');
    const onDisk = await readdir(projectRuns).catch(() => []);
    // From the active-run check to registering the placeholder there is no
    // await, so two concurrent starts cannot both pass the check.
    const active = [...this.runs.values()].find((run) => run.state.taskId === task.id && !TERMINAL.has(run.state.status));
    if (active) fail(409, `${task.id.split(':').at(-1)} already has an active run (${active.localId})`);
    const existing = [...this.runs.values()].filter((run) => run.projectId === task.projectId).map((run) => Number(RUN_ID.exec(run.localId)[1]));
    const highest = Math.max(0, ...existing, ...onDisk.map((name) => Number(RUN_ID.exec(name)?.[1] || 0)));
    const localId = `R${String(highest + 1).padStart(3, '0')}`;
    const run = { id: `${task.projectId}:${localId}`, projectId: task.projectId, localId, dir: join(projectRuns, localId), events: [], integrity: { ok: true }, state: reduce([]) };
    Object.assign(run.state, { taskId: task.id, taskTitle: task.title, pipeline: [], startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'starting' });
    this.runs.set(run.id, run);
    try {
      if (task.status !== 'in_progress') await this.workspace.updateTask(task.id, { status: 'in_progress', version: task.version });
      await this._locked(run, () => [{
        type: 'run_started',
        actor: this.human,
        data: { runId: localId, taskId: task.id, taskTitle: task.title, pipeline: pipeline.stages, pipelineVersion: pipeline.version },
      }]);
    } catch (error) {
      this.runs.delete(run.id);
      await rm(run.dir, { recursive: true, force: true });
      throw error;
    }
    this.kick();
    return this.getRun(run.id);
  }

  async act(id, input = {}) {
    const run = this._run(id);
    const action = input.action;
    const before = run.state.status;
    const toStop = [];
    const actor = this.human;
    const gateAttempt = (state) => {
      const attempt = state.attempts.find((entry) => entry.status === 'awaiting_approval');
      if (!attempt) fail(409, 'Nothing is waiting for approval');
      return attempt;
    };
    const activeAttempt = (state) => state.attempts.find((entry) => ACTIVE.has(entry.status));
    const stageIndex = (state, stageId) => {
      const index = state.pipeline.findIndex((stage) => stage.id === stageId);
      if (index < 0) fail(400, 'Unknown stage');
      return index;
    };
    const requireOpen = (state) => { if (TERMINAL.has(state.status)) fail(409, `Run is ${state.status}`); };
    const agentIds = new Set((await this.registry.list()).map((agent) => agent.id));
    const task = action === 'takeover' ? await this.workspace.getTask(run.state.taskId).catch(() => null) : null;
    const knownAgent = (value, field) => {
      const text = cleanLine(value ?? '', field, { max: 40 });
      if (text && !agentIds.has(text)) fail(400, `${field} is not a registered agent`);
      return text;
    };

    const result = await this._locked(run, async (state) => {
      if (action !== 'comment' && input.expectedSeq !== state.lastSeq) fail(409, 'This run has changed; refresh and try again');
      switch (action) {
        case 'approve': {
          requireOpen(state);
          const attempt = gateAttempt(state);
          const comment = cleanText(input.comment ?? '', 'comment', { max: 4000 });
          return [{ type: 'approved', actor, data: { attempt: attempt.n, comment } }, (interim) => this._next(interim, `${interim.pipeline[attempt.stageIndex].name} approved`)];
        }
        case 'reject': {
          requireOpen(state);
          const attempt = gateAttempt(state);
          const feedback = cleanText(input.feedback, 'feedback', { required: true, max: 8000 });
          const targetStage = input.stageId ?? attempt.stageId;
          const to = stageIndex(state, targetStage);
          if (to > attempt.stageIndex) fail(400, 'Work can only be sent back to this stage or an earlier one');
          const pinAgent = knownAgent(input.pinAgent, 'pinAgent');
          const exclude = input.excludeAgent ? [...new Set([...(state.exclusions[targetStage] || []), knownAgent(input.excludeAgent, 'excludeAgent')])] : null;
          return [
            { type: 'rejected', actor, data: { attempt: attempt.n, feedback, targetStage } },
            ...(pinAgent || exclude ? [{ type: 'routing_set', actor, data: { stageId: targetStage, pinAgent: pinAgent || state.pins[targetStage] || '', exclude: exclude || state.exclusions[targetStage] || [] } }] : []),
            { type: 'stage_moved', actor, data: { from: state.stageIndex, to, reason: `Changes requested by ${actor.id}` } },
          ];
        }
        case 'edit': {
          requireOpen(state);
          const attempt = gateAttempt(state);
          const output = cleanText(input.output, 'output', { required: true, max: MAX_CAPTURE });
          const file = `attempts/${pad(attempt.n)}-${attempt.stageId}/edited.md`;
          await this._writeArtifact(run, file, output);
          return [{ type: 'output_edited', actor, data: { attempt: attempt.n, file, outputHash: sha256(output) } }];
        }
        case 'submit': {
          requireOpen(state);
          const attempt = state.attempts.find((entry) => entry.status === 'awaiting_input');
          if (!attempt) fail(409, 'No stage is waiting for a person');
          const output = cleanText(input.output, 'output', { required: true, max: MAX_CAPTURE });
          const dir = `attempts/${pad(attempt.n)}-${attempt.stageId}`;
          await this._writeArtifact(run, `${dir}/output.md`, output);
          return [
            { type: 'attempt_finished', actor, data: { attempt: attempt.n, outcome: 'succeeded', exitCode: null, durationMs: Date.now() - Date.parse(attempt.dispatchedAt), error: '', verdict: '', outputFile: `${dir}/output.md`, outputHash: sha256(output) } },
            (interim) => this._decide(interim, attempt.n),
          ];
        }
        case 'takeover': {
          requireOpen(state);
          if (state.status === 'awaiting_approval') fail(409, 'Approve or send back the waiting stage first');
          const current = activeAttempt(state);
          if (current?.runner === 'human') fail(409, 'This stage is already assigned to a person');
          if (current) toStop.push(current.n);
          const stage = state.pipeline[state.stageIndex];
          return [
            ...(current ? [{ type: 'attempt_cancelled', actor, data: { attempt: current.n, reason: `Taken over by ${actor.id}` } }] : []),
            (interim) => this._dispatch(run, interim, stage, task, { agentId: '', runner: 'human', reason: `taken over by ${actor.id}`, scoreboard: [] }),
          ];
        }
        case 'route': {
          requireOpen(state);
          const stageId = cleanLine(input.stageId, 'stageId', { required: true, max: 30 });
          const index = stageIndex(state, stageId);
          const pinAgent = knownAgent(input.pinAgent, 'pinAgent');
          if (input.exclude !== undefined && (!Array.isArray(input.exclude) || input.exclude.length > 32)) fail(400, 'exclude must be a list of agent ids');
          const exclude = [...new Set((input.exclude ?? state.exclusions[stageId] ?? []).map((value) => knownAgent(value, 'exclude')))];
          const events = [{ type: 'routing_set', actor, data: { stageId, pinAgent, exclude } }];
          const current = activeAttempt(state);
          if (input.restart === true && current && current.stageIndex === index && current.runner !== 'human') {
            toStop.push(current.n);
            events.push({ type: 'attempt_cancelled', actor, data: { attempt: current.n, reason: `Reassigned by ${actor.id}` } });
          }
          return events;
        }
        case 'pause':
          requireOpen(state);
          if (state.paused) fail(409, 'Run is already paused');
          return [{ type: 'paused', actor, data: {} }];
        case 'resume':
          requireOpen(state);
          if (!state.paused) fail(409, 'Run is not paused');
          return [{ type: 'resumed', actor, data: {} }];
        case 'cancel': {
          // A failed run can be closed too, which takes it out of Decisions.
          if (state.status !== 'failed') requireOpen(state);
          const current = activeAttempt(state);
          if (current) toStop.push(current.n);
          return [{ type: 'cancelled', actor, data: { reason: cleanText(input.reason ?? '', 'reason', { max: 2000 }) } }];
        }
        case 'retry': {
          if (state.status !== 'failed') fail(409, 'Only a failed run can be retried');
          const stageId = input.stageId ?? state.pipeline[state.stageIndex].id;
          const to = stageIndex(state, stageId);
          return [
            { type: 'retried', actor, data: { stageId } },
            ...(to !== state.stageIndex ? [{ type: 'stage_moved', actor, data: { from: state.stageIndex, to, reason: `Retried from ${state.pipeline[to].name} by ${actor.id}` } }] : []),
          ];
        }
        case 'comment': {
          const text = cleanText(input.text, 'text', { required: true, max: 4000 });
          const stageId = input.stageId ? state.pipeline[stageIndex(state, input.stageId)].id : '';
          return [{ type: 'commented', actor, data: { text, stageId } }];
        }
        default:
          fail(400, 'Unknown action');
      }
      return [];
    });
    for (const n of toStop) {
      const child = this.processes.get(`${run.id}:${n}`);
      if (child) killTree(child, 'SIGTERM');
    }
    await this._afterChange(run, before, result.state.status);
    return this.getRun(run.id);
  }

  // --- Pull runner -------------------------------------------------------------

  async claim(agentId) {
    const agent = await this.registry.get(agentId);
    if (agent.runner !== 'pull') fail(400, 'Only pull agents claim work');
    if (!agent.enabled) fail(409, 'Agent is disabled');
    const queued = [...this.runs.values()]
      .filter((run) => run.integrity.ok && !run.state.paused)
      .flatMap((run) => run.state.attempts.filter((attempt) => attempt.agentId === agentId && attempt.status === 'queued').map((attempt) => ({ run, attempt })))
      .sort((a, b) => a.attempt.dispatchedAt.localeCompare(b.attempt.dispatchedAt));
    for (const { run, attempt } of queued) {
      const leaseUntil = new Date(Date.now() + this.leaseMs).toISOString();
      const { events } = await this._locked(run, (state) => attemptOf(state, attempt.n).status === 'queued'
        ? [{ type: 'attempt_claimed', actor: { type: 'agent', id: agentId }, data: { attempt: attempt.n, leaseUntil } }]
        : []);
      if (!events.length) continue;
      const stage = run.state.pipeline[attempt.stageIndex];
      return {
        attemptId: `${run.id}:${attempt.n}`,
        runId: run.id,
        taskId: run.state.taskId,
        stage: { id: stage.id, name: stage.name, role: stage.role, verdict: stage.verdict },
        prompt: await this._readArtifact(run, attempt.files.prompt),
        leaseUntil,
      };
    }
    return null;
  }

  _attempt(attemptId, agentId) {
    if (typeof attemptId !== 'string') fail(404, 'Attempt not found');
    const split = attemptId.lastIndexOf(':');
    const run = this._run(attemptId.slice(0, split));
    const n = Number(attemptId.slice(split + 1));
    const attempt = attemptOf(run.state, n);
    if (!attempt) fail(404, 'Attempt not found');
    if (attempt.runner !== 'pull') fail(409, 'Only pull-runner attempts are reported over the API');
    if (attempt.agentId !== agentId) fail(403, 'This attempt belongs to another agent');
    if (attempt.status !== 'running') fail(409, `Attempt is ${attempt.status}`);
    return { run, n };
  }

  async heartbeat(attemptId, input = {}) {
    const { run, n } = this._attempt(attemptId, input.agentId);
    const leaseUntil = new Date(Date.now() + this.leaseMs).toISOString();
    const { events } = await this._locked(run, (state) => attemptOf(state, n).status === 'running'
      ? [{ type: 'lease_renewed', actor: { type: 'agent', id: input.agentId }, data: { attempt: n, leaseUntil } }]
      : []);
    if (!events.length) fail(409, 'The lease has ended; claim the work again');
    return { leaseUntil };
  }

  async complete(attemptId, input = {}) {
    const { run, n } = this._attempt(attemptId, input.agentId);
    const outcome = input.outcome ?? 'succeeded';
    if (!['succeeded', 'failed'].includes(outcome)) fail(400, 'outcome must be succeeded or failed');
    const output = cleanText(input.output ?? '', 'output', { max: MAX_CAPTURE });
    const attempt = attemptOf(run.state, n);
    const recorded = await this._finish(run, n, { type: 'agent', id: input.agentId }, {
      outcome,
      output,
      stderr: '',
      exitCode: null,
      durationMs: Date.now() - Date.parse(attempt.claimedAt || attempt.dispatchedAt),
      error: outcome === 'failed' ? cleanText(input.error ?? 'Agent reported failure', 'error', { max: 2000 }) : '',
    });
    if (!recorded) fail(409, 'The attempt was no longer running; the result was not recorded');
    return this.getRun(run.id);
  }

  // --- Read models -------------------------------------------------------------

  _summary(run) {
    const { state } = run;
    const current = state.pipeline?.[state.stageIndex];
    const active = state.attempts.find((attempt) => ACTIVE.has(attempt.status) || attempt.status === 'awaiting_approval');
    const stages = (state.pipeline || []).map((stage, index) => {
      const attempts = state.attempts.filter((attempt) => attempt.stageId === stage.id);
      const latest = attempts.at(-1);
      let status = 'pending';
      if (state.status === 'completed' || index < state.stageIndex) status = 'done';
      else if (index === state.stageIndex) status = state.status === 'failed' ? 'failed' : state.status === 'cancelled' ? 'cancelled' : latest?.status === 'awaiting_approval' ? 'awaiting_approval' : latest?.status === 'awaiting_input' ? 'awaiting_input' : state.status === 'waiting' ? 'waiting' : 'active';
      return { id: stage.id, name: stage.name, role: stage.role, gate: stage.gate, status, attempts: attempts.length };
    });
    const superseded = [...this.runs.values()].some((other) => other.state.taskId === state.taskId && other.state.startedAt > state.startedAt);
    const unclaimed = state.attempts.some((attempt) => attempt.status === 'queued' && Date.now() - Date.parse(attempt.dispatchedAt) > this.leaseMs);
    const needsHuman = !run.integrity.ok
      || ['awaiting_approval', 'awaiting_input', 'waiting'].includes(state.status)
      || (state.status === 'failed' && !superseded)
      || unclaimed;
    return {
      id: run.id,
      localId: run.localId,
      projectId: run.projectId,
      taskId: state.taskId,
      taskTitle: state.taskTitle,
      status: state.status,
      paused: state.paused,
      stageIndex: state.stageIndex,
      currentStage: current ? { id: current.id, name: current.name } : null,
      currentAgent: active?.agentId || '',
      stages,
      needsHuman,
      error: state.error,
      waitingReason: state.waitingReason,
      integrity: run.integrity.ok,
      startedAt: state.startedAt,
      updatedAt: state.updatedAt,
      lastSeq: state.lastSeq,
    };
  }

  // Compare a verified chain with the head recorded in the run's latest commit.
  _checkAnchor(run, chain) {
    if (!chain.ok) return chain;
    const projectDir = join(this.workspace.projectsDir, run.projectId);
    const body = git(projectDir, ['log', '-1', '--format=%B', '--', `pipeline/runs/${run.localId}`], { allowFailure: true }).stdout || '';
    const anchor = /^Audit-Head: ([0-9a-f]{64})\nAudit-Seq: (\d+)$/m.exec(body);
    if (!anchor) return chain;
    if (Number(anchor[2]) !== chain.count || anchor[1] !== chain.head) {
      return { ok: false, count: chain.count, brokenAt: Math.min(chain.count, Number(anchor[2])) + 1, reason: `log does not match the head recorded in git (event ${anchor[2]})` };
    }
    return chain;
  }

  // Verify the log as it is on disk now, not the copy in memory. A run whose
  // files no longer match is locked until a person inspects it.
  _verifyOnDisk(run) {
    // Under the workspace lock, so a read never lands between an append and
    // its commit and mistakes that moment for tampering.
    return this.workspace._serialize(() => this._verifyOnDiskUnlocked(run));
  }

  async _verifyOnDiskUnlocked(run) {
    if (!run.integrity.ok || run.state.status === 'starting') return run.integrity;
    let chain;
    try { chain = this._checkAnchor(run, verifyChain(await readEvents(join(run.dir, 'events.jsonl')))); } catch (error) {
      chain = { ok: false, count: 0, brokenAt: 1, reason: error.message };
    }
    if (chain.ok && (chain.count !== run.events.length || chain.head !== run.events.at(-1)?.hash)) {
      chain = { ok: false, count: chain.count, brokenAt: Math.min(chain.count, run.events.length) + 1, reason: 'log on disk differs from the recorded log' };
    }
    if (!chain.ok) run.integrity = chain;
    return chain;
  }

  listRuns() {
    return [...this.runs.values()].map((run) => this._summary(run)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getRun(id) {
    const run = this._run(id);
    const { state } = run;
    const mismatches = [];
    const attempts = [];
    for (const attempt of state.attempts) {
      const prompt = await this._readArtifact(run, attempt.files.prompt);
      const output = await this._readArtifact(run, attempt.files.output);
      const edited = await this._readArtifact(run, attempt.files.edited);
      const stderr = await this._readArtifact(run, attempt.files.stderr);
      if (attempt.promptHash && sha256(prompt) !== attempt.promptHash) mismatches.push(`${attempt.files.prompt}`);
      if (attempt.files.output && attempt.outputHash && sha256(output) !== attempt.outputHash) mismatches.push(`${attempt.files.output}`);
      if (attempt.files.edited && sha256(edited) !== attempt.editedHash) mismatches.push(`${attempt.files.edited}`);
      if (attempt.files.stderr && attempt.stderrHash && sha256(stderr) !== attempt.stderrHash) mismatches.push(`${attempt.files.stderr}`);
      attempts.push({ ...attempt, id: `${run.id}:${attempt.n}`, prompt, output, edited, stderr });
    }
    const chain = await this._verifyOnDisk(run);
    return {
      ...this._summary(run),
      pipeline: state.pipeline,
      attempts,
      feedback: state.feedback,
      pins: state.pins,
      exclusions: state.exclusions,
      comments: state.comments,
      taskSyncError: state.taskSyncError || '',
      events: run.events,
      audit: { chain, artifacts: { ok: !mismatches.length, mismatches } },
      path: `pipeline/runs/${run.localId}`,
    };
  }

  async agentPerformance() {
    const agents = await this.registry.list();
    const stats = performanceStats([...this.runs.values()]);
    const busy = this._busy();
    return agents.map((agent) => ({
      ...agent,
      active: busy.get(agent.id) || 0,
      performance: Object.fromEntries(agent.roles.map((role) => [role, summarize(stats.get(`${agent.id}\u0000${role}`))])),
    }));
  }
}
