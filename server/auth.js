/**
 * Authentication for Chlio.
 *
 * Two kinds of caller, one gate (`middleware`) in front of every /api route:
 *
 *  1. Browser  -> "Sign in with Google" (server-side OAuth code flow with PKCE + state + nonce, no
 *                 popup, so it also works on iPad Safari / Home-Screen PWAs) -> HttpOnly session cookie.
 *                 A cookie is required (not a bearer header) so <img>/PDF loads of /api/files/* work.
 *  2. Machines -> personal access tokens ("chlio_pat_...") created by a signed-in user in the UI (or by
 *                 the CLI on the host). Used as `Authorization: Bearer ...` (or `X-Chlio-Token: ...`) by Claude Desktop,
 *                 Open WebUI, scripts. Long-lived, named, revocable, optionally read-only.
 *
 * Authorisation: a verified Google email must be in CHLIO_ALLOWED_EMAILS. If that variable is empty
 * nobody can sign in (fail closed); access tokens minted on the host keep working.
 *
 * Everything security-relevant takes its dependencies as arguments (db, google client, clock) so it
 * can be tested without the network (see server/test/auth.test.js).
 */
import crypto from 'node:crypto';
import express from 'express';

const DAY_MS = 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'chlio_session';
export const SESSION_TTL_MS = 30 * DAY_MS;
const FLOW_TTL_MS = 10 * 60 * 1000;
export const TOKEN_PREFIX = 'chlio_pat_';
export const CSRF_HEADER = 'x-chlio-request';

// ---------------------------------------------------------------- small helpers
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * The machine credential, or null if the request carries none. It may arrive as `Authorization: Bearer <token>`
 * or, for clients that are not allowed to use the Authorization header name (e.g. Claude Desktop's custom
 * connector dialog reserves it while sign-in is on), as `X-Chlio-Token: <token>`. Either way it is the same
 * `chlio_pat_...` token, checked the same way.
 */
