import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { AgentRegistry, ROLES } from '../lib/agents.mjs';
import { parseEvents, verifyChain } from '../lib/audit.mjs';
import { needsHumanAt, PipelineEngine, reduce } from '../lib/pipeline.mjs';
import { createServer } from '../server.mjs';
import { Workspace, WorkspaceError } from '../lib/workspace.mjs';

// The library spawns git itself; keep it independent of the developer's config.
process.env.GIT_CONFIG_GLOBAL = os.devNull;
process.env.GIT_CONFIG_NOSYSTEM = '1';

const exec = promisify(execFile);
const OPERATOR = 'Pipeline Tester';
const EMAIL = 'pipeline@example.invalid';

// --- Fixtures -----------------------------------------------------------------

async function git(directory, ...args) {
  const { stdout } = await exec('git', args, { cwd: directory, env: process.env });
  return stdout.trim();
}

// Agent scripts. Each reads the stage prompt on stdin like a real agent would.
const PRELUDE = [
  "let prompt = '';",
  "process.stdin.setEncoding('utf8');",
  'for await (const chunk of process.stdin) prompt += chunk;',
  'const role = /^Role: (\\w+)/m.exec(prompt)?.[1] ?? "stage";',
  'const wantsVerdict = /VERDICT: PASS/.test(prompt);',
].join('\n');

const scriptOk = (label) => `${PRELUDE}
process.stdout.write('OUT-' + ${JSON.stringify(label)} + '-' + role + '\\n');
if (role === 'plan') process.stdout.write('PLAN-ORIGINAL-TEXT\\n');
if (wantsVerdict) process.stdout.write('VERDICT: PASS\\n');
`;

const scriptFailVerdict = `${PRELUDE}
if (wantsVerdict) process.stdout.write('DEFECT-ALPHA: off by one in the loop\\nVERDICT: FAIL\\n');
else process.stdout.write('implemented-' + role + '\\n');
`;

const scriptExit1 = `process.stderr.write('boom\\n');
process.exit(1);
`;

const scriptSleep = `process.stdout.write('started\\n');
setInterval(() => {}, 1000);
`;

const scriptEcho = `${PRELUDE}
process.stdout.write(prompt);
process.stdout.write('ENV ' + [process.env.AGESIGHT_RUN, process.env.AGESIGHT_TASK, process.env.AGESIGHT_STAGE, process.env.AGESIGHT_ATTEMPT].join('|') + '\\n');
`;

function commandAgent(id, script, overrides = {}) {
  return {
    id,
    name: id,
    description: '',
    runner: 'command',
    command: [process.execPath, script],
    cwd: '',
    roles: [...ROLES],
    tier: 'sonnet',
    enabled: true,
    maxConcurrent: 2,
    timeoutSec: 60,
    ...overrides,
  };
}

function pullAgent(id, overrides = {}) {
  return commandAgent(id, '', { runner: 'pull', command: [], ...overrides });
}

function stage(id, role, overrides = {}) {
  return {
    id,
    name: id[0].toUpperCase() + id.slice(1),
    role,
    tier: 'sonnet',
    executor: 'agent',
    gate: 'none',
    verdict: false,
    maxAttempts: 3,
    onFail: 'retry',
    pinnedAgent: '',
    instructions: `Do the ${id} stage.`,
    ...overrides,
  };
}

async function until(check, { timeout = 10000, interval = 20, message = 'condition' } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) assert.fail(`Timed out waiting for ${message}`);
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

async function expectStatus(promise, status, message) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof WorkspaceError, `Expected a WorkspaceError, got ${error?.stack || error}`);
    assert.equal(error.status, status, `Expected status ${status}, got ${error.status}: ${error.message}`);
    if (message) assert.match(error.message, message);
    return true;
  });
}

// Builds a workspace, registry, and engine in a temp dir. `agents` receives a
// `script(name, source)` writer and returns the agent list that seeds the registry.
async function setup(t, { agents = async () => [], engineOptions = {} } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agesight-pipeline-'));
  const dataDir = path.join(root, 'data');
  const scriptsDir = path.join(root, 'scripts');
  await mkdir(scriptsDir, { recursive: true });
  const script = async (name, source) => {
    const file = path.join(scriptsDir, `${name}.mjs`);
    await writeFile(file, source);
    return file;
  };
  const seed = await agents({ script, root });
  const workspace = await new Workspace({ dataDir, operator: OPERATOR, email: EMAIL }).init();
  const registry = await new AgentRegistry({ dataDir: workspace.dataDir, operator: OPERATOR, email: EMAIL, seed: () => seed }).init();
  const engine = await new PipelineEngine({ workspace, registry, ...engineOptions }).init();
  const engines = [engine];
  t.after(async () => {
    for (const each of engines) await each.stop();
    await rm(root, { recursive: true, force: true, maxRetries: 5 });
  });
  const context = {
    root, dataDir, script, workspace, registry, engine, engines,
    projectDir: (projectId) => path.join(workspace.projectsDir, projectId),
    runDir: (run) => path.join(workspace.projectsDir, run.projectId, 'pipeline', 'runs', run.localId),
    async newTask({ stages, title = 'Build the thing', description = 'Make the thing work.', wipLimit } = {}) {
      const project = await workspace.createProject({ name: 'Pipeline project', ...(wipLimit ? { wipLimit } : {}) });
      if (stages) await engine.savePipeline(project.id, { stages, version: 'default' });
      return { project, task: await this.addTask(project, title, description) };
    },
    addTask: (project, title, description = 'Make the thing work.') => workspace.createTask({ projectId: project.id, title, description }),
    start: (task) => engine.startRun({ taskId: task.id }),
    async act(runId, input) {
      const run = await engine.getRun(runId);
      return engine.act(runId, { expectedSeq: run.lastSeq, ...input });
    },
    taskStatus: async (task) => (await workspace.getTask(task.id)).status,
  };
  return context;
}

const okAgents = (label = 'ok', overrides = {}) => async ({ script }) => [commandAgent('ok', await script('ok', scriptOk(label)), overrides)];

const byType = (run, type) => run.events.filter((event) => event.type === type);

// --- Happy path ---------------------------------------------------------------

test('a run goes through every default stage with two approval gates and completes the task', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { engine } = ctx;
  const { project, task } = await ctx.newTask();

  const started = await ctx.start(task);
  assert.equal(started.id, `${project.id}:R001`);
  assert.equal(await ctx.taskStatus(task), 'in_progress');

  await engine.settle();
  let run = await engine.getRun(started.id);
  assert.equal(run.status, 'awaiting_approval');
  assert.equal(run.currentStage.id, 'plan');
  assert.deepEqual(run.attempts.map((attempt) => attempt.stageId), ['triage', 'plan']);

  await ctx.act(run.id, { action: 'approve', comment: 'Plan is fine' });
  await engine.settle();
  run = await engine.getRun(run.id);
  assert.equal(run.status, 'awaiting_approval');
  assert.equal(run.currentStage.id, 'review');

  await ctx.act(run.id, { action: 'approve' });
  await engine.settle();
  run = await engine.getRun(run.id);

  assert.equal(run.status, 'completed');
  assert.deepEqual(run.attempts.map((attempt) => [attempt.stageId, attempt.status]), [
    ['triage', 'succeeded'], ['plan', 'approved'], ['implement', 'succeeded'], ['review', 'approved'], ['verify', 'succeeded'],
  ]);
  assert.equal(await ctx.taskStatus(task), 'done');
  assert.equal(run.audit.chain.ok, true);
  assert.equal(run.audit.chain.count, run.events.length);
  assert.deepEqual(run.audit.artifacts, { ok: true, mismatches: [] });
});

test('every attempt stores its prompt and output as files in the run directory', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { task } = await ctx.newTask();
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await ctx.act(started.id, { action: 'approve' });
  await ctx.engine.settle();
  await ctx.act(started.id, { action: 'approve' });
  await ctx.engine.settle();

  const run = await ctx.engine.getRun(started.id);
  const attemptsDir = path.join(ctx.runDir(run), 'attempts');
  const directories = (await readdir(attemptsDir)).sort();
  assert.deepEqual(directories, ['01-triage', '02-plan', '03-implement', '04-review', '05-verify']);
  for (const directory of directories) {
    const files = await readdir(path.join(attemptsDir, directory));
    assert.ok(files.includes('prompt.md'), `${directory} is missing prompt.md`);
    assert.ok(files.includes('output.md'), `${directory} is missing output.md`);
  }
  const output = await readFile(path.join(attemptsDir, '02-plan', 'output.md'), 'utf8');
  assert.match(output, /PLAN-ORIGINAL-TEXT/);
  assert.equal(output, run.attempts[1].output);
  assert.equal(await readFile(path.join(attemptsDir, '02-plan', 'prompt.md'), 'utf8'), run.attempts[1].prompt);
});

test('each locked change to a run is one git commit and the project history stays clean', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { project, task } = await ctx.newTask();
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await ctx.act(started.id, { action: 'approve' });
  await ctx.engine.settle();
  await ctx.act(started.id, { action: 'approve' });
  await ctx.engine.settle();

  const run = await ctx.engine.getRun(started.id);
  const dir = ctx.projectDir(project.id);
  const subjects = (await git(dir, 'log', '--format=%s', '--', 'pipeline')).split('\n').filter(Boolean);
  assert.ok(subjects.length >= 10, `Expected at least 10 run commits, saw ${subjects.length}`);
  for (const subject of subjects) assert.match(subject, /^Run R001 \(T001\): /);

  const commits = (await git(dir, 'log', '--reverse', '--format=%H', '--', 'pipeline/runs/R001/events.jsonl')).split('\n');
  let previousCount = 0;
  for (const commit of commits) {
    const events = parseEvents(await git(dir, 'show', `${commit}:pipeline/runs/R001/events.jsonl`));
    assert.equal(verifyChain(events).ok, true, `The log at ${commit} must verify`);
    assert.ok(events.length > previousCount, 'Every commit must add at least one event');
    previousCount = events.length;
  }
  assert.equal(previousCount, run.events.length);
  assert.equal(await git(dir, 'status', '--porcelain'), '');

  const onDisk = parseEvents(await readFile(path.join(ctx.runDir(run), 'events.jsonl'), 'utf8'));
  assert.equal(verifyChain(onDisk).ok, true);
  assert.deepEqual(onDisk, JSON.parse(JSON.stringify(run.events)));
});

test('routing records why an agent was chosen and credits approved and unchecked stages as successes', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { task } = await ctx.newTask();
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await ctx.act(started.id, { action: 'approve' });
  await ctx.engine.settle();
  await ctx.act(started.id, { action: 'approve' });
  await ctx.engine.settle();

  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.attempts[0].agentId, 'ok');
  assert.equal(run.attempts[0].reason, 'only eligible agent');
  assert.equal(run.attempts[0].scoreboard[0].agentId, 'ok');
  const [agent] = await ctx.engine.agentPerformance();
  for (const role of ['triage', 'plan', 'implement', 'review', 'verify']) {
    assert.equal(agent.performance[role].attempts, 1, role);
    assert.equal(agent.performance[role].successes, 1, role);
  }
  assert.equal(agent.performance.plan.successRate, 1);
});

test('a command agent receives the prompt on stdin and the run identifiers in its environment', async (t) => {
  const ctx = await setup(t, { agents: async ({ script }) => [commandAgent('echo', await script('echo', scriptEcho))] });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement')] });
  const started = await ctx.start(task);
  await ctx.engine.settle();

  const run = await ctx.engine.getRun(started.id);
  const [attempt] = run.attempts;
  assert.equal(attempt.status, 'succeeded');
  assert.equal(attempt.exitCode, 0);
  assert.ok(attempt.output.startsWith(attempt.prompt), 'the agent echoed exactly what it received');
  assert.match(attempt.output, new RegExp(`ENV ${started.id}\\|${task.id}\\|implement\\|1\\n$`));
  assert.match(attempt.prompt, /^Role: implement$/m);
  assert.match(attempt.prompt, /Make the thing work\./);
});

// --- Prompt contents ------------------------------------------------------------

const PLAN_THEN_IMPLEMENT = [stage('plan', 'plan', { gate: 'approve' }), stage('implement', 'implement')];

test('the implement prompt contains the approved plan output', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { task } = await ctx.newTask({ stages: PLAN_THEN_IMPLEMENT });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await ctx.act(started.id, { action: 'approve' });
  await ctx.engine.settle();

  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.status, 'completed');
  const implement = run.attempts.find((attempt) => attempt.stageId === 'implement');
  assert.match(implement.prompt, /### Plan — approved/);
  assert.match(implement.prompt, /PLAN-ORIGINAL-TEXT/);
});

test('the implement prompt carries a person\'s edit of the plan and not the original text', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { task } = await ctx.newTask({ stages: PLAN_THEN_IMPLEMENT });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await ctx.act(started.id, { action: 'edit', output: 'PLAN-EDITED-BY-A-PERSON\n' });
  await ctx.act(started.id, { action: 'approve' });
  await ctx.engine.settle();

  const run = await ctx.engine.getRun(started.id);
  const implement = run.attempts.find((attempt) => attempt.stageId === 'implement');
  assert.match(implement.prompt, /PLAN-EDITED-BY-A-PERSON/);
  assert.doesNotMatch(implement.prompt, /PLAN-ORIGINAL-TEXT/);
  assert.match(implement.prompt, /edited by a person/);
});

