// T087: v2.7's check-reconcile.mjs keeps a dead run's lines under its own id.
//
//   node --test docs/plans/evidence/t087/check-reconcile.test.mjs
//
// Fixtures are written to a temporary folder. The last test rebuilds R0d's
// three resumed outputs as they should have been left: the dead run's lines
// from 7359ccc, under their own ids, then the rerun's.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const checker = join(here, 'check-reconcile.mjs');
const jsonl = (xs) => xs.map((x) => JSON.stringify(x)).join('\n') + '\n';

const view = [
  { group: 1, via: ['m:x'], facts: [{ id: 'V1' }, { id: 'V2' }] },
  { check: 2, conclusion: { id: 'V3' }, premises: [{ id: 'V1' }] },
  { check: 3, conclusion: { id: 'V4' }, premises: [{ id: 'V2' }] },
];
const line = (unit, run) => (unit === 1
  ? { kind: 'ok', group: 1, why: 'consistent', run }
  : { kind: 'same', check: unit, finding: 'follows', why: 'as stated', run });

function run(out) {
  const dir = mkdtempSync(join(tmpdir(), 'aa-t087-'));
  try {
    writeFileSync(join(dir, 'view.jsonl'), jsonl(view));
    writeFileSync(join(dir, 'out.jsonl'), jsonl(out));
    const r = spawnSync(process.execPath, [checker, join(dir, 'view.jsonl'), join(dir, 'out.jsonl')], { encoding: 'utf8' });
    return { code: r.status, text: r.stdout };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('one run, complete: clean', () => {
  const r = run([line(1, 'a'), line(2, 'a'), line(3, 'a')]);
  assert.equal(r.code, 0, r.text);
});

test('a dead run\'s lines kept under its own id, then the rerun: clean', () => {
  const r = run([line(1, 'a'), line(2, 'a'), line(3, 'a.1')]);
  assert.equal(r.code, 0, r.text);
  assert.deepEqual(JSON.parse(r.text.split('\n')[0]).runs, ['a', 'a.1']);
});

test('a run that writes again after another took over: refused', () => {
  const r = run([line(1, 'a'), line(2, 'b'), line(3, 'a')]);
  assert.equal(r.code, 1);
  assert.match(r.text, /run a writes again after b took over/);
});

test('a line with no run: refused', () => {
  const r = run([line(1, 'a'), line(2, undefined), line(3, 'a')]);
  assert.equal(r.code, 1);
  assert.match(r.text, /a line carries no run/);
});

test('a unit written by both runs: still refused', () => {
  const r = run([line(1, 'a'), line(2, 'a'), line(2, 'b'), line(3, 'b')]);
  assert.equal(r.code, 1);
  assert.match(r.text, /check 2: written twice/);
});

test('R0d\'s resumed outputs, with the dead runs\' ids restored: clean', () => {
  const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: here, encoding: 'utf8' }).trim();
  for (const k of [1, 2, 3]) {
    const path = `docs/plans/evidence/t085/rec/out-R${k}.jsonl`;
    const dead = execFileSync('git', ['show', `7359ccc:${path}`], { cwd: repo, encoding: 'utf8' }).split('\n').filter((l) => l.trim());
    const now = readFileSync(join(repo, path), 'utf8').split('\n').filter((l) => l.trim());
    const out = [...dead, ...now.slice(dead.length)].map((l) => JSON.parse(l));
    assert.equal(new Set(out.map((o) => o.run)).size, 2, `R${k}: two runs`);
    const dir = mkdtempSync(join(tmpdir(), 'aa-t087-'));
    try {
      writeFileSync(join(dir, 'out.jsonl'), jsonl(out));
      const r = spawnSync(process.execPath, [checker, join(repo, `docs/plans/evidence/t085/rec/R${k}.jsonl`), join(dir, 'out.jsonl')], { encoding: 'utf8' });
      assert.equal(r.status, 0, `R${k}: ${r.stdout}`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});
