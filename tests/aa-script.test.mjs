// /aa (skills/aa/aa.sh): its prerequisite check, and what it hands Node and AGE
// Aris on Windows. Stubs on the PATH stand in for the tools; nothing outside
// os.tmpdir() is written, and AGE Aris itself never starts.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const AA = fileURLToPath(new URL('../skills/aa/aa.sh', import.meta.url));
const BASH = execFileSync('bash', ['-c', 'command -v bash'], { encoding: 'utf8' }).trim();
const JQ = execFileSync('bash', ['-c', 'command -v jq'], { encoding: 'utf8' }).trim();
const temporary = new Set();

test.after(async () => {
  await Promise.all([...temporary].map((directory) => rm(directory, { recursive: true, force: true })));
});

async function scratch() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'agearis-aa-'));
  temporary.add(directory);
  return directory;
}

// A PATH holding only these stubs, each a shell script that prints its line.
async function stubs(tools) {
  const bin = path.join(await scratch(), 'bin');
  await mkdir(bin);
  for (const [name, output] of Object.entries(tools)) {
    const file = path.join(bin, name);
    await writeFile(file, `#!/bin/sh\n${output === '' ? 'exit 0' : `echo '${output}'`}\n`);
    await chmod(file, 0o755);
  }
  return bin;
}

function aa(bin, cwd, env = {}) {
  return spawnSync(BASH, [AA], { cwd, encoding: 'utf8', env: { HOME: os.homedir(), PATH: bin, ...env } });
}

test('names every missing tool at once, with one install line for the OS', async () => {
  const bin = await stubs({ uname: 'Linux', git: '', node: 'v18.19.0', 'apt-get': '' });
  const result = aa(bin, await scratch());
  assert.equal(result.status, 1);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, [
    'AGE Aris needs these, and this machine does not have them:',
    '',
    '  - jq',
    '  - curl',
    '  - Node 22 or newer (this machine has v18.19.0)',
    '',
    'Install them, then run /aa again:',
    '',
    '  sudo apt-get install -y jq curl',
    '  Node 22 or newer: https://nodejs.org/en/download',
    '',
  ].join('\n'));
});

test('a machine with no Node is told where to get it, and no package line', async () => {
  const bin = await stubs({ uname: 'Linux', git: '', jq: '', curl: '' });
  const result = aa(bin, await scratch());
  assert.equal(result.status, 1);
  assert.equal(result.stdout, [
    'AGE Aris needs these, and this machine does not have them:',
    '',
    '  - Node 22 or newer',
    '',
    'Install them, then run /aa again:',
    '',
    '  Node 22 or newer: https://nodejs.org/en/download',
    '',
  ].join('\n'));
});

test('macOS gets brew, and where Homebrew is when it is missing too', async () => {
  const bin = await stubs({ uname: 'Darwin', git: '', curl: '', node: 'v22.11.0' });
  const result = aa(bin, await scratch());
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^ {2}- jq\n\n/m);
  assert.ok(result.stdout.endsWith('  brew install jq\n  (Homebrew itself: https://brew.sh)\n'));
  assert.doesNotMatch(result.stdout, /Node 22/);
});

test('Git Bash on Windows gets winget lines, and is told to restart Claude Code', async () => {
  const bin = await stubs({ uname: 'MINGW64_NT-10.0-26100', git: '', curl: '', node: 'v20.11.0' });
  const result = aa(bin, await scratch());
  assert.equal(result.status, 1);
  assert.equal(result.stdout, [
    'AGE Aris needs these, and this machine does not have them:',
    '',
    '  - jq',
    '  - Node 22 or newer (this machine has v20.11.0)',
    '',
    'Install them, restart Claude Code, then run /aa again:',
    '',
    '  winget install jqlang.jq',
    '  winget install OpenJS.NodeJS.LTS',
    '',
  ].join('\n'));
});

test('with everything present the check is silent and /aa goes on', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  const directory = await scratch();
  const result = spawnSync(BASH, [AA], {
    cwd: directory,
    encoding: 'utf8',
    env: {
      ...process.env,
      AGEARIS_PORT: String(port),
      AGEARIS_HOME: path.join(directory, 'no-checkout'),
      AGESIGHT_DATA_DIR: path.join(directory, 'data'),
      XDG_STATE_HOME: path.join(directory, 'state'),
    },
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout, /needs these/);
  assert.match(result.stdout, /has no AA board/);
  assert.match(result.stdout, /AGE Aris is not running, and there is no checkout at .*no-checkout to start/);
});

