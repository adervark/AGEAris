import { createServer as createHttpServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { chmod, lstat, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AgentRegistry } from './lib/agents.mjs';
import { Cockpit } from './lib/brief.mjs';
import { PipelineEngine } from './lib/pipeline.mjs';
import { redactEmails, Workspace, WorkspaceError } from './lib/workspace.mjs';

const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));
const STATIC_FILES = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/app.js', 'app.js'],
  ['/actions.js', 'actions.js'],
  ['/styles.css', 'styles.css'],
  ['/icons.js', 'icons.js'],
  ['/cockpit.js', 'cockpit.js'],
  ['/cursor.js', 'cursor.js'],
  ['/words.js', 'words.js'],
  ['/markdown.js', 'markdown.js'],
  ['/threads.js', 'threads.js'],
  ['/planet.png', 'planet.png'],
  ['/logo.webp', 'logo.webp'],
]);
const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);
const MAX_JSON_BYTES = 1024 * 1024;
// Every task and project write made through the API is marked as made in the
// UI, so the history ledger never reads a person's edit as a sign of agent life.
const VIA_UI = { trailers: { 'AGESight-Via': 'ui' } };

function securityHeaders(response) {
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; object-src 'none'; frame-ancestors 'none'");
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cache-Control', 'no-store');
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  response.end(body);
}

