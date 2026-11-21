// Run: node --test server/test/mcpProxy.test.js      (no native dependencies)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createMcpProxy } from '../mcpProxy.js';

let upstream, upstreamPort, proxyServer, base, seen, behaviour;

before(async () => {
  seen = [];
  behaviour = { status: 200, body: '{"ok":true}', delayMs: 0 };
  upstream = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      seen.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() });
      if (behaviour.delayMs) await new Promise((r) => setTimeout(r, behaviour.delayMs));
      const out = { 'content-type': 'application/json', 'x-from': 'upstream' };
      if (behaviour.status === 401) out['www-authenticate'] = 'Bearer realm="x"';
      res.writeHead(behaviour.status, out);
      res.end(behaviour.body);
    });
  });
  await new Promise((ok) => upstream.listen(0, '127.0.0.1', ok));
  upstreamPort = upstream.address().port;

  const app = express();
  app.set('trust proxy', 1);
  app.all('/mcp', createMcpProxy(`http://127.0.0.1:${upstreamPort}`, { timeoutMs: 400 })); // before any body parser, like index.js
  await new Promise((ok) => (proxyServer = app.listen(0, '127.0.0.1', ok)));
  base = `http://127.0.0.1:${proxyServer.address().port}`;
});
after(() => { proxyServer.close(); upstream.close(); });

const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });

test('forwards method, path with query string, body and the Authorization header untouched', async () => {
  seen.length = 0;
  const r = await post('/mcp?groups=mindmaps,planner', '{"jsonrpc":"2.0","id":1,"method":"tools/list"}', { authorization: 'Bearer chlio_pat_abc', accept: 'application/json, text/event-stream' });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-from'), 'upstream');
  assert.deepEqual(await r.json(), { ok: true });
  const s = seen[0];
  assert.equal(s.method, 'POST');
  assert.equal(s.url, '/mcp?groups=mindmaps,planner');
  assert.equal(s.headers.authorization, 'Bearer chlio_pat_abc', 'the token reaches the MCP service, which does the only check');
  assert.equal(s.body, '{"jsonrpc":"2.0","id":1,"method":"tools/list"}');
  assert.equal(s.headers['x-forwarded-proto'], 'http');
  assert.match(s.headers['x-forwarded-for'], /127\.0\.0\.1/);
});

test("relays the MCP service's own answers, including 401 with WWW-Authenticate and 405", async () => {
  behaviour = { status: 401, body: '{"error":"token required"}', delayMs: 0 };
  const r = await post('/mcp', '{}');
  assert.equal(r.status, 401);
  assert.match(r.headers.get('www-authenticate') || '', /Bearer/);
  behaviour = { status: 405, body: '{"error":"POST only"}', delayMs: 0 };
  assert.equal((await fetch(`${base}/mcp`)).status, 405);
  behaviour = { status: 200, body: '{"ok":true}', delayMs: 0 };
});

test('streams a large body (1 MB) through intact', async () => {
  seen.length = 0;
  const big = JSON.stringify({ pad: 'x'.repeat(1024 * 1024) });
  assert.equal((await post('/mcp', big)).status, 200);
  assert.equal(seen[0].body.length, big.length);
});

test('hop-by-hop headers are not forwarded', async () => {
  seen.length = 0;
  // raw http: Node's fetch refuses to send these headers itself
  await new Promise((resolve, reject) => {
    const r = http.request(base + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json', 'keep-alive': 'timeout=5', 'proxy-authorization': 'secret', te: 'trailers', 'content-length': 2 } }, (res) => { res.resume(); res.on('end', resolve); });
    r.on('error', reject);
    r.end('{}');
  });
  assert.equal(seen[0].headers['keep-alive'], undefined);
  assert.equal(seen[0].headers['proxy-authorization'], undefined);
  assert.equal(seen[0].headers.te, undefined);
});

test('MCP service down -> a clear 502 in JSON-RPC form, and the proxy keeps running', async () => {
  const dead = express();
  dead.all('/mcp', createMcpProxy('http://127.0.0.1:1', { timeoutMs: 400 }));
  const srv = await new Promise((ok) => { const s = dead.listen(0, '127.0.0.1', () => ok(s)); });
  const url = `http://127.0.0.1:${srv.address().port}/mcp`;
  const r = await fetch(url, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
  assert.equal(r.status, 502);
  const body = await r.json();
  assert.equal(body.jsonrpc, '2.0');
  assert.match(body.error.message, /unavailable/i);
  assert.equal((await fetch(url, { method: 'POST', body: '{}' })).status, 502, 'still answering the next request');
  srv.close();
});

test('a slow MCP service -> 504 instead of hanging', async () => {
  behaviour = { status: 200, body: '{}', delayMs: 1500 };
  const r = await post('/mcp', '{}');
  assert.equal(r.status, 504);
  behaviour = { status: 200, body: '{"ok":true}', delayMs: 0 };
});