test('an edited output keeps the original and the edit as separate verified artifacts', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { task } = await ctx.newTask({ stages: PLAN_THEN_IMPLEMENT });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await ctx.act(started.id, { action: 'edit', output: 'PLAN-EDITED-BY-A-PERSON' });

  const run = await ctx.engine.getRun(started.id);
  const [plan] = run.attempts;
  assert.match(plan.output, /PLAN-ORIGINAL-TEXT/);
  assert.equal(plan.edited, 'PLAN-EDITED-BY-A-PERSON');
  assert.equal(await readFile(path.join(ctx.runDir(run), 'attempts', '01-plan', 'edited.md'), 'utf8'), 'PLAN-EDITED-BY-A-PERSON');
  assert.equal(run.audit.artifacts.ok, true);
  assert.equal(byType(run, 'output_edited').length, 1);
});

test('the prompt names the goal and the stage instructions', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { task } = await ctx.newTask({
    stages: [stage('implement', 'implement', { instructions: 'STANDING-INSTRUCTION-XYZ' })],
    title: 'Distinct task title',
    description: 'Distinct task description.',
  });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  const [attempt] = (await ctx.engine.getRun(started.id)).attempts;
  assert.match(attempt.prompt, /Task: T001 — Distinct task title/);
  assert.match(attempt.prompt, /Distinct task description\./);
  assert.match(attempt.prompt, /STANDING-INSTRUCTION-XYZ/);
});

// --- Rejection and routing -------------------------------------------------------

test('rejecting to an earlier stage with an excluded agent sends it to another agent with the feedback and the rejected output', async (t) => {
  const ctx = await setup(t, {
    agents: async ({ script }) => [
      commandAgent('agent-a', await script('a', scriptOk('agent-a'))),
      commandAgent('agent-b', await script('b', scriptOk('agent-b'))),
    ],
  });
  const stages = [stage('plan', 'plan'), stage('implement', 'implement', { gate: 'approve' })];
  const { task } = await ctx.newTask({ stages });
  const started = await ctx.start(task);
  await ctx.engine.settle();

  let run = await ctx.engine.getRun(started.id);
  assert.equal(run.status, 'awaiting_approval');
  assert.deepEqual(run.attempts.map((attempt) => [attempt.stageId, attempt.agentId]), [['plan', 'agent-a'], ['implement', 'agent-a']]);

  await ctx.act(run.id, { action: 'reject', stageId: 'plan', feedback: 'Cover the rollback path', excludeAgent: 'agent-a' });
  await ctx.engine.settle();
  run = await ctx.engine.getRun(run.id);

  assert.equal(run.attempts[1].status, 'rejected');
  const redo = run.attempts[2];
  assert.equal(redo.stageId, 'plan');
  assert.equal(redo.agentId, 'agent-b');
  assert.match(redo.prompt, /Cover the rollback path/);
  assert.match(redo.prompt, /OUT-agent-a-implement/);
  assert.match(redo.prompt, /sent back by a person/);
  assert.deepEqual(run.exclusions.plan, ['agent-a']);
  assert.equal(redo.scoreboard.find((row) => row.agentId === 'agent-a').reason, 'excluded by a person for this stage');
});

test('rejecting at the gate stage includes the sent-back answer and the feedback in the retry prompt', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { task } = await ctx.newTask({ stages: PLAN_THEN_IMPLEMENT });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await ctx.act(started.id, { action: 'reject', feedback: 'Add acceptance checks' });
  await ctx.engine.settle();

  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.status, 'awaiting_approval');
  const [first, second] = run.attempts;
  assert.equal(first.status, 'rejected');
  assert.equal(second.stageId, 'plan');
  assert.match(second.prompt, /## Feedback from people/);
  assert.match(second.prompt, /Add acceptance checks/);
  assert.match(second.prompt, /Your previous answer for this stage \(sent back\)/);
  assert.match(second.prompt, /PLAN-ORIGINAL-TEXT/);
  const [agent] = await ctx.engine.agentPerformance();
  assert.equal(agent.performance.plan.rejections, 1);
});

test('rejecting to a later stage is refused', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { task } = await ctx.newTask({ stages: PLAN_THEN_IMPLEMENT });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await expectStatus(ctx.act(started.id, { action: 'reject', stageId: 'implement', feedback: 'Skip ahead' }), 400);
});

test('pinning an agent through the reject action routes the redo to that agent', async (t) => {
  const ctx = await setup(t, {
    agents: async ({ script }) => [
      commandAgent('agent-a', await script('a', scriptOk('agent-a'))),
      commandAgent('agent-b', await script('b', scriptOk('agent-b'))),
    ],
  });
  const { task } = await ctx.newTask({ stages: PLAN_THEN_IMPLEMENT });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await ctx.act(started.id, { action: 'reject', feedback: 'Again, with Bee', pinAgent: 'agent-b' });
  await ctx.engine.settle();
  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.attempts[1].agentId, 'agent-b');
  assert.equal(run.attempts[1].reason, 'pinned by a person');
  assert.equal(run.pins.plan, 'agent-b');
});

test('a stage pinned in the pipeline always uses the pinned agent', async (t) => {
  const ctx = await setup(t, {
    agents: async ({ script }) => [
      commandAgent('agent-a', await script('a', scriptOk('agent-a'))),
      commandAgent('agent-z', await script('z', scriptOk('agent-z')), { tier: 'haiku' }),
    ],
  });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement', { pinnedAgent: 'agent-z' })] });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.attempts[0].agentId, 'agent-z');
});

test('rejecting with an unknown agent id is a client error', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { task } = await ctx.newTask({ stages: PLAN_THEN_IMPLEMENT });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await expectStatus(ctx.act(started.id, { action: 'reject', feedback: 'x', excludeAgent: 'ghost' }), 400);
});

// --- Verdicts and failures ------------------------------------------------------

const IMPLEMENT_THEN_REVIEW = [
  stage('implement', 'implement'),
  stage('review', 'review', { verdict: true, onFail: 'goto:implement', maxAttempts: 2 }),
];

test('a FAIL verdict returns to the implement stage whose prompt includes the reported defects', async (t) => {
  const ctx = await setup(t, { agents: async ({ script }) => [commandAgent('strict', await script('strict', scriptFailVerdict))] });
  const { task } = await ctx.newTask({ stages: IMPLEMENT_THEN_REVIEW });
  const started = await ctx.start(task);
  await ctx.engine.settle();

  const run = await ctx.engine.getRun(started.id);
  const review = run.attempts[1];
  assert.equal(review.stageId, 'review');
  assert.equal(review.status, 'failed');
  assert.equal(review.verdict, 'FAIL');
  assert.equal(review.error, 'The agent reported VERDICT: FAIL');
  const reimplement = run.attempts[2];
  assert.equal(reimplement.stageId, 'implement');
  assert.match(reimplement.prompt, /### Review — reported defects/);
  assert.match(reimplement.prompt, /DEFECT-ALPHA: off by one in the loop/);
  assert.equal(byType(run, 'stage_moved').filter((event) => event.data.to === 0).length, 1);
});

test('the run fails and the task is blocked after the review exhausts its attempts', async (t) => {
  const ctx = await setup(t, { agents: async ({ script }) => [commandAgent('strict', await script('strict', scriptFailVerdict))] });
  const { task } = await ctx.newTask({ stages: IMPLEMENT_THEN_REVIEW });
  const started = await ctx.start(task);
  await ctx.engine.settle();

  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.status, 'failed');
  assert.deepEqual(run.attempts.map((attempt) => [attempt.stageId, attempt.status]), [
    ['implement', 'succeeded'], ['review', 'failed'], ['implement', 'succeeded'], ['review', 'failed'],
  ]);
  assert.match(run.error, /Review failed 2 times \(limit 2\)/);
  assert.equal(await ctx.taskStatus(task), 'blocked');
  assert.equal(run.needsHuman, true);
  assert.equal(byType(run, 'run_failed').length, 1);
});

test('retrying a failed run restarts it and moves the task back to in progress', async (t) => {
  const ctx = await setup(t, { agents: async ({ script }) => [commandAgent('strict', await script('strict', scriptFailVerdict))] });
  const { task } = await ctx.newTask({ stages: IMPLEMENT_THEN_REVIEW });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  assert.equal(await ctx.taskStatus(task), 'blocked');

  const retried = await ctx.act(started.id, { action: 'retry' });
  assert.notEqual(retried.status, 'failed');
  assert.equal(await ctx.taskStatus(task), 'in_progress');
  assert.equal(byType(retried, 'retried').length, 1);

  await ctx.engine.settle();
  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.status, 'failed', 'the agent still fails, so the run fails again');
  assert.equal(run.attempts.length, 7);
  assert.equal(await ctx.taskStatus(task), 'blocked');
  assert.equal(run.audit.chain.ok, true);
});

test('retrying a run that has not failed is refused', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { task } = await ctx.newTask({ stages: PLAN_THEN_IMPLEMENT });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await expectStatus(ctx.act(started.id, { action: 'retry' }), 409, /Only a failed run can be retried/);
});

test('a command that exits with code 1 is retried until the stage maxAttempts and then the run fails', async (t) => {
  const ctx = await setup(t, { agents: async ({ script }) => [commandAgent('broken', await script('broken', scriptExit1))] });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement', { maxAttempts: 3, onFail: 'retry' })] });
  const started = await ctx.start(task);
  await ctx.engine.settle();

  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.status, 'failed');
  assert.equal(run.attempts.length, 3);
  for (const attempt of run.attempts) {
    assert.equal(attempt.status, 'failed');
    assert.equal(attempt.exitCode, 1);
    assert.equal(attempt.error, 'Agent exited with code 1');
    assert.equal(attempt.stderr, 'boom\n');
  }
  assert.equal(byType(run, 'run_failed').length, 1);
  assert.equal(await ctx.taskStatus(task), 'blocked');
  assert.equal(await readFile(path.join(ctx.runDir(run), 'attempts', '03-implement', 'stderr.log'), 'utf8'), 'boom\n');
  const [agent] = await ctx.engine.agentPerformance();
  assert.equal(agent.performance.implement.failures, 3);
});

test('onFail stop fails the run on the first failed attempt', async (t) => {
  const ctx = await setup(t, { agents: async ({ script }) => [commandAgent('broken', await script('broken', scriptExit1))] });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement', { maxAttempts: 5, onFail: 'stop' })] });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.status, 'failed');
  assert.equal(run.attempts.length, 1);
});

test('a verdict stage whose agent omits the verdict line fails instead of passing unchecked', async (t) => {
  const ctx = await setup(t, { agents: async ({ script }) => [commandAgent('plain', await script('plain', `${PRELUDE}\nprocess.stdout.write('no verdict here\\n');\n`))] });
  const { task } = await ctx.newTask({ stages: [stage('review', 'review', { verdict: true, maxAttempts: 1 })] });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.attempts[0].verdict, 'MISSING');
  assert.equal(run.attempts[0].status, 'failed');
  assert.match(run.attempts[0].error, /did not end with VERDICT/);
  assert.equal(run.status, 'failed');
});

test('an agent that overruns timeoutSec is stopped and the attempt fails with the signal recorded', async (t) => {
  const ctx = await setup(t, { agents: async ({ script }) => [commandAgent('sleepy', await script('sleepy', scriptSleep), { timeoutSec: 5 })] });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement', { maxAttempts: 1 })] });
  const started = await ctx.start(task);
  const before = Date.now();
  await ctx.engine.settle();
  const elapsed = Date.now() - before;

  const run = await ctx.engine.getRun(started.id);
  const [attempt] = run.attempts;
  assert.equal(attempt.status, 'failed');
  assert.match(attempt.error, /signal|SIGTERM|timed? ?out/i);
  assert.match(attempt.stderr, /Timed out after 5s/);
  assert.equal(attempt.exitCode, null);
  assert.ok(elapsed >= 4500, `the agent should have been allowed about 5s, was stopped after ${elapsed}ms`);
  assert.ok(elapsed < 20000, `the agent should have been stopped promptly, ran for ${elapsed}ms`);
  assert.equal(run.status, 'failed');
});

// --- Human stages and waiting ------------------------------------------------------

const HUMAN_STAGE = [stage('write', 'implement', { executor: 'human' })];

test('a human executor stage waits for input and the submit action completes it', async (t) => {
  const ctx = await setup(t, { agents: async () => [] });
  const { task } = await ctx.newTask({ stages: HUMAN_STAGE });
  const started = await ctx.start(task);
  await ctx.engine.settle();

  let run = await ctx.engine.getRun(started.id);
  assert.equal(run.status, 'awaiting_input');
  assert.equal(run.attempts[0].runner, 'human');
  assert.equal(run.attempts[0].status, 'awaiting_input');
  assert.equal(run.needsHuman, true);

  run = await ctx.act(run.id, { action: 'submit', output: 'Written by a person.' });
  assert.equal(run.status, 'completed');
  assert.equal(run.attempts[0].status, 'succeeded');
  assert.equal(run.attempts[0].output, 'Written by a person.');
  assert.equal(run.attempts[0].finishedBy, OPERATOR);
  assert.equal(await ctx.taskStatus(task), 'done');
  assert.equal(run.audit.artifacts.ok, true);
});

