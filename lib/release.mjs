// Rule 13 run by AGE Aris: its own copy of ckpt.sh, run from the repository (the
// repository's copy, if it has one, is never run) with CKPT_HARDENED set. The
// script keeps the task's evidence first, and names whatever it will not delete.
//
// Everything in the repository is untrusted. Under CKPT_HARDENED the script runs
// no git command that could read a filter or a hook, leaves worktrees and nested
// repositories alone, and refuses a repository whose own config names a filter.
import { spawn } from 'node:child_process';
import { devNull } from 'node:os';
import { fileURLToPath } from 'node:url';

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

// The scratch folder this AA.yml names, as written; '' when it names none.
export function scratchFolder(config = '') {
  const line = String(config).split('\n').find((entry) => entry.startsWith('scratch:'));
  const value = line ? line.slice('scratch:'.length).split('#')[0].trim() : '';
  return value.split(/\s/)[0];
}

// The ids, out of `ids`, that one of `names` (scratch entries, branches) is
// named for: T123, t123, T123-x, t123_x, t123/x, as ckpt.sh's named_for reads
// them. A cheap first look: the release itself decides what goes.
export function namedFor(ids, names) {
  const lowered = names.map((name) => name.toLowerCase());
  return ids.filter((id) => {
    const low = id.toLowerCase();
    return lowered.some((name) => name.startsWith(low) && (name.length === low.length || '-_/'.includes(name[low.length])));
  });
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

function run(dir, localId, env, script, limit) {
  return new Promise((settled) => {
    const output = { stdout: '', stderr: '' };
    // Its own process group, so a child reading a FIFO goes with it; stopping
    // does not wait on pipes a stuck grandchild might hold.
    const child = spawn('bash', [script, 'release', localId], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: true });
    let timedOut = false;
    const signal = (name) => { try { process.kill(-child.pid, name); } catch { /* gone */ } };
    const term = setTimeout(() => { timedOut = true; signal('SIGTERM'); }, limit);
    const kill = setTimeout(() => { signal('SIGKILL'); finish({ code: null }); }, limit + GRACE_MS);
    for (const stream of ['stdout', 'stderr']) {
      child[stream].setEncoding('utf8');
      // The tail is what matters: it holds what stayed, and the verdict.
      child[stream].on('data', (chunk) => { output[stream] = `${output[stream]}${chunk}`.slice(-OUTPUT_LIMIT); });
    }
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
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
export async function releaseTask(dir, localId, { script = RELEASE_SCRIPT, limit = RELEASE_LIMIT_MS } = {}) {
  // Replace refs and grafts must not make unlanded work look landed.
  const result = await run(dir, localId, gitEnv({ ...configEnv([...hardening(), ['advice.graftFileDeprecated', 'false']]), CKPT_HARDENED: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_GRAFT_FILE: devNull }), script, limit);
  const said = outputLines(result.stdout);
  const complaints = outputLines(result.stderr);
  const all = [...said, ...complaints];
  const lines = all.length > LINES_SHOWN ? [...all.slice(0, LINES_SHOWN), `and ${all.length - LINES_SHOWN} more`] : all;
  const remedy = `Once that is dealt with, from a terminal: cd ${shellQuoted(dir)} && bash ${shellQuoted(script)} release ${localId}`;
  if (result.error || result.timedOut) {
    const why = result.timedOut ? `it was stopped after ${Math.round(limit / 60_000)} minutes` : `bash could not run (${redactEmails(result.error.message)})`;
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
