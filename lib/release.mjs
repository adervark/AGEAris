// Rule 13 run by AGE Aris: when a task is marked done in AGE Aris, its
// environment is released by AGE Aris's own copy of ckpt.sh, run from the
// repository (the repository's copy, if it has one, is never run). The script
// keeps the task's evidence first, and names whatever it will not delete.
//
// Everything in the repository is untrusted, so git runs under the same
// hardening as a task action: no hooks, filters, signing or external diffs.
// A nested repository's own config is not read at all (CKPT_HARDENED).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { filterNames, trackedGit } from './tracked.mjs';
import { GIT_HARDENING, gitEnv, redactEmails } from './workspace.mjs';

export const RELEASE_SCRIPT = fileURLToPath(new URL('../skills/aa-init/template/ckpt.sh', import.meta.url));
// A release that takes longer than this is stopped. Kept files are committed
// before anything is deleted, so stopping it loses nothing that was to be kept.
const RELEASE_LIMIT_MS = 30 * 60_000;
const GRACE_MS = 5_000;
const OUTPUT_LIMIT = 64 * 1024;
const LINE_LIMIT = 300;
const LINES_SHOWN = 40;

// Does this AA.yml declare a scratch folder? A board without the key has not
// taken up rule 13, so its agents were never told their scratch goes.
export function declaresScratch(config = '') {
  return /^scratch:[ \t]*[^\s#]/m.test(config);
}

// Config the script's git calls run under: AGE Aris's own hardening, then what
// a commit or a status could otherwise run. Auto-maintenance runs gc's hooks;
// a submodule has config of its own, and the script holds its folder anyway.
const RELEASE_CONFIG = [['commit.gpgSign', 'false'], ['gc.auto', '0'], ['maintenance.auto', 'false'], ['diff.ignoreSubmodules', 'all']];

// Every filter driver any of the repository's worktrees could read, blanked: a
// linked worktree can have its own, in config.worktree or an includeIf.
async function filterConfig(dir) {
  const listed = await trackedGit(dir, ['worktree', 'list', '--porcelain', '-z']);
  const worktrees = listed.stdout.toString('utf8').split('\0').filter((line) => line.startsWith('worktree ')).map((line) => line.slice(9));
  const names = new Set();
  for (const worktree of new Set([dir, ...worktrees])) {
    for (const name of await filterNames((args, options) => trackedGit(worktree, args, options))) names.add(name);
  }
  return [...names].flatMap((name) => [[`filter.${name}.clean`, ''], [`filter.${name}.smudge`, ''], [`filter.${name}.process`, ''], [`filter.${name}.required`, 'false']]);
}

// Git config as the environment carries it, so it reaches every git call the
// script makes, and outranks the repository's own.
function configEnv(pairs) {
  const env = { GIT_CONFIG_COUNT: String(pairs.length) };
  pairs.forEach(([key, value], index) => {
    env[`GIT_CONFIG_KEY_${index}`] = key;
    env[`GIT_CONFIG_VALUE_${index}`] = value;
  });
  return env;
}

function hardening() {
  return GIT_HARDENING.filter((argument) => argument !== '-c').map((pair) => {
    const split = pair.indexOf('=');
    return [pair.slice(0, split), pair.slice(split + 1)];
  });
}

// Clipped first: the output can carry task text, which no regex may meet at length.
function outputLines(text) {
  return String(text).split('\n').map((line) => {
    const short = line.length > LINE_LIMIT ? `${line.slice(0, LINE_LIMIT - 1)}…` : line;
    return redactEmails(short).replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ').replace(/^ckpt: /, '').replace(/^- /, '').trim();
  }).filter(Boolean);
}

function run(dir, localId, env, script) {
  return new Promise((settled) => {
    const output = { stdout: '', stderr: '' };
    const child = spawn('bash', [script, 'release', localId], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let timedOut = false;
    const term = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, RELEASE_LIMIT_MS);
    const kill = setTimeout(() => child.kill('SIGKILL'), RELEASE_LIMIT_MS + GRACE_MS);
    for (const stream of ['stdout', 'stderr']) {
      child[stream].setEncoding('utf8');
      // The tail is what matters: it holds what stayed, and the verdict.
      child[stream].on('data', (chunk) => { output[stream] = `${output[stream]}${chunk}`.slice(-OUTPUT_LIMIT); });
    }
    const finish = (result) => {
      clearTimeout(term);
      clearTimeout(kill);
      settled({ ...result, ...output, timedOut });
    };
    child.once('error', (error) => finish({ error }));
    child.once('close', (code) => finish({ code }));
  });
}

function shellQuoted(text) {
  return `'${String(text).replaceAll("'", "'\\''")}'`;
}

// What happened, as { state, summary, lines, remedy }. The state is released,
// partial (some of it could not be deleted), nothing (it held nothing), kept
// (all of it had to stay), refused (the script stopped, and deleted nothing) or
// failed (it could not run, or was stopped).
export async function releaseTask(dir, localId, { script = RELEASE_SCRIPT } = {}) {
  const pairs = [...hardening(), ...RELEASE_CONFIG, ...await filterConfig(dir)];
  const result = await run(dir, localId, gitEnv({ ...configEnv(pairs), CKPT_HARDENED: '1' }), script);
  const said = outputLines(result.stdout);
  const complaints = outputLines(result.stderr);
  const all = [...said, ...complaints];
  const lines = all.length > LINES_SHOWN ? [...all.slice(0, LINES_SHOWN), `and ${all.length - LINES_SHOWN} more`] : all;
  const remedy = `Once that is dealt with, from a terminal: cd ${shellQuoted(dir)} && bash ${shellQuoted(script)} release ${localId}`;
  if (result.error || result.timedOut) {
    const why = result.timedOut ? 'it was stopped after 30 minutes' : `bash could not run (${redactEmails(result.error.message)})`;
    return { state: 'failed', summary: `${localId}'s environment was not fully released: ${why}.`, lines, remedy };
  }
  if (result.code !== 0) {
    return { state: 'refused', summary: `${localId}'s environment was not released: ${complaints.at(-1) || `the release stopped (exit ${result.code})`}.`, lines, remedy };
  }
  const stayed = said.filter((line) => line.startsWith('KEPT: ')).map((line) => line.slice(6));
  if (said.at(-1) === 'released in part.') {
    return { state: 'partial', summary: `${localId}'s environment was released in part: ${complaints[0] || 'something could not be deleted'}.`, lines, remedy };
  }
  if (said.at(-1) === 'released.') {
    const left = stayed.length ? ` Still there: ${stayed[0]}${stayed.length > 1 ? `, and ${stayed.length - 1} more` : ''}.` : '';
    return { state: 'released', summary: `${localId}'s environment is released.${left}`, lines: lines.filter((line) => line !== 'released.'), ...(stayed.length ? { remedy } : {}) };
  }
  if (stayed.length) return { state: 'kept', summary: `${localId}'s environment stays: ${stayed[0]}${stayed.length > 1 ? `, and ${stayed.length - 1} more` : ''}.`, lines, remedy };
  return { state: 'nothing', summary: '', lines: [] };
}