test('submit with nothing assigned to a person is a conflict', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { task } = await ctx.newTask({ stages: PLAN_THEN_IMPLEMENT });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await expectStatus(ctx.act(started.id, { action: 'submit', output: 'x' }), 409, /No stage is waiting for a person/);
});

const disabledAgent = async ({ script }) => [commandAgent('ok', await script('ok', scriptOk('ok')), { enabled: false })];

test('a run waits with a reason when no agent can take the stage and records the wait only once', async (t) => {
  const ctx = await setup(t, { agents: disabledAgent });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement')] });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await ctx.engine.settle();
  await ctx.engine.tick();
  await ctx.engine.tick();
  await ctx.engine.settle();

  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.status, 'waiting');
  assert.match(run.waitingReason, /No available agent takes the implement role/);
  assert.equal(run.needsHuman, true);
  assert.equal(byType(run, 'waiting').length, 1);
  assert.equal(run.attempts.length, 0);
});

test('taking over a waiting stage assigns it to a person', async (t) => {
  const ctx = await setup(t, { agents: disabledAgent });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement')] });
  const started = await ctx.start(task);
  await ctx.engine.settle();

  let run = await ctx.act(started.id, { action: 'takeover' });
  assert.equal(run.status, 'awaiting_input');
  assert.equal(run.attempts[0].runner, 'human');
  assert.match(run.attempts[0].reason, /taken over by/);

  run = await ctx.act(run.id, { action: 'submit', output: 'Done by hand.' });
  assert.equal(run.status, 'completed');
});

test('enabling an agent while a run waits dispatches the stage on the next tick', async (t) => {
  const ctx = await setup(t, { agents: disabledAgent });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement')] });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  assert.equal((await ctx.engine.getRun(started.id)).status, 'waiting');

  const agent = await ctx.registry.get('ok');
  await ctx.registry.update('ok', { version: agent.version, enabled: true });
  await ctx.engine.settle();

  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.status, 'completed');
  assert.equal(run.attempts[0].agentId, 'ok');
  assert.equal(byType(run, 'waiting').length, 1);
});

// --- Conflicts -------------------------------------------------------------------------

test('an action with a stale expectedSeq is a 409 and changes nothing', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { task } = await ctx.newTask({ stages: PLAN_THEN_IMPLEMENT });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  const run = await ctx.engine.getRun(started.id);

  await expectStatus(ctx.engine.act(run.id, { action: 'approve', expectedSeq: run.lastSeq - 1 }), 409, /has changed/);
  await expectStatus(ctx.engine.act(run.id, { action: 'approve' }), 409, /has changed/);
  const after = await ctx.engine.getRun(run.id);
  assert.equal(after.lastSeq, run.lastSeq);
  assert.equal(after.status, 'awaiting_approval');
});

test('a comment is accepted without an expectedSeq and lands in the audit trail', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { task } = await ctx.newTask({ stages: PLAN_THEN_IMPLEMENT });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  const run = await ctx.engine.act(started.id, { action: 'comment', text: 'Looks plausible', stageId: 'plan' });
  assert.deepEqual(run.comments.map((comment) => [comment.text, comment.stageId, comment.by]), [['Looks plausible', 'plan', OPERATOR]]);
  assert.equal(run.audit.chain.ok, true);
});

test('approve with nothing waiting for approval is a 409', async (t) => {
  const ctx = await setup(t, { agents: async () => [] });
  const { task } = await ctx.newTask({ stages: HUMAN_STAGE });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await expectStatus(ctx.act(started.id, { action: 'approve' }), 409, /Nothing is waiting for approval/);
});

test('an unknown action is a 400', async (t) => {
  const ctx = await setup(t, { agents: async () => [] });
  const { task } = await ctx.newTask({ stages: HUMAN_STAGE });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await expectStatus(ctx.act(started.id, { action: 'explode' }), 400);
});

test('acting on an unknown run is a 404', async (t) => {
  const ctx = await setup(t, { agents: async () => [] });
  await expectStatus(ctx.engine.act('nope:R001', { action: 'pause', expectedSeq: 1 }), 404);
  await expectStatus(ctx.engine.getRun('nope:R001'), 404);
});

test('starting a second run on a task that already has an active run is a 409', async (t) => {
  const ctx = await setup(t, { agents: async () => [] });
  const { task } = await ctx.newTask({ stages: HUMAN_STAGE });
  await ctx.start(task);
  await ctx.engine.settle();
  await expectStatus(ctx.start(task), 409, /already has an active run \(R001\)/);
  assert.equal(ctx.engine.listRuns().length, 1);
});

test('a finished run no longer blocks starting a new run on the same task', async (t) => {
  const ctx = await setup(t, { agents: async () => [] });
  const { task } = await ctx.newTask({ stages: HUMAN_STAGE });
  const first = await ctx.start(task);
  await ctx.engine.settle();
  await ctx.act(first.id, { action: 'cancel', reason: 'Start over' });
  const second = await ctx.start(task);
  assert.equal(second.localId, 'R002');
});

test('starting a run when the project WIP limit is reached is a 409 and creates no run', async (t) => {
  const ctx = await setup(t, { agents: async () => [] });
  const { project, task: first } = await ctx.newTask({ stages: HUMAN_STAGE, wipLimit: 1 });
  const second = await ctx.addTask(project, 'Second task');
  await ctx.start(first);
  await ctx.engine.settle();

  await expectStatus(ctx.start(second), 409, /WIP limit/);
  assert.equal(ctx.engine.listRuns().length, 1);
  assert.equal(await ctx.taskStatus(second), 'backlog');
});

test('starting a run for an unknown task is a 404', async (t) => {
  const ctx = await setup(t, { agents: async () => [] });
  const { project } = await ctx.newTask({ stages: HUMAN_STAGE });
  await expectStatus(ctx.engine.startRun({ taskId: `${project.id}:T999` }), 404);
});

// --- Pause, resume, cancel -------------------------------------------------------------

test('pause stops new dispatches and resume continues the run', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { task } = await ctx.newTask({ stages: PLAN_THEN_IMPLEMENT });
  const started = await ctx.start(task);
  await ctx.engine.settle();

  await ctx.act(started.id, { action: 'pause' });
  await ctx.act(started.id, { action: 'approve' });
  await ctx.engine.settle();
  await ctx.engine.tick();
  let run = await ctx.engine.getRun(started.id);
  assert.equal(run.paused, true);
  assert.equal(run.status, 'running');
  assert.equal(run.attempts.length, 1, 'no implement attempt may be dispatched while paused');

  await ctx.act(started.id, { action: 'resume' });
  await ctx.engine.settle();
  run = await ctx.engine.getRun(started.id);
  assert.equal(run.paused, false);
  assert.equal(run.status, 'completed');
  assert.equal(run.attempts.length, 2);
});

test('pausing an already paused run and resuming one that is not paused are conflicts', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { task } = await ctx.newTask({ stages: PLAN_THEN_IMPLEMENT });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await expectStatus(ctx.act(started.id, { action: 'resume' }), 409, /not paused/);
  await ctx.act(started.id, { action: 'pause' });
  await expectStatus(ctx.act(started.id, { action: 'pause' }), 409, /already paused/);
});

test('cancel ends the run, cancels its open attempt, and leaves the task status unchanged', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const { task } = await ctx.newTask({ stages: PLAN_THEN_IMPLEMENT });
  const started = await ctx.start(task);
  await ctx.engine.settle();

  const run = await ctx.act(started.id, { action: 'cancel', reason: 'No longer needed' });
  assert.equal(run.status, 'cancelled');
  assert.equal(run.attempts[0].status, 'cancelled');
  assert.equal(await ctx.taskStatus(task), 'in_progress');

  await ctx.engine.settle();
  assert.equal((await ctx.engine.getRun(started.id)).attempts.length, 1);
  await expectStatus(ctx.act(started.id, { action: 'approve' }), 409, /Run is cancelled/);
});

test('cancelling a run stops its running agent process', async (t) => {
  const ctx = await setup(t, { agents: async ({ script }) => [commandAgent('sleepy', await script('sleepy', scriptSleep))] });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement', { maxAttempts: 1 })] });
  const started = await ctx.start(task);
  await until(async () => ctx.engine.processes.size === 1, { message: 'the agent process to start' });

  await ctx.act(started.id, { action: 'cancel' });
  await ctx.engine.settle();
  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.status, 'cancelled');
  assert.equal(ctx.engine.processes.size, 0);
  assert.equal(run.audit.chain.ok, true);
  assert.equal(await ctx.taskStatus(task), 'in_progress');
});

// --- Pull runner ---------------------------------------------------------------------------

const PULL_STAGE = [stage('implement', 'implement', { maxAttempts: 2 })];
const pullAgents = async ({ script }) => [
  pullAgent('puller'),
  commandAgent('cmd', await script('ok', scriptOk('cmd')), { roles: ['plan'] }),
];

test('a pull agent gets a queued attempt, claims it with the prompt, and completes the stage', async (t) => {
  const ctx = await setup(t, { agents: pullAgents });
  const { task } = await ctx.newTask({ stages: PULL_STAGE });
  const started = await ctx.start(task);
  await ctx.engine.settle();

  let run = await ctx.engine.getRun(started.id);
  assert.equal(run.status, 'running');
  assert.equal(run.attempts[0].status, 'queued');
  assert.equal(run.attempts[0].runner, 'pull');
  assert.equal(ctx.engine.processes.size, 0);

  const work = await ctx.engine.claim('puller');
  assert.equal(work.attemptId, `${started.id}:1`);
  assert.equal(work.runId, started.id);
  assert.equal(work.stage.id, 'implement');
  assert.match(work.prompt, /^Role: implement$/m);
  assert.ok(Date.parse(work.leaseUntil) > Date.now());
  assert.equal((await ctx.engine.getRun(started.id)).attempts[0].status, 'running');
  assert.equal(await ctx.engine.claim('puller'), null, 'the same attempt cannot be claimed twice');

  run = await ctx.engine.complete(work.attemptId, { agentId: 'puller', outcome: 'succeeded', output: 'Pulled result.' });
  assert.equal(run.status, 'completed');
  assert.equal(run.attempts[0].status, 'succeeded');
  assert.equal(run.attempts[0].output, 'Pulled result.');
  assert.equal(run.attempts[0].finishedBy, 'puller');
  assert.equal(await ctx.taskStatus(task), 'done');
});

test('claim returns null when nothing is queued for the agent', async (t) => {
  const ctx = await setup(t, { agents: pullAgents });
  assert.equal(await ctx.engine.claim('puller'), null);
});

test('completing an attempt as a different agent is a 403 and leaves the attempt running', async (t) => {
  const ctx = await setup(t, { agents: pullAgents });
  const { task } = await ctx.newTask({ stages: PULL_STAGE });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  const work = await ctx.engine.claim('puller');

  await expectStatus(ctx.engine.complete(work.attemptId, { agentId: 'cmd', outcome: 'succeeded', output: 'stolen' }), 403);
  await expectStatus(ctx.engine.heartbeat(work.attemptId, { agentId: 'cmd' }), 403);
  await expectStatus(ctx.engine.complete(work.attemptId, { output: 'anonymous' }), 403);
  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.attempts[0].status, 'running');
});

test('completing an attempt that was never claimed is a 409', async (t) => {
  const ctx = await setup(t, { agents: pullAgents });
  const { task } = await ctx.newTask({ stages: PULL_STAGE });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await expectStatus(ctx.engine.complete(`${started.id}:1`, { agentId: 'puller', output: 'early' }), 409, /Attempt is queued/);
});

test('completing an unknown attempt is a 404', async (t) => {
  const ctx = await setup(t, { agents: pullAgents });
  const { task } = await ctx.newTask({ stages: PULL_STAGE });
  const started = await ctx.start(task);
  await expectStatus(ctx.engine.complete(`${started.id}:9`, { agentId: 'puller' }), 404);
});

test('a pull agent that reports failure triggers the stage retry policy', async (t) => {
  const ctx = await setup(t, { agents: pullAgents });
  const { task } = await ctx.newTask({ stages: PULL_STAGE });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  const work = await ctx.engine.claim('puller');
  const run = await ctx.engine.complete(work.attemptId, { agentId: 'puller', outcome: 'failed', error: 'Could not build' });
  assert.equal(run.attempts[0].status, 'failed');
  assert.equal(run.attempts[0].error, 'Could not build');
  await ctx.engine.settle();
  const retried = await ctx.engine.getRun(started.id);
  assert.equal(retried.attempts.length, 2);
  assert.equal(retried.attempts[1].status, 'queued');
});

test('only enabled pull agents can claim work', async (t) => {
  const ctx = await setup(t, { agents: pullAgents });
  await expectStatus(ctx.engine.claim('cmd'), 400, /Only pull agents claim work/);
  await expectStatus(ctx.engine.claim('missing'), 404);
  const puller = await ctx.registry.get('puller');
  await ctx.registry.update('puller', { version: puller.version, enabled: false });
  await expectStatus(ctx.engine.claim('puller'), 409, /disabled/);
});