// A stubbed Git Bash on top of the real PATH: uname says MINGW, cygpath -w turns
// /x/y into C:\fake\x\y, jq ends its lines CRLF as winget's jq.exe does and
// rejects -b as jq 1.6 does, curl answers as a running AGE Aris once `started` exists, and
// curl and cmd.exe write each call's arguments under `calls`.
const TOKEN = 'T'.repeat(43);
const windowsPath = (posix) => `C:\\fake${posix.replaceAll('/', '\\')}`;

async function script(bin, name, body) {
  const file = path.join(bin, name);
  await writeFile(file, `#!/bin/sh\n${body}\n`);
  await chmod(file, 0o755);
}

async function gitBash() {
  const dir = await realpath(await scratch());
  const [bin, calls, repo, data] = ['bin', 'calls', 'repo', 'data'].map((name) => path.join(dir, name));
  await Promise.all([bin, calls, path.join(repo, 'AA', 'tasks'), path.join(data, 'projects')].map((folder) => mkdir(folder, { recursive: true })));
  await writeFile(path.join(repo, 'AA', 'AA.yml'), 'wip:\n  in_progress: 2\n');
  await writeFile(path.join(data, '.api-token'), `${TOKEN}\n`);
  await script(bin, 'uname', 'echo MINGW64_NT-10.0-26100');
  await script(bin, 'cygpath', String.raw`[ "$1" = -w ] && shift; printf 'C:\\fake%s\n' "$(printf '%s' "$1" | tr / '\\')"`);
  await script(bin, 'jq', [
    `for a in "$@"; do [ "$a" = -b ] && { echo 'Unknown option: -b' >&2; exit 2; }; done`,
    `out=$('${JQ}' "$@"); status=$?; [ -z "$out" ] || printf '%s\\n' "$out" | sed 's/$/\r/'; exit $status`,
  ].join('\n'));
  await script(bin, 'curl', [
    `i=0; while [ -e "${calls}/curl.$i" ]; do i=$((i + 1)); done`,
    `printf '%s\\n' "$@" > "${calls}/curl.$i"`,
    `case "$*" in *http_code*) if [ -e "${calls}/started" ]; then printf 200; else printf 000; fi ;; *) printf '{"id":"1d0f3c2a-5b6e-4c7d-8e9f-0a1b2c3d4e5f"}' ;; esac`,
  ].join('\n'));
  await script(bin, 'cmd.exe', `{ printf 'MSYS_NO_PATHCONV=%s MSYS2_ARG_CONV_EXCL=%s\\n' "$MSYS_NO_PATHCONV" "$MSYS2_ARG_CONV_EXCL"; printf '%s\\n' "$@"; } > "${calls}/cmd.tmp" && mv "${calls}/cmd.tmp" "${calls}/cmd"`);
  const run = (args, env = {}) => spawnSync(BASH, [AA, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      AGEARIS_PORT: '4999',
      AGEARIS_HOME: path.join(dir, 'no-checkout'),
      AGESIGHT_DATA_DIR: data,
      XDG_STATE_HOME: path.join(dir, 'state'),
      ...env,
    },
  });
  const requests = async () => Promise.all((await readdir(calls)).filter((name) => name.startsWith('curl.')).map(async (name) => (await readFile(path.join(calls, name), 'utf8')).split('\n')));
  return { dir, calls, repo, data, run, requests };
}

async function waitFor(file) {
  for (let tries = 0; tries < 50 && !existsSync(file); tries++) await new Promise((resolve) => setTimeout(resolve, 100));
  return readFile(file, 'utf8');
}