export function presentedToken(req) {
  const auth = req.headers.authorization || '';
  if (/^bearer /i.test(auth)) return auth.slice(7).trim();
  const x = req.headers['x-chlio-token'];
  if (typeof x === 'string' && x.trim()) return x.trim().replace(/^bearer\s+/i, '');
  return null;
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** Only same-site relative paths are allowed as post-login destinations (no open redirect). */
export function sanitizeReturnTo(value) {
  const v = typeof value === 'string' ? value : '';
  return v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') && !/[\r\n]/.test(v) ? v : '/';
}

/** Tiny fixed-window limiter, enough to blunt token guessing / login hammering on a single node. */
export function createRateLimiter({ windowMs, max, now = Date.now }) {
  const hits = new Map();
  return (key) => {
    const t = now();
    const entry = hits.get(key);
    if (!entry || t - entry.start >= windowMs) {
      hits.set(key, { start: t, count: 1 });
      if (hits.size > 5000) for (const [k, v] of hits) if (t - v.start >= windowMs) hits.delete(k);
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  };
}

export function parseAllowedEmails(raw) {
  return new Set(
    String(raw || '')
      .split(/[,\s;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

// ---------------------------------------------------------------- Google (OIDC) client
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

/**
 * Minimal OpenID Connect client for Google: builds the auth URL, exchanges the code (with the PKCE
 * verifier + client secret) and verifies the returned ID token's signature and claims locally.
 */
export function createGoogleClient({ clientId, clientSecret, fetchImpl = fetch, now = Date.now }) {
  let jwksCache = { keys: null, fetchedAt: 0 };

  async function getJwks(force = false) {
    if (!force && jwksCache.keys && now() - jwksCache.fetchedAt < 6 * 60 * 60 * 1000) return jwksCache.keys;
    const res = await fetchImpl(GOOGLE_JWKS_URL);
    if (!res.ok) throw new Error(`Could not fetch Google signing keys (${res.status})`);
    const body = await res.json();
    jwksCache = { keys: body.keys || [], fetchedAt: now() };
    return jwksCache.keys;
  }

  async function verifyIdToken(idToken, expectedNonce) {
    const parts = String(idToken || '').split('.');
    if (parts.length !== 3) throw new Error('Malformed ID token');
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (header.alg !== 'RS256') throw new Error('Unexpected ID token algorithm');

    let jwk = (await getJwks()).find((k) => k.kid === header.kid);
    if (!jwk) jwk = (await getJwks(true)).find((k) => k.kid === header.kid); // key rotation
    if (!jwk) throw new Error('Unknown ID token signing key');

    const ok = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      crypto.createPublicKey({ key: jwk, format: 'jwk' }),
      Buffer.from(parts[2], 'base64url')
    );
    if (!ok) throw new Error('Invalid ID token signature');

    const nowSec = Math.floor(now() / 1000);
    if (!['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss)) throw new Error('Bad ID token issuer');
    if (claims.aud !== clientId) throw new Error('ID token audience mismatch');
    if (!claims.exp || claims.exp < nowSec - 30) throw new Error('ID token expired');
    if (expectedNonce && claims.nonce !== expectedNonce) throw new Error('ID token nonce mismatch');
    if (claims.email_verified !== true && claims.email_verified !== 'true') throw new Error('Google email is not verified');
    if (!claims.email) throw new Error('ID token has no email');
    return {
      email: String(claims.email).toLowerCase(),
      name: claims.name || String(claims.email).split('@')[0],
      picture: claims.picture || '',
    };
  }

  return {
    isConfigured: () => Boolean(clientId && clientSecret),
    buildAuthUrl({ redirectUri, state, nonce, codeChallenge }) {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      });
      return `${GOOGLE_AUTH_URL}?${params}`;
    },
    async exchangeCode({ code, redirectUri, codeVerifier }) {
      const res = await fetchImpl(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.id_token) throw new Error(`Google token exchange failed (${res.status})`);
      return body.id_token;
    },
    verifyIdToken,
  };
}

// ---------------------------------------------------------------- the auth module
/**
 * @param {object} opts
 * @param {import('better-sqlite3').Database} opts.db
 * @param {ReturnType<typeof createGoogleClient>} opts.google
 * @param {Set<string>} opts.allowedEmails
 * @param {string} opts.publicUrl      e.g. https://chlio.ereuna.org (used for the OAuth redirect URI)
 * @param {boolean} [opts.cookieSecure]
 */
export function createAuth({ db, google, allowedEmails, publicUrl, cookieSecure = true, now = Date.now }) {
  const baseUrl = String(publicUrl || '').replace(/\/+$/, '');
  const loginCallbackUrl = `${baseUrl}/api/auth/login/google/callback`;
  const failureLimiter = createRateLimiter({ windowMs: 60_000, max: 30, now });
  const loginLimiter = createRateLimiter({ windowMs: 60_000, max: 20, now });
  const stmt = {
    insSession: db.prepare('INSERT INTO auth_sessions (id_hash,email,name,picture,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?,?,?)'),
    getSession: db.prepare('SELECT * FROM auth_sessions WHERE id_hash = ?'),
    touchSession: db.prepare('UPDATE auth_sessions SET last_seen_at = ?, expires_at = ? WHERE id_hash = ?'),
    delSession: db.prepare('DELETE FROM auth_sessions WHERE id_hash = ?'),
    purgeSessions: db.prepare('DELETE FROM auth_sessions WHERE expires_at < ?'),
    insFlow: db.prepare('INSERT INTO auth_flows (state_hash,code_verifier,nonce,return_to,expires_at) VALUES (?,?,?,?,?)'),
    getFlow: db.prepare('SELECT * FROM auth_flows WHERE state_hash = ?'),
    delFlow: db.prepare('DELETE FROM auth_flows WHERE state_hash = ?'),
    purgeFlows: db.prepare('DELETE FROM auth_flows WHERE expires_at < ?'),
    insToken: db.prepare('INSERT INTO api_tokens (id,name,token_hash,prefix,scope,created_by,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)'),
    getTokenByHash: db.prepare('SELECT * FROM api_tokens WHERE token_hash = ?'),
    touchToken: db.prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?'),
    listTokens: db.prepare('SELECT id,name,prefix,scope,created_by,created_at,last_used_at,expires_at,revoked_at FROM api_tokens ORDER BY created_at DESC'),
    revokeToken: db.prepare('UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL'),
    getSetting: db.prepare('SELECT value FROM kv_settings WHERE key = ?'),
    setSetting: db.prepare('INSERT INTO kv_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
  };

  // ------------------------------------------------------------ sessions
  function createSession(user) {
    const id = randomToken(32);
    const t = now();
    stmt.insSession.run(sha256(id), user.email, user.name || '', user.picture || '', t, t, t + SESSION_TTL_MS);
    stmt.purgeSessions.run(t);
    return id;
  }

  function sessionCookie(value, maxAgeSec) {
    const attrs = [`${SESSION_COOKIE}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
    if (cookieSecure) attrs.push('Secure');
    return attrs.join('; ');
  }

  // ------------------------------------------------------------ access tokens
  function createAccessToken({ name, scope = 'write', createdBy = 'cli', expiresInDays = null }) {
    const cleanName = String(name || '').trim().slice(0, 80);
    if (!cleanName) throw new Error('A token name is required');
    if (!['read', 'write'].includes(scope)) throw new Error("scope must be 'read' or 'write'");
    const days = expiresInDays == null || expiresInDays === '' ? null : Number(expiresInDays);
    if (days !== null && (!Number.isFinite(days) || days <= 0 || days > 3650)) throw new Error('Invalid expiry');
    const secret = TOKEN_PREFIX + randomToken(32);
    const id = crypto.randomUUID();
    const t = now();
    stmt.insToken.run(id, cleanName, sha256(secret), secret.slice(0, TOKEN_PREFIX.length + 6), scope, createdBy, t, days === null ? null : t + days * DAY_MS);
    return { id, name: cleanName, scope, token: secret, prefix: secret.slice(0, TOKEN_PREFIX.length + 6), expiresAt: days === null ? null : t + days * DAY_MS };
  }

  // ------------------------------------------------------------ resolving the caller
  /** Returns { kind:'session'|'token', user:{email,name,picture}, scope, tokenId? } or null. */
  function authenticate(req) {
    const presented = presentedToken(req);
    if (presented !== null) {
      if (!presented.startsWith(TOKEN_PREFIX)) return null;
      const row = stmt.getTokenByHash.get(sha256(presented));
      if (!row || row.revoked_at || (row.expires_at && row.expires_at < now())) return null;
      if (!row.last_used_at || now() - row.last_used_at > 60_000) stmt.touchToken.run(now(), row.id);
      return { kind: 'token', user: { email: row.created_by || 'token', name: row.name, picture: '' }, scope: row.scope, tokenId: row.id };
    }
    const sid = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!sid) return null;
    const row = stmt.getSession.get(sha256(sid));
    if (!row || row.expires_at < now()) return null;
    // Re-check the allow-list on every request so removing an email revokes existing sessions.
    if (!allowedEmails.has(row.email)) return null;
    if (row.expires_at - now() < SESSION_TTL_MS / 2) stmt.touchSession.run(now(), now() + SESSION_TTL_MS, row.id_hash);
    return { kind: 'session', user: { email: row.email, name: row.name, picture: row.picture }, scope: 'write', sessionId: sid };
  }

  function isSameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return false;
    return origin === baseUrl || origin === `${req.protocol}://${req.headers.host}`;
  }

  const clientIp = (req) => req.headers['cf-connecting-ip'] || req.ip || req.socket?.remoteAddress || 'unknown';

  // Paths that must work without credentials (exact match on method + path).
  const PUBLIC = new Set([
    'GET /api/health',
    'GET /api/auth/me',
    'GET /api/auth/login/google',
    'GET /api/auth/login/google/callback',
    'POST /api/auth/logout',
    'GET /api/auth/google/callback', // calendar-connect redirect; protected by a signed state, see googleCalendar
    'GET /api/calendar/feed.ics', // protected by its own secret key, checked in the route
  ]);
  const MAY_USE_COOKIE_ONLY = [/^\/api\/tokens(\/|$)/]; // minting/revoking tokens needs a browser session

  /** Express middleware: mounted on /api BEFORE body parsing. */
  function middleware(req, res, next) {
    const path = req.baseUrl + req.path;
    req.auth = authenticate(req);

    if (PUBLIC.has(`${req.method} ${path}`)) return next();

    if (!req.auth) {
      if (presentedToken(req) !== null && !failureLimiter(clientIp(req))) {
        return res.status(429).json({ error: 'Too many failed attempts' });
      }
      res.setHeader('WWW-Authenticate', 'Bearer realm="chlio"');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (req.auth.kind === 'token') {
      if (req.auth.scope === 'read' && unsafe) return res.status(403).json({ error: 'This token is read-only' });
      if (MAY_USE_COOKIE_ONLY.some((re) => re.test(path)) && unsafe) {
        return res.status(403).json({ error: 'Tokens can only be created or revoked from a signed-in browser session' });
      }
    } else if (unsafe && req.headers[CSRF_HEADER] !== '1' && !isSameOrigin(req)) {
      // Cookie-authenticated writes must come from our own pages: either carry a header a cross-site
      // form/<img> can't add (no CORS here, so a cross-site fetch can't either), or an Origin that is us.
      // (SameSite=Lax on the cookie is the first line of defence; this is the second.)
      return res.status(403).json({ error: 'Cross-site request blocked' });
    }
    next();
  }

  /**
   * Gate for machine endpoints (/mcp): ONLY access tokens are accepted. A browser cookie is deliberately
   * refused, so a malicious web page can never drive tools with the signed-in user's ambient session.
   */
  function tokenGate(req, res, next) {
    const a = authenticate(req);
    if (!a || a.kind !== 'token') {
      if (presentedToken(req) !== null && !failureLimiter(clientIp(req))) {
        return res.status(429).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Too many failed attempts' }, id: null });
      }
      res.setHeader('WWW-Authenticate', 'Bearer realm="chlio-mcp"');
      return res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'A Chlio access token is required (Authorization: Bearer chlio_pat_..., or X-Chlio-Token: chlio_pat_...)' }, id: null });
    }
    if (req.headers.origin && !isSameOrigin(req)) {
      return res.status(403).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Cross-origin requests are not allowed' }, id: null });
    }
    req.auth = a;
    next();
  }

  // ------------------------------------------------------------ routes (mounted at /api)
  const router = express.Router();
  // NB: no router-wide body parser here. This router is mounted on /api, so a router.use() parser would
  // also run for (and cap the size of) routes it doesn't own, e.g. the multi-MB state sync.

  router.get('/auth/me', (req, res) => {
    const a = req.auth;
    res.json({
      ok: true,
      authenticated: Boolean(a),
      loginAvailable: google.isConfigured() && allowedEmails.size > 0,
      user: a ? { ...a.user, kind: a.kind, scope: a.scope } : null,
    });
  });

  router.get('/auth/login/google', (req, res) => {
    if (!loginLimiter(clientIp(req))) return res.status(429).send('Too many login attempts, try again in a minute');
    if (!google.isConfigured() || allowedEmails.size === 0) {
      return res.redirect('/?login_error=not_configured');
    }
    const state = randomToken(24);
    const nonce = randomToken(16);
    const codeVerifier = randomToken(48);
    stmt.purgeFlows.run(now());
    stmt.insFlow.run(sha256(state), codeVerifier, nonce, sanitizeReturnTo(req.query.return_to), now() + FLOW_TTL_MS);
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    res.redirect(google.buildAuthUrl({ redirectUri: loginCallbackUrl, state, nonce, codeChallenge }));
  });

  router.get('/auth/login/google/callback', async (req, res) => {
    const fail = (code) => res.redirect(`/?login_error=${code}`);
    try {
      if (req.query.error) return fail('cancelled');
      const { code, state } = req.query;
      if (typeof code !== 'string' || typeof state !== 'string') return fail('failed');
      const flow = stmt.getFlow.get(sha256(state));
      stmt.delFlow.run(sha256(state)); // single use
      if (!flow || flow.expires_at < now()) return fail('expired');

      const idToken = await google.exchangeCode({ code, redirectUri: loginCallbackUrl, codeVerifier: flow.code_verifier });
      const user = await google.verifyIdToken(idToken, flow.nonce);
      if (!allowedEmails.has(user.email)) {
        console.warn(`[auth] rejected sign-in from non-allowed account ${user.email}`);
        return fail('not_allowed');
      }
      const sid = createSession(user);
      res.setHeader('Set-Cookie', sessionCookie(sid, Math.floor(SESSION_TTL_MS / 1000)));
      console.log(`[auth] signed in ${user.email}`);
      res.redirect(sanitizeReturnTo(flow.return_to));
    } catch (err) {
      console.warn('[auth] login callback failed:', err.message);
      fail('failed');
    }
  });

  router.post('/auth/logout', (req, res) => {
    const sid = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (sid) stmt.delSession.run(sha256(sid));
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    res.json({ ok: true });
  });

  router.get('/tokens', (_req, res) => {
    res.json({ ok: true, tokens: stmt.listTokens.all().map((t) => ({ ...t, active: !t.revoked_at && (!t.expires_at || t.expires_at > now()) })) });
  });

  router.post('/tokens', express.json({ limit: '16kb' }), (req, res) => {
    try {
      const { name, scope, expiresInDays } = req.body || {};
      res.status(201).json({ ok: true, ...createAccessToken({ name, scope, expiresInDays, createdBy: req.auth.user.email }) });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/tokens/:id', (req, res) => {
    const changed = stmt.revokeToken.run(now(), req.params.id).changes;
    res.status(changed ? 200 : 404).json(changed ? { ok: true } : { error: 'Token not found or already revoked' });
  });

  // ------------------------------------------------------------ signed state + feed key
  function getOrCreateSecret(key) {
    const row = stmt.getSetting.get(key);
    if (row) return row.value;
    const v = randomToken(32);
    stmt.setSetting.run(key, v);
    return v;
  }

  const hmac = (data) => crypto.createHmac('sha256', getOrCreateSecret('state_hmac_key')).update(data).digest('base64url');

  /** Server-signed, expiring blob for OAuth `state` params (calendar connect). */
  function signState(payload, ttlMs = FLOW_TTL_MS) {
    const body = Buffer.from(JSON.stringify({ ...payload, exp: now() + ttlMs, n: randomToken(8) })).toString('base64url');
    return `${body}.${hmac(body)}`;
  }
  function verifyState(state) {
    const [body, sig] = String(state || '').split('.');
    if (!body || !sig || !safeEqual(sig, hmac(body))) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      return payload.exp > now() ? payload : null;
    } catch {
      return null;
    }
  }

  const getFeedKey = () => getOrCreateSecret('ics_feed_key');
  const checkFeedKey = (presented) => typeof presented === 'string' && safeEqual(presented, getFeedKey());

  return { middleware, tokenGate, router, createAccessToken, signState, verifyState, getFeedKey, checkFeedKey, authenticate, listTokens: () => stmt.listTokens.all(), revokeToken: (id) => stmt.revokeToken.run(now(), id).changes };
}