test('a heartbeat extends the lease of a claimed attempt', async (t) => {
  const ctx = await setup(t, { agents: pullAgents, engineOptions: { leaseMs: 60000 } });
  const { task } = await ctx.newTask({ stages: PULL_STAGE });
  await ctx.start(task);
  await ctx.engine.settle();
  const work = await ctx.engine.claim('puller');
  await new Promise((resolve) => setTimeout(resolve, 20));
  const { leaseUntil } = await ctx.engine.heartbeat(work.attemptId, { agentId: 'puller' });
  assert.ok(Date.parse(leaseUntil) > Date.parse(work.leaseUntil));
});

test('an expired lease returns the attempt to the queue and records the expiry', async (t) => {
  const ctx = await setup(t, { agents: pullAgents, engineOptions: { leaseMs: 50 } });
  const { task } = await ctx.newTask({ stages: PULL_STAGE });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  const work = await ctx.engine.claim('puller');
  assert.equal((await ctx.engine.getRun(started.id)).attempts[0].status, 'running');

  await new Promise((resolve) => setTimeout(resolve, 100));
  await ctx.engine.tick();

  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.attempts[0].status, 'queued');
  assert.equal(byType(run, 'lease_expired').length, 1);
  assert.equal(run.status, 'running');
  const again = await ctx.engine.claim('puller');
  assert.equal(again.attemptId, work.attemptId, 'the expired attempt can be claimed again');
});

test('a lease that is still valid is not expired by a tick', async (t) => {
  const ctx = await setup(t, { agents: pullAgents, engineOptions: { leaseMs: 60000 } });
  const { task } = await ctx.newTask({ stages: PULL_STAGE });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await ctx.engine.claim('puller');
  await ctx.engine.tick();
  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.attempts[0].status, 'running');
  assert.equal(byType(run, 'lease_expired').length, 0);
});

// --- Restart recovery -------------------------------------------------------------------------

async function restartScenario(t, maxAttempts) {
  const ctx = await setup(t, { agents: async ({ script }) => [commandAgent('slow', await script('slow', scriptSleep))] });
  const { project, task } = await ctx.newTask({ stages: [stage('implement', 'implement', { maxAttempts })] });
  const started = await ctx.start(task);
  await until(async () => (await ctx.engine.getRun(started.id)).attempts[0]?.status === 'running' && ctx.engine.processes.size === 1, { message: 'the agent to start' });

  const workspace = await new Workspace({ dataDir: ctx.dataDir, operator: OPERATOR, email: EMAIL }).init();
  const registry = await new AgentRegistry({ dataDir: workspace.dataDir, operator: OPERATOR, email: EMAIL, seed: () => [] }).init();
  const restarted = new PipelineEngine({ workspace, registry });
  ctx.engines.push(restarted);
  await restarted.init();
  // The server starts the engine right after init; recovery dispatches then.
  restarted.start();
  return { ctx, project, task, started, restarted, workspace, registry };
}

test('after a restart an attempt that was running is failed as interrupted and the failure policy ends the run', async (t) => {
  const { ctx, task, started, restarted, workspace } = await restartScenario(t, 1);
  const run = await restarted.getRun(started.id);
  assert.equal(run.attempts[0].status, 'failed');
  assert.match(run.attempts[0].error, /Interrupted/);
  assert.equal(run.attempts[0].finishedBy, 'agesight');
  assert.equal(run.status, 'failed');
  assert.match(run.error, /Interrupted/);
  assert.equal(run.audit.chain.ok, true);
  assert.equal((await workspace.getTask(task.id)).status, 'blocked');
  await ctx.engine.stop();
  assert.equal(ctx.engine.processes.size, 0);
});

test('after a restart an interrupted attempt is retried when the stage still has attempts left', async (t) => {
  const { ctx, started, restarted } = await restartScenario(t, 2);
  const first = await restarted.getRun(started.id);
  assert.equal(first.attempts[0].status, 'failed');
  assert.match(first.attempts[0].error, /Interrupted/);

  const second = await until(async () => {
    const run = await restarted.getRun(started.id);
    return run.attempts.length === 2 && run.attempts[1].status === 'running' && restarted.processes.size === 1 ? run : null;
  }, { message: 'the retry to be dispatched and started' });
  assert.equal(second.attempts[1].stageId, 'implement');
  assert.notEqual(second.status, 'failed');
  await ctx.engine.stop();
});

test('a shutdown kill is not recorded as an agent failure and the next start marks the attempt interrupted', async (t) => {
  const { ctx, started, restarted, workspace, registry } = await restartScenario(t, 2);
  await until(async () => {
    const run = await restarted.getRun(started.id);
    return run.attempts.length === 2 && run.attempts[1].status === 'running' && restarted.processes.size === 1;
  }, { message: 'the retry to be dispatched and started' });

  await restarted.stop();
  await ctx.engine.stop();
  const stopped = await restarted.getRun(started.id);
  assert.equal(stopped.attempts[1].status, 'running', 'stopping the engine must not count against the agent');
  assert.equal(stopped.audit.chain.ok, true);

  const third = new PipelineEngine({ workspace, registry });
  ctx.engines.push(third);
  await third.init();
  const final = await third.getRun(started.id);
  assert.equal(final.attempts[1].status, 'failed');
  assert.match(final.attempts[1].error, /Interrupted/);
  assert.equal(final.status, 'failed', 'two interrupted attempts used up the stage');
  assert.equal(final.audit.chain.ok, true);
});

test('a restart leaves a queued pull attempt and an approval gate untouched', async (t) => {
  const ctx = await setup(t, { agents: async ({ script }) => [pullAgent('puller'), commandAgent('ok', await script('ok', scriptOk('ok')), { roles: ['plan'] })] });
  const { task: pullTask } = await ctx.newTask({ stages: [stage('implement', 'implement')] });
  const { task: gateTask } = await ctx.newTask({ stages: [stage('plan', 'plan', { gate: 'approve' })] });
  const pullRun = await ctx.start(pullTask);
  const gateRun = await ctx.start(gateTask);
  await ctx.engine.settle();
  await ctx.engine.claim('puller');

  const restarted = await new PipelineEngine({ workspace: ctx.workspace, registry: ctx.registry }).init();
  ctx.engines.push(restarted);
  assert.equal((await restarted.getRun(pullRun.id)).attempts[0].status, 'running');
  assert.equal((await restarted.getRun(gateRun.id)).status, 'awaiting_approval');
  assert.equal((await restarted.getRun(gateRun.id)).audit.chain.ok, true);
});

// --- Tampering ------------------------------------------------------------------------------------

async function gatedRun(t) {
  const ctx = await setup(t, { agents: okAgents() });
  const { task } = await ctx.newTask({ stages: PLAN_THEN_IMPLEMENT });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  return { ctx, task, run: await ctx.engine.getRun(started.id) };
}

test('getRun returns one consistent snapshot even when the run moves on while its files are read', async (t) => {
  const { ctx, run } = await gatedRun(t);
  const read = ctx.engine._readArtifact.bind(ctx.engine);
  let moved = false;
  ctx.engine._readArtifact = async (...args) => {
    if (!moved) {
      moved = true;
      await ctx.engine.act(run.id, { action: 'comment', text: 'added mid-read' });
    }
    return read(...args);
  };
  const snapshot = await ctx.engine.getRun(run.id);
  assert.equal(moved, true);
  assert.equal(snapshot.events.at(-1).type, 'commented');
  assert.equal(snapshot.lastSeq, snapshot.events.length);
  assert.ok(snapshot.comments.some((comment) => comment.text === 'added mid-read'), 'the state matches the events it is returned with');
  assert.deepEqual(snapshot.attempts.map((attempt) => attempt.status), run.attempts.map((attempt) => attempt.status));
});

test('editing a line of events.jsonl on disk fails verification after a restart and blocks further actions', async (t) => {
  const { ctx, run } = await gatedRun(t);
  const file = path.join(ctx.runDir(run), 'events.jsonl');
  const lines = (await readFile(file, 'utf8')).split('\n').filter(Boolean);
  const event = JSON.parse(lines[1]);
  event.data.agentId = 'someone-else';
  lines[1] = JSON.stringify(event);
  await writeFile(file, `${lines.join('\n')}\n`);

  const restarted = await new PipelineEngine({ workspace: ctx.workspace, registry: ctx.registry }).init();
  ctx.engines.push(restarted);
  const tampered = await restarted.getRun(run.id);
  assert.equal(tampered.audit.chain.ok, false);
  assert.equal(tampered.audit.chain.brokenAt, 2);
  assert.equal(tampered.integrity, false);
  assert.equal(tampered.needsHuman, true);

  await expectStatus(restarted.act(run.id, { action: 'approve', expectedSeq: tampered.lastSeq }), 409, /failed verification at event 2/);
  await expectStatus(restarted.act(run.id, { action: 'comment', text: 'still no' }), 409, /failed verification/);
  await restarted.settle();
  assert.equal((await restarted.getRun(run.id)).attempts.length, run.attempts.length, 'a tampered run is never advanced');
});

test('deleting a line of events.jsonl on disk is flagged after a restart instead of stopping the engine', async (t) => {
  const { ctx, run } = await gatedRun(t);
  const file = path.join(ctx.runDir(run), 'events.jsonl');
  const lines = (await readFile(file, 'utf8')).split('\n').filter(Boolean);
  lines.splice(1, 1);
  await writeFile(file, `${lines.join('\n')}\n`);
  const restarted = new PipelineEngine({ workspace: ctx.workspace, registry: ctx.registry });
  ctx.engines.push(restarted);
  await restarted.init();
  const tampered = await restarted.getRun(run.id);
  assert.equal(tampered.audit.chain.ok, false);
  assert.equal(tampered.audit.chain.reason, 'sequence gap');
});

test('a line of events.jsonl that is not valid JSON is flagged after a restart instead of stopping the engine', async (t) => {
  const { ctx, run } = await gatedRun(t);
  const file = path.join(ctx.runDir(run), 'events.jsonl');
  const lines = (await readFile(file, 'utf8')).split('\n').filter(Boolean);
  lines[2] = `${lines[2].slice(0, 20)}`;
  await writeFile(file, `${lines.join('\n')}\n`);
  const restarted = new PipelineEngine({ workspace: ctx.workspace, registry: ctx.registry });
  ctx.engines.push(restarted);
  await restarted.init();
  const summary = restarted.listRuns().find((entry) => entry.id === run.id);
  assert.equal(summary.integrity, false);
  assert.equal(summary.needsHuman, true);
});

test('one tampered run does not stop other runs from loading after a restart', async (t) => {
  const { ctx, run } = await gatedRun(t);
  const { task } = await ctx.newTask({ stages: HUMAN_STAGE });
  const other = await ctx.start(task);
  await ctx.engine.settle();
  const file = path.join(ctx.runDir(run), 'events.jsonl');
  const lines = (await readFile(file, 'utf8')).split('\n').filter(Boolean);
  lines.splice(1, 1);
  await writeFile(file, `${lines.join('\n')}\n`);
  const restarted = new PipelineEngine({ workspace: ctx.workspace, registry: ctx.registry });
  ctx.engines.push(restarted);
  await restarted.init();
  assert.equal((await restarted.getRun(other.id)).status, 'awaiting_input');
  assert.equal((await restarted.getRun(other.id)).audit.chain.ok, true);
});

test('modifying output.md after the fact is reported as an artifact mismatch with its path', async (t) => {
  const { ctx, run } = await gatedRun(t);
  await writeFile(path.join(ctx.runDir(run), 'attempts', '01-plan', 'output.md'), 'A quietly rewritten plan\n');
  const checked = await ctx.engine.getRun(run.id);
  assert.equal(checked.audit.chain.ok, true);
  assert.equal(checked.audit.artifacts.ok, false);
  assert.deepEqual(checked.audit.artifacts.mismatches, ['attempts/01-plan/output.md']);
});

test('modifying prompt.md or edited.md after the fact is reported as an artifact mismatch', async (t) => {
  const { ctx, run } = await gatedRun(t);
  await ctx.act(run.id, { action: 'edit', output: 'Edited plan' });
  const dir = path.join(ctx.runDir(run), 'attempts', '01-plan');
  await writeFile(path.join(dir, 'prompt.md'), 'Different prompt\n');
  await writeFile(path.join(dir, 'edited.md'), 'Different edit\n');
  const checked = await ctx.engine.getRun(run.id);
  assert.equal(checked.audit.artifacts.ok, false);
  assert.deepEqual(checked.audit.artifacts.mismatches.sort(), ['attempts/01-plan/edited.md', 'attempts/01-plan/prompt.md']);
});

// --- Pipelines -------------------------------------------------------------------------------------------

async function pipelineContext(t) {
  const ctx = await setup(t, { agents: okAgents() });
  const project = await ctx.workspace.createProject({ name: 'Pipelines' });
  return { ctx, project };
}

test('a project without a saved pipeline reports the default stages', async (t) => {
  const { ctx, project } = await pipelineContext(t);
  const pipeline = await ctx.engine.getPipeline(project.id);
  assert.equal(pipeline.isDefault, true);
  assert.equal(pipeline.version, 'default');
  assert.deepEqual(pipeline.stages.map((entry) => entry.id), ['triage', 'plan', 'implement', 'review', 'verify']);
});

test('savePipeline rejects duplicate stage ids with a 400', async (t) => {
  const { ctx, project } = await pipelineContext(t);
  await expectStatus(ctx.engine.savePipeline(project.id, { version: 'default', stages: [stage('same', 'plan'), stage('same', 'implement')] }), 400, /used twice/);
});