test('on Windows, /aa tracks the repository by its Windows path and opens the page through cmd', async () => {
  const bash = await gitBash();
  await writeFile(path.join(bash.calls, 'started'), '');
  const result = bash.run(['link', 'open']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Now tracking repo in AGE Aris\./);
  const link = `http://127.0.0.1:4999/?token=${TOKEN}#project/1d0f3c2a-5b6e-4c7d-8e9f-0a1b2c3d4e5f`;
  assert.ok(result.stdout.includes(`AGE Aris: ${link}\n`), result.stdout);
  const post = (await bash.requests()).find((args) => args.includes('-d'));
  assert.equal(JSON.parse(post[post.indexOf('-d') + 1]).path, windowsPath(bash.repo));
  assert.equal(await waitFor(path.join(bash.calls, 'cmd')), ['MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL=*', '/c', 'start', '', link, ''].join('\n'));
});

test('on Windows, a tracked repository is found by its Windows path in any letter case', async () => {
  const bash = await gitBash();
  await writeFile(path.join(bash.calls, 'started'), '');
  await mkdir(path.join(bash.data, 'projects', '9e8d7c6b-5a4f-4e3d-9c2b-1a0f9e8d7c6b'));
  await writeFile(path.join(bash.data, 'projects', '9e8d7c6b-5a4f-4e3d-9c2b-1a0f9e8d7c6b', 'project.json'), JSON.stringify({ id: '9e8d7c6b-5a4f-4e3d-9c2b-1a0f9e8d7c6b', repository: windowsPath(bash.repo).toUpperCase() }));
  const result = bash.run([]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.includes(`AGE Aris: http://127.0.0.1:4999/?token=${TOKEN}#project/9e8d7c6b-5a4f-4e3d-9c2b-1a0f9e8d7c6b\n`), result.stdout);
  assert.ok(!(await bash.requests()).some((args) => args.includes('-d')), 'nothing is linked twice');
});

test('a project id that is not a UUID reaches no browser opener', async () => {
  const bash = await gitBash();
  await writeFile(path.join(bash.calls, 'started'), '');
  await mkdir(path.join(bash.data, 'projects', 'hand-edited'));
  await writeFile(path.join(bash.data, 'projects', 'hand-edited', 'project.json'), JSON.stringify({ id: 'x&calc', repository: windowsPath(bash.repo) }));
  const result = bash.run(['open']);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /whose id is not one: x&calc/);
  assert.doesNotMatch(result.stdout, /AGE Aris: /);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.ok(!existsSync(path.join(bash.calls, 'cmd')), 'cmd was not run');
});

test('on Windows, /aa starts AGE Aris with Windows paths for its data folder and log', async () => {
  const bash = await gitBash();
  const app = path.join(bash.dir, 'app');
  await mkdir(app);
  // Stands in for AGE Aris: records what it was started with, then counts as up.
  await writeFile(path.join(app, 'server.mjs'), [
    "import { renameSync, writeFileSync } from 'node:fs';",
    "const calls = process.env.STUB_CALLS;",
    "writeFileSync(`${calls}/server.tmp`, JSON.stringify({ dataDir: process.env.AGESIGHT_DATA_DIR, argv0: process.argv0 }));",
    "renameSync(`${calls}/server.tmp`, `${calls}/server`);",
    "writeFileSync(`${calls}/started`, '');",
  ].join('\n'));
  const result = bash.run([], { AGEARIS_HOME: app, STUB_CALLS: bash.calls });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Started AGE Aris on port 4999/);
  const started = JSON.parse(await readFile(path.join(bash.calls, 'server'), 'utf8'));
  assert.deepEqual(started, { dataDir: windowsPath(bash.data), argv0: 'node' });
  // Node was handed the log as C:\fake\…; on Linux that names a file in the app folder.
  assert.ok(existsSync(path.join(app, windowsPath(path.join(bash.dir, 'state', 'agearis', 'server.log')))));
});

test('a task file with CRLF line endings is read as it is with LF', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  const directory = await scratch();
  await mkdir(path.join(directory, 'AA', 'tasks'), { recursive: true });
  await writeFile(path.join(directory, 'AA', 'tasks', 'T001-crlf.md'), ['---', 'id: T001', 'title: "Saved on Windows"', 'status: claimed', 'owner: someone', '---', '', '# T001', ''].join('\r\n'));
  const result = spawnSync(BASH, [AA], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, AGEARIS_PORT: String(port), AGEARIS_HOME: path.join(directory, 'no-checkout'), AGESIGHT_DATA_DIR: path.join(directory, 'data') },
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(result.stdout.includes('| T001 | Saved on Windows | claimed | someone |\n'), result.stdout);
});
