// /aa's prerequisite check (skills/aa/aa.sh). Stubs on a PATH of their own stand
// in for the tools; nothing outside os.tmpdir() is written, and no server starts.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const AA = fileURLToPath(new URL('../skills/aa/aa.sh', import.meta.url));
const BASH = execFileSync('bash', ['-c', 'command -v bash'], { encoding: 'utf8' }).trim();
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

test('Git Bash on Windows is sent to WSL before anything runs', async () => {
  const bin = await stubs({ uname: 'MINGW64_NT-10.0-26100' });
  const result = aa(bin, await scratch());
  assert.equal(result.status, 1);
  assert.equal(result.stdout, 'On Windows, AGE Aris runs inside WSL: run Claude Code there, and install the plugin there.\n');
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