test('savePipeline rejects a goto that points at a later stage with a 400', async (t) => {
  const { ctx, project } = await pipelineContext(t);
  const stages = [stage('first', 'plan', { onFail: 'goto:second' }), stage('second', 'implement')];
  await expectStatus(ctx.engine.savePipeline(project.id, { version: 'default', stages }), 400, /onFail/);
});

test('savePipeline rejects a goto that points at itself or at an unknown stage with a 400', async (t) => {
  const { ctx, project } = await pipelineContext(t);
  await expectStatus(ctx.engine.savePipeline(project.id, { version: 'default', stages: [stage('first', 'plan', { onFail: 'goto:first' })] }), 400);
  await expectStatus(ctx.engine.savePipeline(project.id, { version: 'default', stages: [stage('first', 'plan'), stage('second', 'implement', { onFail: 'goto:ghost' })] }), 400);
});

test('savePipeline rejects an unknown role with a 400', async (t) => {
  const { ctx, project } = await pipelineContext(t);
  await expectStatus(ctx.engine.savePipeline(project.id, { version: 'default', stages: [stage('first', 'wizard')] }), 400, /role must be one of/);
});

test('savePipeline rejects out-of-range maxAttempts, an unknown tier, and an empty stage list with a 400', async (t) => {
  const { ctx, project } = await pipelineContext(t);
  await expectStatus(ctx.engine.savePipeline(project.id, { version: 'default', stages: [stage('first', 'plan', { maxAttempts: 11 })] }), 400);
  await expectStatus(ctx.engine.savePipeline(project.id, { version: 'default', stages: [stage('first', 'plan', { tier: 'gigantic' })] }), 400);
  await expectStatus(ctx.engine.savePipeline(project.id, { version: 'default', stages: [] }), 400);
  assert.equal((await ctx.engine.getPipeline(project.id)).isDefault, true, 'nothing was saved');
});

test('savePipeline with a stale version is a 409', async (t) => {
  const { ctx, project } = await pipelineContext(t);
  const saved = await ctx.engine.savePipeline(project.id, { version: 'default', stages: [stage('first', 'plan')] });
  await expectStatus(ctx.engine.savePipeline(project.id, { version: 'default', stages: [stage('other', 'plan')] }), 409);
  await expectStatus(ctx.engine.savePipeline(project.id, { stages: [stage('other', 'plan')] }), 409);
  const updated = await ctx.engine.savePipeline(project.id, { version: saved.version, stages: [stage('other', 'plan')] });
  assert.notEqual(updated.version, saved.version);
});

test('a valid savePipeline is committed with an Update pipeline message and read back', async (t) => {
  const { ctx, project } = await pipelineContext(t);
  const saved = await ctx.engine.savePipeline(project.id, { version: 'default', stages: [stage('plan', 'plan', { gate: 'approve' }), stage('build', 'implement')] });
  assert.equal(saved.isDefault, false);
  const dir = ctx.projectDir(project.id);
  assert.equal(await git(dir, 'log', '-1', '--format=%s'), 'Update pipeline: Plan → Build');
  assert.equal(await git(dir, 'status', '--porcelain'), '');
  const read = await ctx.engine.getPipeline(project.id);
  assert.deepEqual(read.stages.map((entry) => entry.id), ['plan', 'build']);
  assert.equal(read.version, saved.version);
});

test('saving an identical pipeline again makes no new commit', async (t) => {
  const { ctx, project } = await pipelineContext(t);
  const stages = [stage('plan', 'plan')];
  const saved = await ctx.engine.savePipeline(project.id, { version: 'default', stages });
  const dir = ctx.projectDir(project.id);
  const before = await git(dir, 'rev-list', '--count', 'HEAD');
  await ctx.engine.savePipeline(project.id, { version: saved.version, stages });
  assert.equal(await git(dir, 'rev-list', '--count', 'HEAD'), before);
});

test('a run started before a pipeline save keeps its original stages and later runs use the new ones', async (t) => {
  const { ctx, project } = await pipelineContext(t);
  const first = await ctx.addTask(project, 'First task');
  const second = await ctx.addTask(project, 'Second task');
  const early = await ctx.start(first);
  assert.equal(early.pipeline.length, 5);

  await ctx.engine.savePipeline(project.id, { version: 'default', stages: [stage('plan', 'plan', { gate: 'approve' }), stage('build', 'implement')] });
  const late = await ctx.start(second);
  await ctx.engine.settle();

  const earlyAfter = await ctx.engine.getRun(early.id);
  assert.deepEqual(earlyAfter.pipeline.map((entry) => entry.id), ['triage', 'plan', 'implement', 'review', 'verify']);
  assert.equal(earlyAfter.attempts[0].stageId, 'triage');
  const lateAfter = await ctx.engine.getRun(late.id);
  assert.deepEqual(lateAfter.pipeline.map((entry) => entry.id), ['plan', 'build']);
  assert.equal(lateAfter.attempts[0].stageId, 'plan');
});

// --- Agent registry ----------------------------------------------------------------------------------------

async function registryContext(t, seed = () => [commandAgent('seeded', process.execPath)]) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agesight-registry-'));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 5 }));
  const registry = await new AgentRegistry({ dataDir: root, operator: OPERATOR, email: EMAIL, seed }).init();
  return { root, registry, dir: path.join(root, 'registry') };
}

const validAgent = (overrides = {}) => ({ id: 'new-agent', name: 'New agent', command: [process.execPath, '-e', '0'], roles: ['implement'], tier: 'haiku', ...overrides });

test('the seed agents are committed in the registry git repository', async (t) => {
  const { registry, dir } = await registryContext(t);
  assert.deepEqual((await registry.list()).map((agent) => agent.id), ['seeded']);
  assert.equal(await git(dir, 'log', '--format=%s'), 'Seed agent registry');
  assert.equal(await git(dir, 'status', '--porcelain'), '');
  assert.equal(await git(dir, 'rev-parse', '--show-toplevel'), dir);
});

test('opening an existing registry does not seed it again', async (t) => {
  const { root, dir } = await registryContext(t);
  const reopened = await new AgentRegistry({ dataDir: root, operator: OPERATOR, email: EMAIL, seed: () => [commandAgent('other-seed', process.execPath)] }).init();
  assert.deepEqual((await reopened.list()).map((agent) => agent.id), ['seeded']);
  assert.equal(await git(dir, 'rev-list', '--count', 'HEAD'), '1');
});

test('creating an agent validates the id, command, role, tier, and limits with a 400', async (t) => {
  const { registry } = await registryContext(t);
  await expectStatus(registry.create(validAgent({ id: 'Bad ID' })), 400, /lowercase letters/);
  await expectStatus(registry.create(validAgent({ id: '' })), 400);
  await expectStatus(registry.create(validAgent({ command: [] })), 400, /need a command/);
  await expectStatus(registry.create(validAgent({ command: ['ok', ''] })), 400);
  await expectStatus(registry.create(validAgent({ roles: ['wizard'] })), 400, /roles must list/);
  await expectStatus(registry.create(validAgent({ roles: [] })), 400);
  await expectStatus(registry.create(validAgent({ tier: 'gigantic' })), 400, /tier must be/);
  await expectStatus(registry.create(validAgent({ runner: 'carrier-pigeon' })), 400, /runner must be/);
  await expectStatus(registry.create(validAgent({ cwd: 'relative/path' })), 400, /absolute path/);
  await expectStatus(registry.create(validAgent({ timeoutSec: 1 })), 400, /timeoutSec/);
  await expectStatus(registry.create(validAgent({ maxConcurrent: 0 })), 400, /maxConcurrent/);
  assert.deepEqual((await registry.list()).map((agent) => agent.id), ['seeded']);
});

test('a pull agent may be created without a command', async (t) => {
  const { registry } = await registryContext(t);
  const created = await registry.create(validAgent({ id: 'remote', runner: 'pull', command: [] }));
  assert.equal(created.runner, 'pull');
  assert.deepEqual(created.command, []);
});

test('creating an agent commits it and a duplicate id is a 409', async (t) => {
  const { registry, dir } = await registryContext(t);
  const created = await registry.create(validAgent());
  assert.match(created.version, /^[0-9a-f]{64}$/);
  assert.equal(await git(dir, 'log', '-1', '--format=%s'), 'Add agent new-agent: New agent');
  await expectStatus(registry.create(validAgent()), 409, /already exists/);
  assert.equal(await git(dir, 'rev-list', '--count', 'HEAD'), '2');
});

test('updating an agent requires its current version and a stale version is a 409', async (t) => {
  const { registry } = await registryContext(t);
  const created = await registry.create(validAgent());
  await registry.update('new-agent', { version: created.version, enabled: false });
  await expectStatus(registry.update('new-agent', { version: created.version, enabled: true }), 409, /has changed/);
  await expectStatus(registry.update('new-agent', { enabled: true }), 409);
  assert.equal((await registry.get('new-agent')).enabled, false);
});

test('an update is validated, committed, and cannot change the id', async (t) => {
  const { registry, dir } = await registryContext(t);
  const created = await registry.create(validAgent());
  await expectStatus(registry.update('new-agent', { version: created.version, tier: 'gigantic' }), 400);
  const updated = await registry.update('new-agent', { version: created.version, id: 'renamed', name: 'Renamed agent', maxConcurrent: 3 });
  assert.equal(updated.id, 'new-agent');
  assert.equal(updated.name, 'Renamed agent');
  assert.equal(updated.maxConcurrent, 3);
  assert.notEqual(updated.version, created.version);
  assert.equal(await git(dir, 'log', '-1', '--format=%s'), 'Update agent new-agent: Renamed agent');
});

test('an update that changes nothing makes no commit', async (t) => {
  const { registry, dir } = await registryContext(t);
  const created = await registry.create(validAgent());
  const before = await git(dir, 'rev-list', '--count', 'HEAD');
  const same = await registry.update('new-agent', { version: created.version, name: 'New agent' });
  assert.equal(same.version, created.version);
  assert.equal(await git(dir, 'rev-list', '--count', 'HEAD'), before);
});

test('updating or reading an unknown agent is a 404', async (t) => {
  const { registry } = await registryContext(t);
  await expectStatus(registry.update('ghost', { version: 'x' }), 404);
  await expectStatus(registry.get('ghost'), 404);
});

test('concurrent creates of the same agent yield exactly one success and one 409', async (t) => {
  const { registry } = await registryContext(t);
  const results = await Promise.allSettled([registry.create(validAgent()), registry.create(validAgent())]);
  assert.deepEqual(results.map((result) => result.status).sort(), ['fulfilled', 'rejected']);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.equal(rejected.reason.status, 409);
  assert.equal((await registry.list()).filter((agent) => agent.id === 'new-agent').length, 1);
});

// --- Regression tests after the architect and security review -------------------------------------------------

// Scripts for the review regressions. Gate and pid files live next to the scripts in the test's temp dir.
const scriptGated = (gateFile, text) => `${PRELUDE}
const { existsSync } = await import('node:fs');
while (!existsSync(${JSON.stringify(gateFile)})) await new Promise((resolve) => setTimeout(resolve, 20));
process.stdout.write(${JSON.stringify(text)} + '\\n');
`;

const scriptArgv = `${PRELUDE}
process.stdout.write('ARGV:' + JSON.stringify(process.argv.slice(2)) + '\\n');
`;

// Starts a background grandchild that inherits the agent's stdout, records its pid, then
// either exits straight away or keeps running until it is stopped.
const scriptGrandchild = (pidFile, { exits }) => `const { spawn } = await import('node:child_process');
const { writeFileSync } = await import('node:fs');
const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); setTimeout(() => {}, 60000);'], { stdio: 'inherit' });
writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
process.stdout.write('parent-done\\n');
${exits ? 'process.exit(0);' : 'setInterval(() => {}, 1000);'}
`;

// A killed process that nobody has reaped yet is a zombie; it is not running any more.
function isAlive(pid) {
  try { process.kill(pid, 0); } catch { return false; }
  try { return !/^\d+ \(.*\) Z/.test(readFileSync(`/proc/${pid}/stat`, 'utf8')); } catch { return true; }
}

async function readEventLines(ctx, run) {
  return (await readFile(path.join(ctx.runDir(run), 'events.jsonl'), 'utf8')).split('\n').filter(Boolean);
}

const writeEventLines = (ctx, run, lines) => writeFile(path.join(ctx.runDir(run), 'events.jsonl'), `${lines.join('\n')}\n`);

test('a line of events.jsonl edited while the engine runs fails verification at once, locks the run, and rejects approval', async (t) => {
  const { ctx, run } = await gatedRun(t);
  const lines = await readEventLines(ctx, run);
  const event = JSON.parse(lines[1]);
  event.data.agentId = 'someone-else';
  lines[1] = JSON.stringify(event);
  await writeEventLines(ctx, run, lines);

  const tampered = await ctx.engine.getRun(run.id);
  assert.equal(tampered.audit.chain.ok, false);
  assert.equal(tampered.audit.chain.reason, 'event content changed');
  assert.equal(tampered.audit.chain.brokenAt, 2);
  assert.equal(tampered.integrity, false);
  assert.equal(tampered.needsHuman, true);
  assert.equal(ctx.engine.listRuns().find((entry) => entry.id === run.id).needsHuman, true);

  await expectStatus(ctx.engine.act(run.id, { action: 'approve', expectedSeq: run.lastSeq }), 409, /failed verification at event 2/);
  await ctx.engine.settle();
  assert.equal((await ctx.engine.getRun(run.id)).attempts.length, run.attempts.length, 'a tampered run is never advanced');
  assert.equal((await readEventLines(ctx, run)).join('\n'), lines.join('\n'), 'the engine must not write to a log it no longer trusts');
});

