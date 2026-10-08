import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { appendEvents, buildEvent, GENESIS, parseEvents, readEvents, sha256, verifyChain } from '../lib/audit.mjs';

const temporaryDirectories = new Set();

test.after(async () => {
  await Promise.all([...temporaryDirectories].map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'agesight-audit-'));
  temporaryDirectories.add(directory);
  return directory;
}

const SYSTEM = { type: 'system', id: 'agesight' };

function chainOf(length) {
  const events = [];
  for (let index = 0; index < length; index += 1) {
    events.push(buildEvent(events.at(-1), {
      type: `step_${index + 1}`,
      actor: SYSTEM,
      data: { value: index + 1 },
      at: `2027-01-0${index + 1}T00:00:00.000Z`,
    }));
  }
  return events;
}

test('buildEvent starts the chain at sequence 1 with the genesis hash', () => {
  const [first] = chainOf(1);
  assert.equal(first.seq, 1);
  assert.equal(first.prevHash, GENESIS);
  assert.match(first.hash, /^[0-9a-f]{64}$/);
});

test('buildEvent links each event to the hash and sequence of its predecessor', () => {
  const [first, second] = chainOf(2);
  assert.equal(second.seq, 2);
  assert.equal(second.prevHash, first.hash);
});

test('buildEvent keeps only the type and id of the actor', () => {
  const event = buildEvent(null, { type: 'x', actor: { type: 'human', id: 'Ada', email: 'ada@example.invalid' } });
  assert.deepEqual(event.actor, { type: 'human', id: 'Ada' });
});

test('buildEvent produces identical hashes for identical input', () => {
  const input = { type: 'x', actor: SYSTEM, data: { a: 1 }, at: '2027-01-01T00:00:00.000Z' };
  assert.equal(buildEvent(null, input).hash, buildEvent(null, input).hash);
});

test('sha256 returns the known digest of the empty string', () => {
  assert.equal(sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('verifyChain accepts an intact chain of three events and reports its length and head', () => {
  const events = chainOf(3);
  const result = verifyChain(events);
  assert.equal(result.ok, true);
  assert.equal(result.count, 3);
  assert.equal(result.head, events[2].hash);
});

test('verifyChain accepts an empty log', () => {
  assert.deepEqual(verifyChain([]), { ok: true, count: 0, head: GENESIS });
});

test('verifyChain reports the event whose data was edited', () => {
  const events = chainOf(3);
  events[1] = { ...events[1], data: { value: 999 } };
  const result = verifyChain(events);
  assert.equal(result.ok, false);
  assert.equal(result.brokenAt, 2);
  assert.equal(result.reason, 'event content changed');
});

test('verifyChain reports an edit that rewrites the type of an event', () => {
  const events = chainOf(3);
  events[2] = { ...events[2], type: 'approved' };
  const result = verifyChain(events);
  assert.equal(result.ok, false);
  assert.equal(result.brokenAt, 3);
});

test('verifyChain detects a deleted middle line as a sequence gap', () => {
  const [first, , third] = chainOf(3);
  const result = verifyChain([first, third]);
  assert.equal(result.ok, false);
  assert.equal(result.brokenAt, 2);
  assert.equal(result.reason, 'sequence gap');
});

test('verifyChain detects a deleted first line', () => {
  const [, second, third] = chainOf(3);
  const result = verifyChain([second, third]);
  assert.equal(result.ok, false);
  assert.equal(result.brokenAt, 1);
});

test('verifyChain detects a deleted line even when the later sequence numbers are rewritten', () => {
  const [first, , third] = chainOf(3);
  const result = verifyChain([first, { ...third, seq: 2 }]);
  assert.equal(result.ok, false);
  assert.equal(result.brokenAt, 2);
  assert.equal(result.reason, 'previous hash mismatch');
});

test('verifyChain detects reordered lines', () => {
  const [first, second, third] = chainOf(3);
  const result = verifyChain([first, third, second]);
  assert.equal(result.ok, false);
  assert.equal(result.brokenAt, 2);
});

test('verifyChain detects a first event that does not start from the genesis hash', () => {
  const [first] = chainOf(1);
  const forged = buildEvent({ seq: 0, hash: 'f'.repeat(64) }, { type: 'x', actor: SYSTEM, at: first.at });
  const result = verifyChain([forged]);
  assert.equal(result.ok, false);
  assert.equal(result.brokenAt, 1);
  assert.equal(result.reason, 'previous hash mismatch');
});

test('appendEvents and readEvents round trip events across separate appends', async () => {
  const directory = await temporaryDirectory();
  const file = path.join(directory, 'events.jsonl');
  const events = chainOf(3);
  await appendEvents(file, events.slice(0, 2));
  await appendEvents(file, events.slice(2));
  assert.deepEqual(await readEvents(file), events);
  assert.equal(verifyChain(await readEvents(file)).ok, true);
});

test('appendEvents writes one JSON object per line', async () => {
  const directory = await temporaryDirectory();
  const file = path.join(directory, 'events.jsonl');
  await appendEvents(file, chainOf(3));
  const text = await readFile(file, 'utf8');
  assert.equal(text.split('\n').filter(Boolean).length, 3);
  assert.ok(text.endsWith('\n'));
});

test('readEvents returns an empty list for a missing file', async () => {
  const directory = await temporaryDirectory();
  assert.deepEqual(await readEvents(path.join(directory, 'missing.jsonl')), []);
});

test('readEvents rejects a line that is not valid JSON and names the line', async () => {
  const directory = await temporaryDirectory();
  const file = path.join(directory, 'events.jsonl');
  const [first] = chainOf(1);
  await writeFile(file, `${JSON.stringify(first)}\n{not json\n`);
  await assert.rejects(readEvents(file), /Audit line 2 is not valid JSON/);
});

test('parseEvents ignores blank lines', () => {
  const [first] = chainOf(1);
  assert.deepEqual(parseEvents(`\n${JSON.stringify(first)}\n\n`), [first]);
});

test('a chain edited on disk fails verification after being read back', async () => {
  const directory = await temporaryDirectory();
  const file = path.join(directory, 'events.jsonl');
  await appendEvents(file, chainOf(3));
  const lines = (await readFile(file, 'utf8')).split('\n').filter(Boolean);
  lines[1] = lines[1].replace('"value":2', '"value":20');
  await writeFile(file, `${lines.join('\n')}\n`);
  const result = verifyChain(await readEvents(file));
  assert.equal(result.ok, false);
  assert.equal(result.brokenAt, 2);
});
