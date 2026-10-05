import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { delimiter, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIERS } from './router.mjs';
import { assertNotSymlink, cleanLine, fail, git, hash } from './workspace.mjs';

export const ROLES = ['triage', 'plan', 'implement', 'review', 'verify'];
const RUNNERS = new Set(['command', 'pull']);
const AGENT_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const REHEARSAL = fileURLToPath(new URL('../agents/rehearsal-agent.mjs', import.meta.url));

function onPath(binary) {
  return (process.env.PATH || '').split(delimiter).some((dir) => {
    if (!dir) return false;
    try { accessSync(join(dir, binary), constants.X_OK); return true; } catch { return false; }
  });
}

function defaultAgents() {
  const claude = onPath('claude');
  const agents = [{
    id: 'rehearsal',
    name: 'Rehearsal agent',
    description: 'Offline stand-in that answers every stage instantly. Use it to try the pipeline without spending model tokens.',
    runner: 'command',
    command: [process.execPath, REHEARSAL],
    actArgs: [],
    actRoles: [],
    cwd: '',
    roles: [...ROLES],
    tier: 'haiku',
    enabled: !claude,
    maxConcurrent: 4,
    timeoutSec: 60,
  }];
  if (claude) {
    for (const tier of TIERS) {
      agents.push({
        id: `claude-${tier}`,
        name: `Claude ${tier[0].toUpperCase()}${tier.slice(1)}`,
        description: `Claude Code in print mode on the ${tier} model. Text only, except in the roles listed under acting roles, where it runs any command your account can run without asking.`,
        runner: 'command',
        command: ['claude', '-p', '--model', tier],
        actArgs: ['--dangerously-skip-permissions'],
        actRoles: ['implement'],
        cwd: '',
        roles: [...ROLES],
        tier,
        enabled: true,
        maxConcurrent: tier === 'opus' ? 1 : 2,
        timeoutSec: 900,
      });
    }
  }
  return agents;
}

function cleanAgent(input, current = {}) {
  const pick = (key) => (key in input ? input[key] : current[key]);
  const agent = {
    id: current.id ?? cleanLine(input.id, 'id', { required: true, max: 40 }),
    name: cleanLine(pick('name'), 'name', { required: true, max: 80 }),
    description: cleanLine(pick('description') ?? '', 'description', { max: 300 }),
    runner: pick('runner') ?? 'command',
    command: pick('command') ?? [],
    cwd: cleanLine(pick('cwd') ?? '', 'cwd', { max: 500 }),
    roles: pick('roles') ?? [...ROLES],
    tier: pick('tier') ?? 'sonnet',
    enabled: pick('enabled') ?? true,
    actArgs: pick('actArgs') ?? [],
    actRoles: pick('actRoles') ?? [],
    maxConcurrent: pick('maxConcurrent') ?? 1,
    timeoutSec: pick('timeoutSec') ?? 900,
  };
  if (!AGENT_ID.test(agent.id)) fail(400, 'id must be lowercase letters, digits, and hyphens');
  if (!RUNNERS.has(agent.runner)) fail(400, 'runner must be command or pull');
  for (const field of ['command', 'actArgs']) {
    const value = agent[field];
    if (!Array.isArray(value) || value.length > 32 || value.some((part) => typeof part !== 'string' || !part || part.length > 500 || part.includes('\0'))) {
      fail(400, `${field} must be an array of up to 32 non-empty strings`);
    }
  }
  if (agent.runner === 'command' && !agent.command.length) fail(400, 'command agents need a command');
  if (agent.cwd && !isAbsolute(agent.cwd)) fail(400, 'cwd must be an absolute path');
  if (!Array.isArray(agent.roles) || !agent.roles.length || agent.roles.some((role) => !ROLES.includes(role))) {
    fail(400, `roles must list one or more of: ${ROLES.join(', ')}`);
  }
  agent.roles = ROLES.filter((role) => agent.roles.includes(role));
  if (!Array.isArray(agent.actRoles) || agent.actRoles.some((role) => !agent.roles.includes(role))) fail(400, 'actRoles must be a subset of roles');
  agent.actRoles = ROLES.filter((role) => agent.actRoles.includes(role));
  if (!TIERS.includes(agent.tier)) fail(400, `tier must be one of: ${TIERS.join(', ')}`);
  if (typeof agent.enabled !== 'boolean') fail(400, 'enabled must be true or false');
  if (!Number.isInteger(agent.maxConcurrent) || agent.maxConcurrent < 1 || agent.maxConcurrent > 16) fail(400, 'maxConcurrent must be an integer from 1 to 16');
  if (!Number.isInteger(agent.timeoutSec) || agent.timeoutSec < 5 || agent.timeoutSec > 86400) fail(400, 'timeoutSec must be an integer from 5 to 86400');
  return agent;
}