test('an approval is refused when the log was lengthened on disk before the engine re-verified it', async (t) => {
  const { ctx, run } = await gatedRun(t);
  const lines = await readEventLines(ctx, run);
  const event = JSON.parse(lines[1]);
  event.data.reason = 'a much longer reason than the one that was recorded';
  lines[1] = JSON.stringify(event);
  await writeEventLines(ctx, run, lines);

  await expectStatus(ctx.engine.act(run.id, { action: 'approve', expectedSeq: run.lastSeq }), 409, /changed on disk/);
  assert.equal((await ctx.engine.getRun(run.id)).audit.chain.ok, false);
  assert.equal(byType(await ctx.engine.getRun(run.id), 'approved').length, 0);
});

test('an approval is refused when a middle line was edited to the same length before the engine re-verified it', async (t) => {
  const { ctx, run } = await gatedRun(t);
  const lines = await readEventLines(ctx, run);
  assert.match(lines[1], /"agentId":"ok"/);
  lines[1] = lines[1].replace('"agentId":"ok"', '"agentId":"zz"');
  await writeEventLines(ctx, run, lines);

  await expectStatus(ctx.engine.act(run.id, { action: 'approve', expectedSeq: run.lastSeq }), 409);
  assert.equal((await readEventLines(ctx, run)).length, lines.length, 'nothing may be appended to a log that fails verification');
});

test('every run commit records the chain head and sequence in Audit-Head and Audit-Seq trailers', async (t) => {
  const { ctx, run } = await gatedRun(t);
  const body = await git(ctx.projectDir(run.projectId), 'log', '-1', '--format=%B', '--', `pipeline/runs/${run.localId}`);
  assert.match(body, /^Audit-Head: [0-9a-f]{64}$/m);
  assert.match(body, /^Audit-Seq: \d+$/m);
  assert.equal(/^Audit-Head: ([0-9a-f]{64})$/m.exec(body)[1], run.events.at(-1).hash);
  assert.equal(Number(/^Audit-Seq: (\d+)$/m.exec(body)[1]), run.events.length);
});

for (const removed of [1, 2]) {
  test(`removing the last ${removed} line${removed === 1 ? '' : 's'} of events.jsonl is detected against the head recorded in git even though the chain verifies`, async (t) => {
    const { ctx, run } = await gatedRun(t);
    const lines = await readEventLines(ctx, run);
    const kept = lines.slice(0, -removed);
    assert.equal(verifyChain(parseEvents(kept.join('\n'))).ok, true, 'a truncated log is still a valid chain');
    await writeEventLines(ctx, run, kept);

    const tampered = await ctx.engine.getRun(run.id);
    assert.equal(tampered.audit.chain.ok, false);
    assert.match(tampered.audit.chain.reason, /git/);
    assert.equal(tampered.integrity, false);
    assert.equal(tampered.needsHuman, true);
    await expectStatus(ctx.engine.act(run.id, { action: 'approve', expectedSeq: kept.length }), 409);
  });
}

test('a log truncated while AGE Aris was stopped is flagged against git when the engine restarts', async (t) => {
  const { ctx, run } = await gatedRun(t);
  const lines = await readEventLines(ctx, run);
  await writeEventLines(ctx, run, lines.slice(0, -1));

  const restarted = await new PipelineEngine({ workspace: ctx.workspace, registry: ctx.registry }).init();
  ctx.engines.push(restarted);
  const tampered = await restarted.getRun(run.id);
  assert.equal(tampered.audit.chain.ok, false);
  assert.match(tampered.audit.chain.reason, /git/);
  assert.equal(restarted.listRuns().find((entry) => entry.id === run.id).needsHuman, true);
});

test('a plan output modified after the gate opened is never sent to the next agent and the run is locked', async (t) => {
  const { ctx, run } = await gatedRun(t);
  const quiet = t.mock.method(console, 'error', () => {});
  await writeFile(path.join(ctx.runDir(run), 'attempts', '01-plan', 'output.md'), 'TAMPERED-PLAN-TEXT\n');

  await ctx.act(run.id, { action: 'approve' });
  await ctx.engine.settle();

  const locked = await ctx.engine.getRun(run.id);
  assert.equal(byType(locked, 'attempt_dispatched').length, 1, 'no attempt may be dispatched for the next stage');
  assert.deepEqual(locked.attempts.map((attempt) => attempt.stageId), ['plan']);
  assert.deepEqual(await readdir(path.join(ctx.runDir(run), 'attempts')), ['01-plan'], 'no prompt was built for the next stage');
  assert.equal(locked.currentStage.id, 'implement');
  assert.equal(locked.integrity, false);
  assert.equal(locked.audit.chain.ok, false);
  assert.match(locked.audit.chain.reason, /01-plan\/output\.md no longer matches its recorded hash/);
  assert.equal(locked.audit.artifacts.ok, false);
  assert.equal(locked.needsHuman, true);
  assert.equal(ctx.engine.processes.size, 0);
  assert.ok(quiet.mock.calls.some((call) => /was changed outside AGE Aris/.test(String(call.arguments[0]))), 'the refusal is logged');
  await expectStatus(ctx.engine.act(run.id, { action: 'comment', text: 'still locked' }), 409, /failed verification/);
});

test('a plan output modified after approval is never sent to a later stage that reuses it', async (t) => {
  const ctx = await setup(t, { agents: okAgents() });
  const stages = [stage('plan', 'plan', { gate: 'approve' }), stage('implement', 'implement', { gate: 'approve' }), stage('verify', 'verify')];
  const { task } = await ctx.newTask({ stages });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  await ctx.act(started.id, { action: 'approve' });
  await ctx.engine.settle();
  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.currentStage.id, 'implement');
  const quiet = t.mock.method(console, 'error', () => {});
  await writeFile(path.join(ctx.runDir(run), 'attempts', '01-plan', 'output.md'), 'TAMPERED-PLAN-TEXT\n');

  await ctx.act(run.id, { action: 'approve' });
  await ctx.engine.settle();

  const locked = await ctx.engine.getRun(run.id);
  assert.equal(locked.integrity, false);
  assert.deepEqual(locked.attempts.map((attempt) => attempt.stageId), ['plan', 'implement']);
  for (const attempt of locked.attempts) assert.doesNotMatch(attempt.prompt, /TAMPERED-PLAN-TEXT/);
  assert.ok(quiet.mock.calls.length >= 1);
});

test('modifying stderr.log after the fact is reported as an artifact mismatch with its path', async (t) => {
  const ctx = await setup(t, { agents: async ({ script }) => [commandAgent('broken', await script('broken', scriptExit1))] });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement', { maxAttempts: 1 })] });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.attempts[0].stderr, 'boom\n');
  assert.deepEqual(run.audit.artifacts, { ok: true, mismatches: [] });

  await writeFile(path.join(ctx.runDir(run), 'attempts', '01-implement', 'stderr.log'), 'nothing went wrong\n');
  const checked = await ctx.engine.getRun(run.id);
  assert.equal(checked.audit.chain.ok, true);
  assert.equal(checked.audit.artifacts.ok, false);
  assert.deepEqual(checked.audit.artifacts.mismatches, ['attempts/01-implement/stderr.log']);
});

test('the pull endpoints refuse a command attempt while it runs and the real result is recorded later', async (t) => {
  let gate;
  const ctx = await setup(t, {
    agents: async ({ script, root }) => {
      gate = path.join(root, 'release');
      return [commandAgent('cmd', await script('gated', scriptGated(gate, 'REAL-RESULT')))];
    },
  });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement', { maxAttempts: 1 })] });
  const started = await ctx.start(task);
  await until(async () => ctx.engine.processes.size === 1 && (await ctx.engine.getRun(started.id)).attempts[0]?.status === 'running', { message: 'the command agent to start' });
  const attemptId = `${started.id}:1`;

  await expectStatus(ctx.engine.complete(attemptId, { agentId: 'cmd', outcome: 'succeeded', output: 'FORGED-RESULT' }), 409, /Only pull-runner attempts/);
  await expectStatus(ctx.engine.complete(attemptId, { agentId: 'cmd', outcome: 'failed', error: 'forged failure' }), 409);
  await expectStatus(ctx.engine.heartbeat(attemptId, { agentId: 'cmd' }), 409, /Only pull-runner attempts/);
  const during = await ctx.engine.getRun(started.id);
  assert.equal(during.attempts[0].status, 'running');
  assert.equal(byType(during, 'attempt_finished').length, 0);
  assert.equal(byType(during, 'lease_renewed').length, 0);

  await writeFile(gate, 'go');
  await ctx.engine.settle();
  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.status, 'completed');
  assert.equal(run.attempts[0].status, 'succeeded');
  assert.equal(run.attempts[0].output, 'REAL-RESULT\n');
  assert.equal(run.attempts[0].finishedBy, 'cmd');
  assert.equal(byType(run, 'attempt_finished').length, 1);
});

test('two concurrent starts on the same task give exactly one run and one 409, and listing runs never throws meanwhile', async (t) => {
  const ctx = await setup(t, { agents: async () => [] });
  const { task } = await ctx.newTask({ stages: HUMAN_STAGE });
  const errors = [];
  let racing = true;
  const poller = (async () => {
    while (racing) {
      try { ctx.engine.listRuns(); } catch (error) { errors.push(error); }
      await new Promise((resolve) => setImmediate(resolve));
    }
  })();

  const results = await Promise.allSettled([ctx.start(task), ctx.start(task)]);
  racing = false;
  await poller;

  assert.deepEqual(errors, [], 'listRuns must tolerate a run that is still being created');
  assert.deepEqual(results.map((result) => result.status).sort(), ['fulfilled', 'rejected']);
  const rejected = results.find((result) => result.status === 'rejected').reason;
  assert.ok(rejected instanceof WorkspaceError);
  assert.equal(rejected.status, 409);
  assert.match(rejected.message, /already has an active run/);
  await ctx.engine.settle();
  assert.equal(ctx.engine.listRuns().length, 1);
  const runsDir = path.join(ctx.projectDir(task.projectId), 'pipeline', 'runs');
  assert.deepEqual(await readdir(runsDir), ['R001']);
});

test('two concurrent pipeline saves with the same version give exactly one success and one 409', async (t) => {
  const { ctx, project } = await pipelineContext(t);
  const results = await Promise.allSettled([
    ctx.engine.savePipeline(project.id, { version: 'default', stages: [stage('alpha', 'plan')] }),
    ctx.engine.savePipeline(project.id, { version: 'default', stages: [stage('beta', 'implement')] }),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), ['fulfilled', 'rejected']);
  const winner = results.find((result) => result.status === 'fulfilled').value;
  const loser = results.find((result) => result.status === 'rejected').reason;
  assert.ok(loser instanceof WorkspaceError);
  assert.equal(loser.status, 409);

  const stored = await ctx.engine.getPipeline(project.id);
  assert.equal(stored.version, winner.version);
  assert.deepEqual(stored.stages.map((entry) => entry.id), winner.stages.map((entry) => entry.id));
  const subjects = (await git(ctx.projectDir(project.id), 'log', '--format=%s')).split('\n').filter((subject) => subject.startsWith('Update pipeline'));
  assert.equal(subjects.length, 1);
});

test('an edit and an approval sent with the same expectedSeq give exactly one success and one 409', async (t) => {
  const { ctx, run } = await gatedRun(t);
  const results = await Promise.allSettled([
    ctx.engine.act(run.id, { action: 'edit', output: 'EDITED-AT-THE-SAME-TIME', expectedSeq: run.lastSeq }),
    ctx.engine.act(run.id, { action: 'approve', expectedSeq: run.lastSeq }),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), ['fulfilled', 'rejected']);
  const loser = results.find((result) => result.status === 'rejected').reason;
  assert.ok(loser instanceof WorkspaceError);
  assert.equal(loser.status, 409);
  assert.match(loser.message, /has changed/);

  await ctx.engine.settle();
  const after = await ctx.engine.getRun(run.id);
  assert.equal(byType(after, 'output_edited').length + byType(after, 'approved').length, 1, 'only one of the two decisions was recorded');
  assert.equal(after.audit.chain.ok, true);
});

test('retrying from an earlier stage resets every failure count so the review gets all of its attempts again', async (t) => {
  const ctx = await setup(t, { agents: async ({ script }) => [commandAgent('strict', await script('strict', scriptFailVerdict))] });
  const { task } = await ctx.newTask({ stages: IMPLEMENT_THEN_REVIEW });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  const failed = await ctx.engine.getRun(started.id);
  assert.equal(failed.status, 'failed');
  const reviewsBefore = failed.attempts.filter((attempt) => attempt.stageId === 'review').length;
  assert.equal(reviewsBefore, 2);

  await ctx.act(started.id, { action: 'retry', stageId: 'implement' });
  await ctx.engine.settle();
  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.status, 'failed', 'the agent still reports FAIL, so the run fails again');
  const after = run.attempts.slice(failed.attempts.length);
  assert.equal(after.filter((attempt) => attempt.stageId === 'review').length, 2, 'the review must get its full maxAttempts after a retry');
  assert.deepEqual(after.map((attempt) => attempt.stageId), ['implement', 'review', 'implement', 'review']);
  assert.equal(byType(run, 'run_failed').length, 2);
  assert.equal(run.audit.chain.ok, true);
});

