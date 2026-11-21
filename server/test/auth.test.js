// Run: cd server && npm test      (needs better-sqlite3; run inside the Docker image, see README)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import Database from 'better-sqlite3';
import { initSchema } from '../schema.js';
import {
  createAuth,
  createGoogleClient,
  createRateLimiter,
  parseAllowedEmails,
  sanitizeReturnTo,
  sha256,
  SESSION_COOKIE,
  CSRF_HEADER,
} from '../auth.js';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const PUBLIC_URL = 'https://chlio.test';
const OWNER = 'owner@example.com';

// ------------------------------------------------------------------ a fake Google
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };

function signIdToken(claims, key = privateKey, kid = 'k1') {
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), key).toString('base64url');
  return `${h}.${p}.${sig}`;
}

/** Behaviour the next token exchange should have; the test sets this before hitting the callback. */
let googleBehaviour = {};
let lastTokenRequest = null;
const clock = { t: 1_800_000_000_000 };
const now = () => clock.t;

async function fakeFetch(url, init) {
  if (String(url).includes('/oauth2/v3/certs')) return new Response(JSON.stringify({ keys: [jwk] }));
  if (String(url).includes('/token')) {
    const body = new URLSearchParams(String(init.body));
    lastTokenRequest = Object.fromEntries(body);
    const b = googleBehaviour;
    // PKCE: the verifier we receive must hash to the challenge that was in the authorize URL.
    if (b.challenge && crypto.createHash('sha256').update(body.get('code_verifier')).digest('base64url') !== b.challenge) {
      return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
    }
    if (body.get('client_secret') !== 'shh' || body.get('code') !== 'good-code') {
      return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
    }
    const claims = {
      iss: 'https://accounts.google.com',
      aud: CLIENT_ID,
      exp: Math.floor(now() / 1000) + 3000,
      email: OWNER,
      email_verified: true,
      name: 'Owner',
      nonce: b.nonce,
      ...(b.claims || {}),
    };
    return new Response(JSON.stringify({ id_token: signIdToken(claims, b.signWith || privateKey, b.kid || 'k1') }));
  }
  throw new Error(`unexpected fetch ${url}`);
}

// ------------------------------------------------------------------ the app under test
let server, base, db, auth, allowed;

