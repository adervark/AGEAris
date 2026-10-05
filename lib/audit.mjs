import { createHash } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';

// Append-only, hash-chained event log. Each line is one JSON event whose hash
// covers the previous hash and the event body, so editing, removing, or
// reordering a line breaks verification from that point on. Removing lines
// from the end does not, and anyone who can write the file can recompute the
// chain, so callers also compare the head with the one recorded in git.

export const GENESIS = '0'.repeat(64);

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function eventHash(event) {
  const { hash, ...body } = event;
  return sha256(`${body.prevHash}\n${JSON.stringify(body)}`);
}

export function buildEvent(previous, { type, actor, data = {}, at = new Date().toISOString() }) {
  const event = {
    seq: previous ? previous.seq + 1 : 1,
    at,
    actor: { type: actor.type, id: actor.id },
    type,
    data,
    prevHash: previous ? previous.hash : GENESIS,
  };
  return { ...event, hash: eventHash(event) };
}

export function parseEvents(text) {
  return text.split('\n').filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); } catch { throw new Error(`Audit line ${index + 1} is not valid JSON`); }
  });
}

export async function readEvents(path) {
  try { return parseEvents(await readFile(path, 'utf8')); } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

export async function appendEvents(path, events) {
  await appendFile(path, events.map((event) => `${JSON.stringify(event)}\n`).join(''));
}

export function verifyChain(events) {
  let prevHash = GENESIS;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.seq !== index + 1) return { ok: false, count: events.length, brokenAt: index + 1, reason: 'sequence gap' };
    if (event.prevHash !== prevHash) return { ok: false, count: events.length, brokenAt: event.seq, reason: 'previous hash mismatch' };
    if (eventHash(event) !== event.hash) return { ok: false, count: events.length, brokenAt: event.seq, reason: 'event content changed' };
    prevHash = event.hash;
  }
  return { ok: true, count: events.length, head: prevHash };
}