test('cancelling a failed run closes it and takes it out of the decisions', async (t) => {
  const ctx = await setup(t, { agents: async ({ script }) => [commandAgent('broken', await script('broken', scriptExit1))] });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement', { maxAttempts: 1 })] });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  const failed = await ctx.engine.getRun(started.id);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.needsHuman, true);

  const cancelled = await ctx.act(started.id, { action: 'cancel', reason: 'Giving up' });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.needsHuman, false);
  assert.equal(ctx.engine.listRuns().find((entry) => entry.id === started.id).needsHuman, false);
  assert.equal(byType(cancelled, 'cancelled').length, 1);
  await expectStatus(ctx.act(started.id, { action: 'cancel' }), 409, /Run is cancelled/);
});

test('a failed run stops needing a person once a newer run exists for the same task', async (t) => {
  const ctx = await setup(t, { agents: async ({ script }) => [commandAgent('broken', await script('broken', scriptExit1))] });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement', { maxAttempts: 1 })] });
  const first = await ctx.start(task);
  await ctx.engine.settle();
  const needs = (id) => ctx.engine.listRuns().find((entry) => entry.id === id).needsHuman;
  assert.equal(needs(first.id), true);

  const second = await ctx.start(task);
  assert.equal(second.localId, 'R002');
  assert.equal(needs(first.id), false, 'the older failure is superseded');
  await ctx.engine.settle();
  assert.equal((await ctx.engine.getRun(second.id)).status, 'failed');
  assert.equal(needs(second.id), true, 'the newest failure still needs a person');
  assert.equal(needs(first.id), false);
});

test('acting arguments are added only in the roles an agent may act in and the exact argv is recorded', async (t) => {
  let file;
  const ctx = await setup(t, {
    agents: async ({ script }) => {
      file = await script('argv', scriptArgv);
      return [commandAgent('actor', file, { actArgs: ['--act'], actRoles: ['implement'] })];
    },
  });
  const { task } = await ctx.newTask({ stages: [stage('plan', 'plan'), stage('implement', 'implement')] });
  const started = await ctx.start(task);
  await ctx.engine.settle();

  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.status, 'completed');
  const [plan, implement] = run.attempts;
  assert.equal(plan.output, 'ARGV:[]\n');
  assert.equal(implement.output, 'ARGV:["--act"]\n');
  const dispatched = byType(run, 'attempt_dispatched');
  assert.deepEqual(dispatched[0].data.command, [process.execPath, file]);
  assert.deepEqual(dispatched[1].data.command, [process.execPath, file, '--act']);
  assert.deepEqual(implement.command, [process.execPath, file, '--act']);
});

test('the registry rejects acting roles outside the agent roles and acting arguments that are not strings', async (t) => {
  const { registry } = await registryContext(t);
  await expectStatus(registry.create(validAgent({ roles: ['implement'], actRoles: ['plan'] })), 400, /actRoles must be a subset of roles/);
  await expectStatus(registry.create(validAgent({ actRoles: 'implement' })), 400, /actRoles/);
  await expectStatus(registry.create(validAgent({ actArgs: [1] })), 400, /actArgs must be an array/);
  await expectStatus(registry.create(validAgent({ actArgs: ['--ok', ''] })), 400, /actArgs/);
  await expectStatus(registry.create(validAgent({ actArgs: '--act' })), 400, /actArgs must be an array/);
  assert.deepEqual((await registry.list()).map((agent) => agent.id), ['seeded']);

  const created = await registry.create(validAgent({ roles: ['implement', 'review'], actRoles: ['implement'], actArgs: ['--act'] }));
  assert.deepEqual(created.actRoles, ['implement']);
  assert.deepEqual(created.actArgs, ['--act']);
  await expectStatus(registry.update('new-agent', { version: created.version, roles: ['review'] }), 400, /actRoles must be a subset of roles/);
  await expectStatus(registry.update('new-agent', { version: created.version, actArgs: [{}] }), 400, /actArgs/);
  assert.deepEqual((await registry.get('new-agent')).roles, ['implement', 'review']);
});

test('a timed-out agent whose background child holds its output is stopped promptly and the child is killed', async (t) => {
  let pidFile;
  const ctx = await setup(t, {
    agents: async ({ script, root }) => {
      pidFile = path.join(root, 'child.pid');
      return [commandAgent('holder', await script('holder', scriptGrandchild(pidFile, { exits: false })), { timeoutSec: 5 })];
    },
  });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement', { maxAttempts: 1 })] });
  const started = await ctx.start(task);
  const pid = Number(await until(() => readFile(pidFile, 'utf8').catch(() => ''), { message: 'the grandchild pid' }));
  t.after(() => { try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } });
  const before = Date.now();
  await ctx.engine.settle();
  const elapsed = Date.now() - before;

  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.attempts[0].status, 'failed');
  assert.match(run.attempts[0].stderr, /Timed out after 5s/);
  assert.ok(elapsed < 10000, `the attempt must not hang on the child's open pipe; it took ${elapsed}ms`);
  await until(() => !isAlive(pid), { timeout: 5000, message: 'the grandchild to be stopped' });
});

test('an agent that exits and leaves a background child holding its output finishes promptly and the child is killed', async (t) => {
  let pidFile;
  const ctx = await setup(t, {
    agents: async ({ script, root }) => {
      pidFile = path.join(root, 'child.pid');
      return [commandAgent('leaver', await script('leaver', scriptGrandchild(pidFile, { exits: true })), { timeoutSec: 5 })];
    },
  });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement', { maxAttempts: 1 })] });
  const started = await ctx.start(task);
  const pid = Number(await until(() => readFile(pidFile, 'utf8').catch(() => ''), { message: 'the grandchild pid' }));
  t.after(() => { try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } });
  const before = Date.now();
  await ctx.engine.settle();
  const elapsed = Date.now() - before;

  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.attempts[0].status, 'succeeded');
  assert.match(run.attempts[0].output, /parent-done/);
  assert.ok(elapsed < 10000, `the attempt must not wait for the child; it took ${elapsed}ms`);
  await until(() => !isAlive(pid), { timeout: 5000, message: 'the grandchild to be stopped' });
});

test('cancelling a run stops the whole process group of its running agent', async (t) => {
  let pidFile;
  const ctx = await setup(t, {
    agents: async ({ script, root }) => {
      pidFile = path.join(root, 'child.pid');
      return [commandAgent('holder', await script('holder', scriptGrandchild(pidFile, { exits: false })))];
    },
  });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement', { maxAttempts: 1 })] });
  const started = await ctx.start(task);
  const pid = Number(await until(() => readFile(pidFile, 'utf8').catch(() => ''), { message: 'the grandchild pid' }));
  t.after(() => { try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } });
  assert.equal(isAlive(pid), true);

  await ctx.act(started.id, { action: 'cancel' });
  await until(() => !isAlive(pid), { timeout: 6000, message: 'the grandchild to be stopped' });
  await ctx.engine.settle();
  assert.equal((await ctx.engine.getRun(started.id)).status, 'cancelled');
  assert.equal(ctx.engine.processes.size, 0);
});

test('a result that cannot be committed is kept and recorded with the agent\'s real output once git works again', async (t) => {
  let gate;
  const ctx = await setup(t, {
    agents: async ({ script, root }) => {
      gate = path.join(root, 'release');
      return [commandAgent('late', await script('late', scriptGated(gate, 'REAL-OUTPUT')))];
    },
  });
  const quiet = t.mock.method(console, 'error', () => {});
  const { project, task } = await ctx.newTask({ stages: [stage('implement', 'implement', { maxAttempts: 1 })] });
  const started = await ctx.start(task);
  await until(async () => ctx.engine.processes.size === 1 && (await ctx.engine.getRun(started.id)).attempts[0]?.status === 'running', { message: 'the agent to start' });

  const lock = path.join(ctx.projectDir(project.id), '.git', 'index.lock');
  await writeFile(lock, '');
  await writeFile(gate, 'go');
  await until(() => ctx.engine.unrecorded.size === 1 && ctx.engine.processes.size === 0, { message: 'the result to be held for a retry' });
  await ctx.engine.tick();
  let run = await ctx.engine.getRun(started.id);
  assert.equal(run.attempts[0].status, 'running', 'while git is blocked the result is not recorded');
  assert.equal(byType(run, 'attempt_finished').length, 0);
  assert.equal(run.audit.chain.ok, true, 'the failed commit must leave the log as it was');
  assert.ok(quiet.mock.calls.length >= 1, 'the failure is logged');

  await rm(lock);
  await until(async () => {
    await ctx.engine.tick();
    return (await ctx.engine.getRun(started.id)).attempts[0].status === 'succeeded';
  }, { message: 'the held result to be recorded' });
  run = await ctx.engine.getRun(started.id);
  assert.equal(run.attempts[0].output, 'REAL-OUTPUT\n');
  assert.doesNotMatch(run.attempts[0].error, /Interrupted/);
  assert.equal(run.attempts[0].finishedBy, 'late');
  assert.equal(run.status, 'completed');
  assert.equal(ctx.engine.unrecorded.size, 0);
  assert.equal(byType(run, 'attempt_finished').length, 1);
  assert.equal(run.audit.chain.ok, true);
  assert.equal(run.audit.artifacts.ok, true);
});

test('with the engine running, twenty quick agent runs are never recorded as interrupted', async (t) => {
  const ctx = await setup(t, { agents: okAgents('quick', { maxConcurrent: 4 }), engineOptions: { tickMs: 5 } });
  const { project, task: first } = await ctx.newTask({ stages: [stage('implement', 'implement', { maxAttempts: 1 })], wipLimit: 20 });
  const tasks = [first];
  for (let n = 2; n <= 20; n += 1) tasks.push(await ctx.addTask(project, `Quick task ${n}`));
  ctx.engine.start();

  const runs = await Promise.all(tasks.map((task) => ctx.start(task)));
  await until(() => ctx.engine.listRuns().every((entry) => entry.status === 'completed'), { timeout: 60000, interval: 50, message: 'all twenty runs to complete' });

  for (const started of runs) {
    const run = await ctx.engine.getRun(started.id);
    assert.equal(run.attempts.length, 1, `${started.id} must have exactly one attempt`);
    assert.equal(run.attempts[0].status, 'succeeded', `${started.id}: ${run.attempts[0].error}`);
    assert.equal(run.attempts[0].finishedBy, 'ok');
    assert.match(run.attempts[0].output, /^OUT-quick-implement/);
    assert.doesNotMatch(run.attempts[0].error || '', /Interrupted/);
    assert.equal(byType(run, 'attempt_finished').length, 1);
    assert.equal(run.audit.chain.ok, true);
  }
});

test('a waiting run is not routed again on every tick and dispatches once an agent is enabled', async (t) => {
  const ctx = await setup(t, { agents: disabledAgent });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement')] });
  const advance = t.mock.method(ctx.engine, '_advance');
  const started = await ctx.start(task);
  await ctx.engine.settle();
  assert.equal((await ctx.engine.getRun(started.id)).status, 'waiting');
  const routedWhileSettling = advance.mock.callCount();
  assert.ok(routedWhileSettling >= 1);

  for (let tick = 0; tick < 30; tick += 1) await ctx.engine.tick();
  assert.equal(advance.mock.callCount(), routedWhileSettling, 'a waiting run is not routed again while the registry is unchanged');
  assert.equal(byType(await ctx.engine.getRun(started.id), 'waiting').length, 1);

  const agent = await ctx.registry.get('ok');
  await ctx.registry.update('ok', { version: agent.version, enabled: true });
  await ctx.engine.settle();
  assert.ok(advance.mock.callCount() > routedWhileSettling, 'a registry change makes the waiting run routable again');
  const run = await ctx.engine.getRun(started.id);
  assert.equal(run.status, 'completed');
  assert.equal(run.attempts[0].agentId, 'ok');
  assert.equal(byType(run, 'waiting').length, 1);
});

// --- S1: blocked reason, Run trailer, clock, needsHumanAt, eventsByProject --------

test('a failed run leaves the task blocked with the run named as the reason, in commits with a Run trailer', async (t) => {
  const ctx = await setup(t, { agents: async ({ script }) => [commandAgent('broken', await script('broken', scriptExit1))] });
  const { project, task } = await ctx.newTask({ stages: [stage('implement', 'implement', { maxAttempts: 1 })] });
  const started = await ctx.start(task);
  await ctx.engine.settle();
  assert.equal((await ctx.engine.getRun(started.id)).status, 'failed');

  let stored = await ctx.workspace.getTask(task.id);
  assert.equal(stored.status, 'blocked');
  assert.match(stored.blockedReason, /^Run R001 failed: Implement failed 1 time \(limit 1\): Agent exited with code 1$/);
  const projectDir = ctx.projectDir(project.id);
  const taskCommits = (await git(projectDir, 'log', '--format=%B%x00', '--', 'AA/tasks', 'AA/backlog')).split('\0').map((body) => body.trim()).filter(Boolean);
  assert.equal(taskCommits.length, 3, 'blocked, claimed by the run, created');
  for (const body of taskCommits.slice(0, 2)) {
    assert.match(body, /\n\nRun: R001$/);
    assert.doesNotMatch(body, /AGESight-Via/);
  }
  assert.doesNotMatch(taskCommits[2], /Run:/, 'the task was created outside the run');

  await ctx.act(started.id, { action: 'retry' });
  stored = await ctx.workspace.getTask(task.id);
  assert.equal(stored.status, 'in_progress');
  assert.equal(stored.blockedReason, '', 'leaving blocked clears the reason');
  assert.match(await git(projectDir, 'log', '-1', '--format=%B', '--', 'AA/tasks'), /\n\nRun: R001$/);
});