function validHost(request) {
  const host = request.headers.host;
  if (typeof host !== 'string' || host.length > 255) return false;
  try {
    const parsed = new URL(`http://${host}`);
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

function validWriteOrigin(request) {
  const origin = request.headers.origin;
  if (origin === undefined) return true;
  if (typeof origin !== 'string' || !request.headers.host) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host === request.headers.host;
  } catch {
    return false;
  }
}

// The API token keeps local users and processes that cannot read the data
// directory out of the API. A browser receives it as an HttpOnly cookie only
// by opening the sign-in link printed at startup (/?token=...); scripts and
// pull runners read <data dir>/.api-token. Processes running as the operator
// can read that file, so the token is not a boundary against them.
async function apiToken(dataDir) {
  const path = join(dataDir, '.api-token');
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('API token file is not a regular file');
    const token = (await readFile(path, 'utf8')).trim();
    if (/^[A-Za-z0-9_-]{43}$/.test(token)) {
      await chmod(path, 0o600);
      return token;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const token = randomBytes(32).toString('base64url');
  await writeFile(path, `${token}\n`, { mode: 0o600 });
  return token;
}

function presentedToken(request) {
  const header = request.headers['x-agesight-token'];
  if (typeof header === 'string' && header) return header;
  return /(?:^|;\s*)agesight_token=([A-Za-z0-9_-]+)/.exec(String(request.headers.cookie || ''))?.[1] || '';
}

function sameToken(presented, token) {
  const a = Buffer.from(presented);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson(request) {
  const contentType = String(request.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
  const declaredLength = Number(request.headers['content-length'] || 0);
  if (contentType !== 'application/json' && (contentType || declaredLength > 0 || request.headers['transfer-encoding'])) {
    throw new WorkspaceError(415, 'Content-Type must be application/json');
  }
  const declared = Number(request.headers['content-length'] || 0);
  if (Number.isFinite(declared) && declared > MAX_JSON_BYTES) throw new WorkspaceError(400, 'JSON body is too large');
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) throw new WorkspaceError(400, 'JSON body is too large');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed;
  } catch {
    throw new WorkspaceError(400, 'Request body must be a JSON object');
  }
}

async function serveStatic(pathname, request, response) {
  const filename = STATIC_FILES.get(pathname);
  if (!filename) return false;
  const path = join(PUBLIC_DIR, filename);
  let info;
  try { info = await lstat(path); } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
  if (!info.isFile() || info.isSymbolicLink()) return false;
  const body = await readFile(path);
  response.statusCode = 200;
  response.setHeader('Content-Type', MIME.get(extname(path)) || 'application/octet-stream');
  response.setHeader('Content-Length', body.length);
  if (request.method === 'HEAD') response.end();
  else response.end(body);
  return true;
}

// Every refusal and failure of a task action on a tracked repository leaves one
// line on stderr, emails redacted: `tracked action <code>: <project> <task>
// <action> [<step>]`. A confirmation asked for is neither.
function logTrackedAction(error) {
  if (!error?.tracked || error.code === 'CONFIRM') return;
  const { project, task, action } = error.tracked;
  const code = error.code || (error.status >= 500 ? 'FAILED' : 'REFUSED');
  const step = error.status >= 500 ? ` [${error.code === 'INTERRUPTED' ? 'settle' : 'commit'}]` : '';
  console.error(redactEmails(`tracked action ${code}: ${project} ${task} ${String(action)}${step}`.replace(/[\r\n\u2028\u2029]/g, ' ')));
}

// `clock` (milliseconds, like Date.now) is the time the engine and the cockpit
// compute their read models at; tests inject it, and `ledgerOptions` (spawn,
// stat) for the history ledgers.
export async function createServer({ dataDir = process.env.AGESIGHT_DATA_DIR || join(process.cwd(), '.agesight-data'), port, clock, engineOptions = {}, registryOptions = {}, ledgerOptions = {}, cockpitOptions = {} } = {}) {
  // AGESIGHT_TRACKED_WRITES=0 turns task actions off on every tracked
  // repository, whatever each one's switch says.
  const workspace = await new Workspace({ dataDir, trackedWrites: process.env.AGESIGHT_TRACKED_WRITES !== '0' }).init();
  const registry = await new AgentRegistry({ dataDir: workspace.dataDir, operator: workspace.operator, email: workspace.email, ...registryOptions }).init();
  const engine = await new PipelineEngine({ workspace, registry, ...engineOptions, ...(clock ? { clock } : {}) }).init();
  const cockpit = new Cockpit({ workspace, engine, clock: clock || (() => Date.now()), ledgerOptions, ...cockpitOptions });
  const token = await apiToken(workspace.dataDir);
  const server = createHttpServer(async (request, response) => {
    securityHeaders(response);
    try {
      if (!validHost(request)) return sendJson(response, 400, { error: 'Host must be localhost or 127.0.0.1' });
      if (!validWriteOrigin(request)) {
        return sendJson(response, 403, { error: 'Cross-origin requests are not allowed' });
      }
      let url;
      try { url = new URL(request.url, `http://${request.headers.host}`); }
      catch { return sendJson(response, 400, { error: 'Invalid request URL' }); }
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith('/api/') && !sameToken(presentedToken(request), token)) {
        return sendJson(response, 401, { error: 'Open the sign-in link AGE Aris printed when it started. Scripts send the X-AGESight-Token header from the data directory\'s .api-token file.' });
      }

      if (request.method === 'GET' && pathname === '/api/workspace') {
        return sendJson(response, 200, { ...await workspace.read(), runs: engine.listRuns(), agents: await engine.agentPerformance() });
      }
      if (request.method === 'GET' && pathname === '/api/settings') return sendJson(response, 200, await workspace.readSettings());
      const query = Object.fromEntries(url.searchParams);
      if (request.method === 'GET' && pathname === '/api/brief') return sendJson(response, 200, await cockpit.brief(query));
      if (request.method === 'GET' && pathname === '/api/changes') return sendJson(response, 200, await cockpit.changes(query));
      const metricsMatch = /^\/api\/projects\/([^/]+)\/metrics$/.exec(pathname);
      if (request.method === 'GET' && metricsMatch) return sendJson(response, 200, await cockpit.projectMetrics(metricsMatch[1], query));
      const explainMatch = /^\/api\/explain\/([a-z0-9_]+)$/.exec(pathname);
      if (request.method === 'GET' && explainMatch) return sendJson(response, 200, await cockpit.explain(explainMatch[1], query));
      const historyMatch = /^\/api\/tasks\/([^/]+)\/history$/.exec(pathname);
      if (request.method === 'GET' && historyMatch) return sendJson(response, 200, await cockpit.taskHistory(historyMatch[1]));
      const methodMatch = /^\/api\/projects\/([^/]+)\/method$/.exec(pathname);
      if (request.method === 'GET' && methodMatch) return sendJson(response, 200, await workspace.methodOf(methodMatch[1]));
      const pipelineMatch = /^\/api\/projects\/([^/]+)\/pipeline$/.exec(pathname);
      if (request.method === 'GET' && pipelineMatch) return sendJson(response, 200, await engine.getPipeline(pipelineMatch[1]));
      if (request.method === 'PUT' && pipelineMatch) return sendJson(response, 200, await engine.savePipeline(pipelineMatch[1], await readJson(request), VIA_UI));
      if (request.method === 'GET' && pathname === '/api/runs') return sendJson(response, 200, engine.listRuns());
      if (request.method === 'POST' && pathname === '/api/runs') return sendJson(response, 201, await engine.startRun(await readJson(request)));
      const runMatch = /^\/api\/runs\/([^/]+)(\/actions|\/audit)?$/.exec(pathname);
      if (request.method === 'GET' && runMatch && !runMatch[2]) return sendJson(response, 200, await engine.getRun(runMatch[1]));
      if (request.method === 'GET' && runMatch?.[2] === '/audit') {
        const run = await engine.getRun(runMatch[1]);
        return sendJson(response, 200, { runId: run.id, path: run.path, audit: run.audit, events: run.events });
      }
      if (request.method === 'POST' && runMatch?.[2] === '/actions') return sendJson(response, 200, await engine.act(runMatch[1], await readJson(request)));
      if (request.method === 'GET' && pathname === '/api/agents') return sendJson(response, 200, await engine.agentPerformance());
      if (request.method === 'POST' && pathname === '/api/agents') {
        const agent = await registry.create(await readJson(request));
        engine.kick();
        return sendJson(response, 201, agent);
      }
      const agentMatch = /^\/api\/agents\/([^/]+)(\/claim)?$/.exec(pathname);
      if (request.method === 'PATCH' && agentMatch && !agentMatch[2]) {
        const agent = await registry.update(agentMatch[1], await readJson(request));
        engine.kick();
        return sendJson(response, 200, agent);
      }
      if (request.method === 'POST' && agentMatch?.[2] === '/claim') {
        await readJson(request);
        return sendJson(response, 200, { work: await engine.claim(agentMatch[1]) });
      }
      const attemptMatch = /^\/api\/attempts\/([^/]+)\/(complete|heartbeat)$/.exec(pathname);
      if (request.method === 'POST' && attemptMatch) {
        const body = await readJson(request);
        return sendJson(response, 200, attemptMatch[2] === 'complete' ? await engine.complete(attemptMatch[1], body) : await engine.heartbeat(attemptMatch[1], body));
      }
      if (request.method === 'POST' && pathname === '/api/projects/sample') {
        await readJson(request);
        return sendJson(response, 201, await workspace.createSampleProject({ now: cockpit.clock(), ...VIA_UI }));
      }
      if (request.method === 'POST' && pathname === '/api/projects') {
        return sendJson(response, 201, await workspace.createProject(await readJson(request), VIA_UI));
      }
      if (request.method === 'POST' && pathname === '/api/projects/link') {
        return sendJson(response, 201, await workspace.linkProject(await readJson(request)));
      }
      const projectMatch = /^\/api\/projects\/([^/]+)$/.exec(pathname);
      if (request.method === 'PATCH' && projectMatch) {
        return sendJson(response, 200, await workspace.updateProject(projectMatch[1], await readJson(request), VIA_UI));
      }
      // Stops tracking a repository; AGE Aris projects are never deleted here.
      if (request.method === 'DELETE' && projectMatch) {
        const removed = await workspace.unlinkProject(projectMatch[1]);
        cockpit.forget(removed.id);
        return sendJson(response, 200, removed);
      }
      if (request.method === 'POST' && pathname === '/api/tasks') {
        return sendJson(response, 201, await workspace.createTask(await readJson(request), VIA_UI));
      }
      const taskMatch = /^\/api\/tasks\/([^/]+)$/.exec(pathname);
      if (request.method === 'GET' && taskMatch) return sendJson(response, 200, await workspace.getTask(taskMatch[1], { body: true }));
      if (request.method === 'PATCH' && taskMatch) {
        return sendJson(response, 200, await workspace.updateTask(taskMatch[1], await readJson(request), VIA_UI));
      }
      // A task action: one click on an AGE Aris project's task, and on a tracked
      // AA board's (once its switch is on) one commit to its pinned branch.
      const actionMatch = /^\/api\/tasks\/([^/]+)\/actions$/.exec(pathname);
      if (request.method === 'POST' && actionMatch) {
        const body = await readJson(request);
        try {
          return sendJson(response, 200, await workspace.actOnTask(actionMatch[1], body, VIA_UI));
        } catch (error) {
          logTrackedAction(error);
          throw error;
        }
      }
      if (request.method === 'GET' && (pathname === '/' || pathname === '/index.html') && url.searchParams.has('token')) {
        if (!sameToken(url.searchParams.get('token') || '', token)) {
          response.statusCode = 303;
          response.setHeader('Location', '/');
          return response.end();
        }
        // Exchange the sign-in link for a cookie and drop the token from the address bar.
        response.statusCode = 303;
        response.setHeader('Set-Cookie', `agesight_token=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`);
        response.setHeader('Location', '/');
        return response.end();
      }
      if ((request.method === 'GET' || request.method === 'HEAD') && await serveStatic(pathname, request, response)) return;
      if (pathname.startsWith('/api/')) return sendJson(response, 404, { error: 'API endpoint not found' });
      if (!['GET', 'HEAD'].includes(request.method)) return sendJson(response, 405, { error: 'Method not allowed' });
      return sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      if (error instanceof URIError) return sendJson(response, 400, { error: 'Invalid request URL' });
      if (!(error instanceof WorkspaceError)) return sendJson(response, 500, { error: error?.message || 'Internal server error' });
      // A refusal names its reason and what to do about it; a confirmation
      // carries its reasons and token.
      return sendJson(response, error.status, {
        error: error.message, ...(error.code ? { code: error.code } : {}), ...(error.remedy ? { remedy: error.remedy } : {}), ...(error.details || {}),
      });
    }
  });
  server.workspace = workspace;
  server.registry = registry;
  server.engine = engine;
  server.cockpit = cockpit;
  server.apiToken = token;
  engine.start();
  server.on('close', () => {
    engine.stop();
    cockpit.close();
  });
  server.start = (listenPort = port ?? 4310) => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(listenPort, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server);
    });
  });
  return server;
}

async function main() {
  const rawPort = process.env.PORT || '4310';
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }
  const server = await createServer({ port: Number(rawPort) });
  await server.start();
  console.log(`AGE Aris is running. Open this link to sign in:\n\n  http://127.0.0.1:${rawPort}/?token=${server.apiToken}\n\nThe browser stays signed in for this data folder; the link is also stored in ${join(server.workspace.dataDir, '.api-token')} as the token.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export default createServer;