// Agents live in <dataDir>/registry/agents.json, a git repository of its own so
// every change to who can run work is attributable and reversible.
export class AgentRegistry {
  constructor({ dataDir, operator, email, seed = defaultAgents }) {
    this.seed = seed;
    this.dir = join(dataDir, 'registry');
    this.file = join(this.dir, 'agents.json');
    this.operator = operator;
    this.email = email;
    this._queue = Promise.resolve();
  }

  async init() {
    await assertNotSymlink(this.dir, true);
    await mkdir(this.dir, { recursive: true });
    if (spawnSync('git', ['-C', this.dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim() !== this.dir) {
      git(this.dir, ['init', '--quiet']);
      git(this.dir, ['config', 'user.name', this.operator]);
      git(this.dir, ['config', 'user.email', this.email]);
    }
    try { await readFile(this.file); } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      await this._write(this.seed().map((agent) => cleanAgent(agent)), 'Seed agent registry');
    }
    return this;
  }

  _serialize(operation) {
    const next = this._queue.then(operation, operation);
    this._queue = next.catch(() => {});
    return next;
  }

  async _read() {
    await assertNotSymlink(this.file);
    const raw = await readFile(this.file, 'utf8');
    let agents;
    try { agents = JSON.parse(raw); } catch { fail(500, 'Agent registry is invalid JSON'); }
    if (!Array.isArray(agents)) fail(500, 'Agent registry must be a list');
    return agents;
  }

  async _write(agents, message) {
    await writeFile(this.file, `${JSON.stringify(agents, null, 2)}\n`);
    git(this.dir, ['add', '--', 'agents.json']);
    git(this.dir, ['commit', '--quiet', '-m', message, '--', 'agents.json']);
  }

  async list() {
    return (await this._read()).map((agent) => ({ ...agent, version: hash(JSON.stringify(agent)) }));
  }

  async get(id) {
    const agent = (await this.list()).find((entry) => entry.id === id);
    if (!agent) fail(404, 'Agent not found');
    return agent;
  }

  create(input = {}) {
    return this._serialize(async () => {
      const agents = await this._read();
      const agent = cleanAgent(input);
      if (agents.some((entry) => entry.id === agent.id)) fail(409, `Agent ${agent.id} already exists`);
      await this._write([...agents, agent], `Add agent ${agent.id}: ${agent.name}`);
      return { ...agent, version: hash(JSON.stringify(agent)) };
    });
  }

  update(id, input = {}) {
    return this._serialize(async () => {
      const agents = await this._read();
      const index = agents.findIndex((entry) => entry.id === id);
      if (index < 0) fail(404, 'Agent not found');
      if (typeof input.version !== 'string' || input.version !== hash(JSON.stringify(agents[index]))) {
        fail(409, 'Agent has changed; refresh and try again');
      }
      const { version, id: _ignored, ...changes } = input;
      const agent = cleanAgent(changes, agents[index]);
      if (JSON.stringify(agent) === JSON.stringify(agents[index])) return { ...agent, version: input.version };
      agents[index] = agent;
      await this._write(agents, `Update agent ${agent.id}: ${agent.name}`);
      return { ...agent, version: hash(JSON.stringify(agent)) };
    });
  }
}