before(async () => {
  db = new Database(':memory:');
  initSchema(db);
  allowed = parseAllowedEmails(`${OWNER}`);
  auth = createAuth({
    db,
    google: createGoogleClient({ clientId: CLIENT_ID, clientSecret: 'shh', fetchImpl: fakeFetch, now }),
    allowedEmails: allowed,
    publicUrl: PUBLIC_URL,
    cookieSecure: true,
    now,
  });
  const app = express();
  app.set('trust proxy', 1);
  app.use('/api', auth.middleware); // same order as server/index.js
  app.use('/api', auth.router);
  app.use(express.json({ limit: '50mb' }));
  app.get('/api/health', (_q, r) => r.json({ ok: true }));
  app.get('/api/bootstrap', (_q, r) => r.json({ empty: true }));
  app.put('/api/bootstrap', (q, r) => r.json({ ok: true, bytes: JSON.stringify(q.body).length }));
  app.get('/api/files/:id/content', (_q, r) => r.send('pdf-bytes'));
  app.get('/api/auth/google/url', (_q, r) => r.json({ state: auth.signState({ x: 1 }) }));
  app.get('/api/calendar/feed.ics', (q, r) => (auth.checkFeedKey(q.query.key) ? r.send('BEGIN:VCALENDAR') : r.status(404).send('Not found')));
  await new Promise((ok) => (server = app.listen(0, '127.0.0.1', ok)));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const req = (path, { method = 'GET', headers = {}, body, redirect = 'manual' } = {}) =>
  fetch(base + path, { method, headers, redirect, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });

const bearer = (t) => ({ authorization: `Bearer ${t}` });
const json = { 'content-type': 'application/json' };

/** Drives the whole login: authorize redirect -> Google -> callback. Returns the callback response. */
async function login({ behaviour = {}, code = 'good-code', tamperState = false } = {}) {
  const start = await req('/api/auth/login/google');
  assert.equal(start.status, 302);
  const auth_url = new URL(start.headers.get('location'));
  const q = auth_url.searchParams;
  googleBehaviour = { nonce: q.get('nonce'), challenge: q.get('code_challenge'), ...behaviour };
  const state = tamperState ? 'forged-state' : q.get('state');
  return { start: auth_url, res: await req(`/api/auth/login/google/callback?code=${code}&state=${state}`) };
}
const cookieFrom = (res) => (res.headers.get('set-cookie') || '').split(';')[0];

// ------------------------------------------------------------------ the gate
test('every /api route except the public ones rejects anonymous callers', async () => {
  for (const [method, path] of [['GET', '/api/bootstrap'], ['PUT', '/api/bootstrap'], ['GET', '/api/files/abc/content'], ['GET', '/api/tokens'], ['GET', '/api/auth/google/url'], ['GET', '/api/jira/issues'], ['POST', '/api/ollama'], ['POST', '/api/auth/custom-token']]) {
    const r = await req(path, { method, headers: json, body: method === 'GET' ? undefined : {} });
    assert.equal(r.status, 401, `${method} ${path}`);
    assert.match(r.headers.get('www-authenticate') || '', /Bearer/);
  }
  assert.equal((await req('/api/health')).status, 200);
  const me = await (await req('/api/auth/me')).json();
  assert.equal(me.authenticated, false);
  assert.equal(me.loginAvailable, true);
});

test('feed.ics is only served with the secret key', async () => {
  assert.equal((await req('/api/calendar/feed.ics')).status, 404);
  assert.equal((await req('/api/calendar/feed.ics?key=wrong')).status, 404);
  assert.equal((await req(`/api/calendar/feed.ics?key=${auth.getFeedKey()}`)).status, 200);
});

// ------------------------------------------------------------------ access tokens
test('access tokens: work as bearer, are stored hashed, can be listed', async () => {
  const t = auth.createAccessToken({ name: 'claude-desktop', expiresInDays: 30 });
  assert.match(t.token, /^chlio_pat_[A-Za-z0-9_-]{43}$/);
  const row = db.prepare('SELECT * FROM api_tokens WHERE id = ?').get(t.id);
  assert.equal(row.token_hash, sha256(t.token));
  assert.ok(!JSON.stringify(row).includes(t.token), 'plaintext token must never be stored');

  assert.equal((await req('/api/bootstrap', { headers: bearer(t.token) })).status, 200);
  const list = await (await req('/api/tokens', { headers: bearer(t.token) })).json();
  assert.equal(list.tokens.length >= 1, true);
  assert.ok(!JSON.stringify(list).includes(t.token), 'list must not leak secrets');
});

test('access tokens: a bad, revoked, expired or foreign-prefix token is rejected', async () => {
  assert.equal((await req('/api/bootstrap', { headers: bearer('chlio_pat_' + 'x'.repeat(43)) })).status, 401);
  assert.equal((await req('/api/bootstrap', { headers: bearer('not-a-chlio-token') })).status, 401);

  const t = auth.createAccessToken({ name: 'temp' });
  assert.equal((await req('/api/bootstrap', { headers: bearer(t.token) })).status, 200);
  assert.equal(auth.revokeToken(t.id), 1);
  assert.equal((await req('/api/bootstrap', { headers: bearer(t.token) })).status, 401);

  const e = auth.createAccessToken({ name: 'short', expiresInDays: 1 });
  clock.t += 2 * 24 * 3600 * 1000;
  assert.equal((await req('/api/bootstrap', { headers: bearer(e.token) })).status, 401);
  clock.t -= 2 * 24 * 3600 * 1000;
});

test('read-only tokens cannot write; no token can mint or revoke tokens', async () => {
  const ro = auth.createAccessToken({ name: 'ro', scope: 'read' });
  assert.equal((await req('/api/bootstrap', { headers: bearer(ro.token) })).status, 200);
  assert.equal((await req('/api/bootstrap', { method: 'PUT', headers: { ...json, ...bearer(ro.token) }, body: {} })).status, 403);

  const rw = auth.createAccessToken({ name: 'rw' });
  assert.equal((await req('/api/bootstrap', { method: 'PUT', headers: { ...json, ...bearer(rw.token) }, body: { a: 1 } })).status, 200);
  assert.equal((await req('/api/tokens', { method: 'POST', headers: { ...json, ...bearer(rw.token) }, body: { name: 'evil' } })).status, 403);
  assert.equal((await req(`/api/tokens/${rw.id}`, { method: 'DELETE', headers: bearer(rw.token) })).status, 403);
});

test('a large state save (multi-MB) is not rejected by the auth router', async () => {
  const rw = auth.createAccessToken({ name: 'big' });
  const blob = { notes: 'x'.repeat(3 * 1024 * 1024) };
  const r = await req('/api/bootstrap', { method: 'PUT', headers: { ...json, ...bearer(rw.token) }, body: blob });
  assert.equal(r.status, 200);
});

test('token creation validates input', () => {
  assert.throws(() => auth.createAccessToken({ name: '  ' }), /name/);
  assert.throws(() => auth.createAccessToken({ name: 'a', scope: 'admin' }), /scope/);
  assert.throws(() => auth.createAccessToken({ name: 'a', expiresInDays: -1 }), /expiry/);
});

// ------------------------------------------------------------------ Google login
test('login: redirects to Google with PKCE (S256), state and nonce', async () => {
  const r = await req('/api/auth/login/google');
  assert.equal(r.status, 302);
  const u = new URL(r.headers.get('location'));
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  const q = u.searchParams;
  assert.equal(q.get('client_id'), CLIENT_ID);
  assert.equal(q.get('redirect_uri'), `${PUBLIC_URL}/api/auth/login/google/callback`);
  assert.equal(q.get('code_challenge_method'), 'S256');
  assert.equal(q.get('scope'), 'openid email profile');
  assert.ok(q.get('state').length >= 24 && q.get('nonce') && q.get('code_challenge'));
});

test('login: an allowed account gets an HttpOnly cookie session that works (with CSRF header for writes)', async () => {
  const { res } = await login();
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/');
  const setCookie = res.headers.get('set-cookie');
  assert.match(setCookie, new RegExp(`^${SESSION_COOKIE}=`));
  for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(setCookie.includes(attr), attr);
  const cookie = cookieFrom(res);

  const me = await (await req('/api/auth/me', { headers: { cookie } })).json();
  assert.equal(me.authenticated, true);
  assert.equal(me.user.email, OWNER);
  assert.equal((await req('/api/files/abc/content', { headers: { cookie } })).status, 200); // <img>/PDF loads send no header

  // a cross-site form post carries the cookie but cannot add a custom header -> blocked
  assert.equal((await req('/api/bootstrap', { method: 'PUT', headers: { ...json, cookie }, body: {} })).status, 403);
  assert.equal((await req('/api/bootstrap', { method: 'PUT', headers: { ...json, cookie, origin: 'https://evil.example' }, body: {} })).status, 403);
  assert.equal((await req('/api/bootstrap', { method: 'PUT', headers: { ...json, cookie, [CSRF_HEADER]: '1' }, body: {} })).status, 200);
  // our own origin is accepted without the header (same-origin libraries such as the WebDAV client)
  assert.equal((await req('/api/bootstrap', { method: 'PUT', headers: { ...json, cookie, origin: base }, body: {} })).status, 200);

  // a browser session can mint a token; the token then works on its own
  const made = await req('/api/tokens', { method: 'POST', headers: { ...json, cookie, [CSRF_HEADER]: '1' }, body: { name: 'open-webui', scope: 'write', expiresInDays: 90 } });
  assert.equal(made.status, 201);
  const { token } = await made.json();
  assert.equal((await req('/api/bootstrap', { headers: bearer(token) })).status, 200);
});

test('login: a verified Google account that is NOT on the allow-list is refused', async () => {
  const { res } = await login({ behaviour: { claims: { email: 'stranger@example.com' } } });
  assert.equal(res.headers.get('location'), '/?login_error=not_allowed');
  assert.equal(res.headers.get('set-cookie'), null);
});

test('login: bad ID tokens are refused (nonce, audience, signature, key id, expiry, unverified email)', async () => {
  const cases = {
    'wrong nonce': { nonce: 'attacker-nonce' },
    'wrong audience': { claims: { aud: 'someone-elses-client' } },
    'forged signature': { signWith: otherKey.privateKey },
    'unknown key id': { kid: 'nope' },
    expired: { claims: { exp: Math.floor(now() / 1000) - 3600 } },
    'unverified email': { claims: { email_verified: false } },
    'wrong issuer': { claims: { iss: 'https://evil.example' } },
  };
  for (const [label, behaviour] of Object.entries(cases)) {
    const { res } = await login({ behaviour });
    assert.equal(res.headers.get('location'), '/?login_error=failed', label);
    assert.equal(res.headers.get('set-cookie'), null, label);
  }
});

test('login: state is single-use, must exist, and a wrong code/verifier fails', async () => {
  const { start, res } = await login();
  assert.equal(res.status, 302);
  const replay = await req(`/api/auth/login/google/callback?code=good-code&state=${start.searchParams.get('state')}`);
  assert.equal(replay.headers.get('location'), '/?login_error=expired');

  const forged = await login({ tamperState: true });
  assert.equal(forged.res.headers.get('location'), '/?login_error=expired');

  const badCode = await login({ code: 'attacker-code' });
  assert.equal(badCode.res.headers.get('location'), '/?login_error=failed');

  // PKCE: Google would reject a verifier that doesn't match the challenge
  const s = await req('/api/auth/login/google');
  const q = new URL(s.headers.get('location')).searchParams;
  googleBehaviour = { nonce: q.get('nonce'), challenge: 'a-different-challenge' };
  const mismatch = await req(`/api/auth/login/google/callback?code=good-code&state=${q.get('state')}`);
  assert.equal(mismatch.headers.get('location'), '/?login_error=failed');
});

test('login: return_to cannot be used as an open redirect', async () => {
  for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)']) assert.equal(sanitizeReturnTo(bad), '/', bad);
  assert.equal(sanitizeReturnTo('/#/calendar'), '/#/calendar');
  const start = await req('/api/auth/login/google?return_to=//evil.example');
  const q = new URL(start.headers.get('location')).searchParams;
  googleBehaviour = { nonce: q.get('nonce'), challenge: q.get('code_challenge') };
  const cb = await req(`/api/auth/login/google/callback?code=good-code&state=${q.get('state')}`);
  assert.equal(cb.headers.get('location'), '/');
});

test('sessions: logout ends the session; removing an email from the allow-list revokes live sessions', async () => {
  const { res } = await login();
  const cookie = cookieFrom(res);
  assert.equal((await req('/api/bootstrap', { headers: { cookie } })).status, 200);
  const out = await req('/api/auth/logout', { method: 'POST', headers: { cookie } });
  assert.equal(out.status, 200);
  assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await req('/api/bootstrap', { headers: { cookie } })).status, 401);

  const again = cookieFrom((await login()).res);
  assert.equal((await req('/api/bootstrap', { headers: { cookie: again } })).status, 200);
  allowed.delete(OWNER);
  assert.equal((await req('/api/bootstrap', { headers: { cookie: again } })).status, 401);
  allowed.add(OWNER);
});