// The needsHuman rule before needsHumanAt existed, kept here to prove the
// rewrite changes nothing when asOf is the engine's clock.
function rev0NeedsHuman(engine, run, now) {
  const { state } = run;
  const superseded = [...engine.runs.values()].some((other) => other.state.taskId === state.taskId && other.state.startedAt > state.startedAt);
  const unclaimed = state.attempts.some((attempt) => attempt.status === 'queued' && now - Date.parse(attempt.dispatchedAt) > engine.leaseMs);
  return !run.integrity.ok
    || ['awaiting_approval', 'awaiting_input', 'waiting'].includes(state.status)
    || (state.status === 'failed' && !superseded)
    || unclaimed;
}

// One engine holding a run in every state a decision can come from.
async function decisionFixtures(t) {
  const clock = { now: Date.now() };
  const ctx = await setup(t, {
    agents: async ({ script }) => [
      pullAgent('puller'),
      commandAgent('ok', await script('ok', scriptOk('ok'))),
      commandAgent('broken', await script('broken', scriptExit1)),
    ],
    engineOptions: { leaseMs: 60000, clock: () => clock.now },
  });
  const projectWith = async (stages) => {
    const project = await ctx.workspace.createProject({ name: 'Decisions', wipLimit: 20 });
    await ctx.engine.savePipeline(project.id, { stages, version: 'default' });
    return project;
  };
  const runOn = async (project, title) => ctx.start(await ctx.addTask(project, title));
  const pull = await projectWith([stage('implement', 'implement', { pinnedAgent: 'puller' })]);
  const gate = await projectWith([stage('plan', 'plan', { gate: 'approve', pinnedAgent: 'ok' }), stage('implement', 'implement', { pinnedAgent: 'ok' })]);
  const human = await projectWith(HUMAN_STAGE);
  const nobody = await projectWith([stage('implement', 'implement', { pinnedAgent: 'nobody' })]);
  const broken = await projectWith([stage('implement', 'implement', { pinnedAgent: 'broken', maxAttempts: 1 })]);

  const runs = {
    claimed: await runOn(pull, 'Claimed by a pull agent'),
    queued: await runOn(pull, 'Queued for a pull agent'),
    gate: await runOn(gate, 'Waiting at a gate'),
    approved: await runOn(gate, 'Approved and completed'),
    cancelled: await runOn(gate, 'Cancelled'),
    input: await runOn(human, 'Waiting for a person'),
    waiting: await runOn(nobody, 'No agent can take it'),
    failed: await runOn(broken, 'Failed once'),
  };
  await ctx.engine.settle();
  const supersededTask = await ctx.addTask(broken, 'Failed twice');
  runs.superseded = await ctx.start(supersededTask);
  await ctx.engine.settle();
  runs.newest = await ctx.start(supersededTask);
  await ctx.engine.settle();
  assert.equal((await ctx.engine.claim('puller')).runId, runs.claimed.id, 'the oldest queued attempt is claimed; the other stays queued');
  await ctx.act(runs.approved.id, { action: 'approve' });
  await ctx.act(runs.cancelled.id, { action: 'cancel' });
  await ctx.engine.settle();
  runs.tampered = await runOn(gate, 'Tampered log');
  await ctx.engine.settle();
  const file = path.join(ctx.runDir(runs.tampered), 'events.jsonl');
  const lines = (await readFile(file, 'utf8')).split('\n').filter(Boolean);
  const edited = JSON.parse(lines[1]);
  edited.data.agentId = 'someone-else';
  lines[1] = JSON.stringify(edited);
  await writeFile(file, `${lines.join('\n')}\n`);
  await ctx.engine.getRun(runs.tampered.id);

  const status = async (key) => (await ctx.engine.getRun(runs[key].id)).status;
  assert.deepEqual(
    Object.fromEntries(await Promise.all(Object.keys(runs).map(async (key) => [key, await status(key)]))),
    {
      queued: 'running', claimed: 'running', gate: 'awaiting_approval', approved: 'completed', cancelled: 'cancelled',
      input: 'awaiting_input', waiting: 'waiting', failed: 'failed', superseded: 'failed', newest: 'failed', tampered: 'awaiting_approval',
    },
  );
  assert.equal(ctx.engine.runs.get(runs.queued.id).state.attempts[0].status, 'queued');
  assert.equal(ctx.engine.runs.get(runs.claimed.id).state.attempts[0].status, 'running');
  assert.equal(ctx.engine.runs.get(runs.tampered.id).integrity.ok, false);
  return { ctx, clock, runs };
}

test('needsHuman equals the rev-0 rule for every kind of run at several clock values', async (t) => {
  const { ctx, clock, runs } = await decisionFixtures(t);
  const base = Date.now();
  const flips = new Map();
  for (const now of [base, base + 30000, base + 61000, base + 3600000, base + 7 * 86400000]) {
    clock.now = now;
    const listed = new Map(ctx.engine.listRuns().map((summary) => [summary.id, summary.needsHuman]));
    for (const run of ctx.engine.runs.values()) {
      const expected = rev0NeedsHuman(ctx.engine, run, now);
      assert.equal(ctx.engine._summary(run).needsHuman, expected, `${run.localId} (${run.state.taskTitle}) at +${now - base} ms`);
      assert.equal(listed.get(run.id), expected);
      flips.set(run.id, [...(flips.get(run.id) || []), expected]);
    }
  }
  assert.deepEqual(flips.get(runs.queued.id), [false, false, true, true, true], 'unclaimed work becomes a decision after the lease');
  for (const key of ['gate', 'input', 'waiting', 'failed', 'newest', 'tampered']) assert.ok(flips.get(runs[key].id).every(Boolean), key);
  for (const key of ['claimed', 'approved', 'cancelled', 'superseded']) assert.ok(!flips.get(runs[key].id).some(Boolean), key);
});

test('eventsByProject hands out deep-frozen copies, so a consumer cannot change audit state', async (t) => {
  const { ctx, runs } = await decisionFixtures(t);
  const run = ctx.engine.runs.get(runs.gate.id);
  const find = () => [...ctx.engine.eventsByProject().values()].flat().find((candidate) => candidate.id === run.id);
  const entry = find();
  assert.deepEqual(entry.events, run.events);
  const started = entry.events.find((event) => event.type === 'run_started');
  assert.notEqual(started, run.events.find((event) => event.type === 'run_started'), 'a copy, not the engine\'s own event');
  assert.ok(Object.isFrozen(started) && Object.isFrozen(started.data) && Object.isFrozen(started.actor));
  assert.ok(Object.isFrozen(started.data.pipeline) && Object.isFrozen(started.data.pipeline[0]));
  assert.throws(() => { started.data.taskTitle = 'Changed'; }, TypeError);
  assert.throws(() => { started.data.pipeline[0].name = 'Changed'; }, TypeError);
  assert.equal(find().events[0], entry.events[0], 'copies are made once per event');
  assert.equal(ctx.engine._summary(run).needsHuman, true, 'the engine is unaffected');
});

test('needsHumanAt says why a run waits and since when, from read-only events by project', async (t) => {
  const { ctx, runs } = await decisionFixtures(t);
  const byProject = ctx.engine.eventsByProject();
  const entries = [...byProject.values()].flat();
  assert.equal(entries.length, ctx.engine.runs.size);
  assert.ok(Object.isFrozen([...byProject.values()][0]));
  const entry = (key) => entries.find((candidate) => candidate.id === runs[key].id);
  assert.ok(Object.isFrozen(entry('gate').events));
  assert.throws(() => entry('gate').events.push({}), TypeError);
  assert.equal(entry('gate').events.length, ctx.engine.runs.get(runs.gate.id).events.length);
  const states = entries.map((candidate) => reduce(candidate.events));
  const at = (key, asOf = Date.now()) => {
    const { events, integrity } = entry(key);
    return needsHumanAt({ state: reduce(events), integrity, events, otherRuns: states, asOf: new Date(asOf), leaseMs: 60000 });
  };
  const eventAt = (key, type) => entry(key).events.filter((event) => event.type === type).at(-1).at;

  assert.deepEqual(at('gate'), { needsHuman: true, reason: 'gate', waitStart: eventAt('gate', 'gate_opened') });
  assert.deepEqual(at('input'), { needsHuman: true, reason: 'input', waitStart: eventAt('input', 'attempt_dispatched') });
  assert.deepEqual(at('waiting'), { needsHuman: true, reason: 'waiting', waitStart: eventAt('waiting', 'waiting') });
  assert.deepEqual(at('failed'), { needsHuman: true, reason: 'failed', waitStart: eventAt('failed', 'run_failed') });
  assert.deepEqual(at('tampered'), { needsHuman: true, reason: 'integrity', waitStart: entry('tampered').events[1].at });
  assert.equal(entry('tampered').integrity.brokenAt, 2);
  const dispatched = eventAt('queued', 'attempt_dispatched');
  assert.deepEqual(at('queued', Date.parse(dispatched) + 60000), { needsHuman: false, reason: '', waitStart: '' });
  assert.deepEqual(at('queued', Date.parse(dispatched) + 60001), { needsHuman: true, reason: 'unclaimed', waitStart: dispatched });
  assert.equal(at('approved').needsHuman, false);

  // The engine keeps working on its own arrays after handing out copies.
  const before = entry('gate').events.length;
  await ctx.act(runs.gate.id, { action: 'approve' });
  assert.ok(ctx.engine.runs.get(runs.gate.id).events.length > before);
  assert.equal(entry('gate').events.length, before, 'a copy handed out earlier does not change');
});

test('a run superseded later still needs a person at an earlier asOf', async (t) => {
  const clock = { now: Date.now() };
  const ctx = await setup(t, {
    agents: async ({ script }) => [commandAgent('broken', await script('broken', scriptExit1))],
    engineOptions: { clock: () => clock.now },
  });
  const { task } = await ctx.newTask({ stages: [stage('implement', 'implement', { maxAttempts: 1 })] });
  const first = await ctx.start(task);
  await ctx.engine.settle();
  const second = await ctx.start(task);
  const secondStart = Date.parse(ctx.engine.runs.get(second.id).state.startedAt);
  const firstFailed = Date.parse(ctx.engine.runs.get(first.id).events.at(-1).at);
  assert.ok(firstFailed <= secondStart);

  const needs = () => ctx.engine.listRuns().find((entry) => entry.id === first.id).needsHuman;
  clock.now = secondStart - 1;
  assert.equal(needs(), true, 'before the newer run started, the failure still needed a person');
  clock.now = secondStart;
  assert.equal(needs(), false, 'from the moment the newer run started, it is superseded');

  const run = ctx.engine.runs.get(first.id);
  const otherRuns = [...ctx.engine.runs.values()].map((other) => other.state);
  const asOf = (ms) => needsHumanAt({ state: run.state, integrity: run.integrity, events: run.events, otherRuns, asOf: new Date(ms), leaseMs: ctx.engine.leaseMs }).needsHuman;
  assert.equal(asOf(firstFailed), true);
  assert.equal(asOf(secondStart - 1), true);
  assert.equal(asOf(secondStart), false);
});

test('a clock injected into createServer decides when unclaimed work starts waiting for a person', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agesight-clock-'));
  const clock = { now: Date.now() };
  const server = await createServer({
    dataDir: path.join(root, 'data'),
    clock: () => clock.now,
    engineOptions: { leaseMs: 60000 },
    registryOptions: { seed: () => [pullAgent('puller')] },
  });
  t.after(async () => {
    if (server.listening) {
      server.close();
      await once(server, 'close');
    } else {
      await server.engine.stop();
    }
    await rm(root, { recursive: true, force: true, maxRetries: 5 });
  });
  const project = await server.workspace.createProject({ name: 'Clock' });
  await server.engine.savePipeline(project.id, { stages: PULL_STAGE, version: 'default' });
  const task = await server.workspace.createTask({ projectId: project.id, title: 'Unclaimed' });
  const started = await server.engine.startRun({ taskId: task.id });
  await server.engine.settle();
  const dispatchedAt = Date.parse(server.engine.runs.get(started.id).state.attempts[0].dispatchedAt);

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const runs = async () => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/runs`, { headers: { 'x-agesight-token': server.apiToken } });
    assert.equal(response.status, 200);
    return (await response.json()).find((run) => run.id === started.id);
  };
  clock.now = dispatchedAt + 60000 - 1;
  assert.equal((await runs()).needsHuman, false, 'within the lease the work is not waiting');
  clock.now = dispatchedAt + 60000 + 1;
  assert.equal((await runs()).needsHuman, true, 'after the lease it waits for a person');
  assert.equal(server.engine.clock(), clock.now);
});