test('sessions: expire after 30 days of inactivity', async () => {
  const cookie = cookieFrom((await login()).res);
  assert.equal((await req('/api/bootstrap', { headers: { cookie } })).status, 200);
  clock.t += 31 * 24 * 3600 * 1000;
  assert.equal((await req('/api/bootstrap', { headers: { cookie } })).status, 401);
  clock.t -= 31 * 24 * 3600 * 1000;
});

test('login is disabled (fail closed) with an empty allow-list, but tokens still work', async () => {
  const closed = createAuth({ db, google: createGoogleClient({ clientId: CLIENT_ID, clientSecret: 'shh', fetchImpl: fakeFetch, now }), allowedEmails: new Set(), publicUrl: PUBLIC_URL, now });
  const app = express();
  app.use('/api', closed.middleware);
  app.use('/api', closed.router);
  app.get('/api/bootstrap', (_q, r) => r.json({ ok: true }));
  const s = await new Promise((ok) => { const x = app.listen(0, '127.0.0.1', () => ok(x)); });
  const b = `http://127.0.0.1:${s.address().port}`;
  const r = await fetch(`${b}/api/auth/login/google`, { redirect: 'manual' });
  assert.equal(r.headers.get('location'), '/?login_error=not_configured');
  const t = closed.createAccessToken({ name: 'cli-minted' });
  assert.equal((await fetch(`${b}/api/bootstrap`, { headers: bearer(t.token) })).status, 200);
  s.close();
});

// ------------------------------------------------------------------ helpers
test('signed state: round-trips, rejects tampering and expiry', () => {
  const s = auth.signState({ returnOrigin: PUBLIC_URL });
  assert.equal(auth.verifyState(s).returnOrigin, PUBLIC_URL);
  const [body, sig] = s.split('.');
  const forged = Buffer.from(JSON.stringify({ returnOrigin: 'https://evil.example', exp: now() + 1e6 })).toString('base64url');
  assert.equal(auth.verifyState(`${forged}.${sig}`), null);
  assert.equal(auth.verifyState(`${body}.AAAA`), null);
  assert.equal(auth.verifyState('garbage'), null);
  assert.equal(auth.verifyState(undefined), null);
  clock.t += 11 * 60 * 1000;
  assert.equal(auth.verifyState(s), null);
  clock.t -= 11 * 60 * 1000;
});

test('rate limiter blocks after the limit and recovers after the window', () => {
  let t = 0;
  const limit = createRateLimiter({ windowMs: 1000, max: 3, now: () => t });
  assert.deepEqual([1, 2, 3, 4].map(() => limit('ip')), [true, true, true, false]);
  assert.equal(limit('other-ip'), true);
  t = 1500;
  assert.equal(limit('ip'), true);
});

test('allow-list parsing is case-insensitive and tolerant of separators', () => {
  assert.deepEqual([...parseAllowedEmails(' A@x.com, b@Y.com ;c@z.com\nd@w.com')].sort(), ['a@x.com', 'b@y.com', 'c@z.com', 'd@w.com']);
  assert.equal(parseAllowedEmails('').size, 0);
  assert.equal(parseAllowedEmails(undefined).size, 0);
});
