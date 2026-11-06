import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = process.env.CLIO_DATA_DIR || path.join(ROOT_DIR, 'data');
const AUTH_SESSION_FILE = path.join(DATA_DIR, 'firebase_auth_session.json');

// Default known config for karma-fcf68 (fetched via service account)
const FALLBACK_WEB_CONFIG = {
  projectId: 'karma-fcf68',
  appId: '1:281104290097:web:9d592b8b8b288fa4bd2010',
  databaseURL: 'https://karma-fcf68-default-rtdb.firebaseio.com',
  storageBucket: 'karma-fcf68.firebasestorage.app',
  apiKey: 'AIzaSyCdNRMBSHzLlqmYwYJv2twiyjX5IBqG75A',
  authDomain: 'karma-fcf68.firebaseapp.com',
  messagingSenderId: '281104290097',
  measurementId: 'G-90GN6XHFLQ',
};

let cachedServiceAccount = null;
let cachedAccessToken = null;
let cachedAccessTokenExpiry = 0;
let cachedWebConfig = null;
const authorizedHostCache = new Set(['localhost', '127.0.0.1', 'chlio.ereuna.org', '100.79.34.33']);

export function loadFirebaseServiceAccount() {
  if (cachedServiceAccount) return cachedServiceAccount;

  const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const candidates = [
    explicitPath,
    path.join(ROOT_DIR, 'karma-fcf68-firebase-adminsdk-jv4hn-00f39145dc.json'),
    path.join(__dirname, 'karma-fcf68-firebase-adminsdk-jv4hn-00f39145dc.json'),
  ].filter(Boolean);

  // Also scan ROOT_DIR for any *-firebase-adminsdk-*.json
  try {
    const files = fs.readdirSync(ROOT_DIR);
    for (const f of files) {
      if (f.includes('firebase-adminsdk') && f.endsWith('.json')) {
        candidates.push(path.join(ROOT_DIR, f));
      }
    }
  } catch {
    // ignore
  }

  for (const filePath of candidates) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (parsed && parsed.project_id && parsed.private_key && parsed.client_email) {
          cachedServiceAccount = parsed;
          return cachedServiceAccount;
        }
      }
    } catch (err) {
      console.warn('Failed to parse Firebase service account file:', filePath, err.message);
    }
  }

  return null;
}

/**
 * Use the Firebase Admin Service Account JSON to mint an OAuth2 access token
 */
export async function getServiceAccountAccessToken() {
  const sa = loadFirebaseServiceAccount();
  if (!sa) {
    throw new Error('Firebase service account JSON file not found');
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && now < cachedAccessTokenExpiry - 60) {
    return cachedAccessToken;
  }

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/firebase',
        'https://www.googleapis.com/auth/identitytoolkit',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
      aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
  ).toString('base64url');

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const signature = signer.sign(sa.private_key, 'base64url');
  const assertion = `${header}.${claim}.${signature}`;

  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Service account token request failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  cachedAccessToken = data.access_token;
  cachedAccessTokenExpiry = now + (data.expires_in || 3600);
  return cachedAccessToken;
}

/**
 * Ensure the given hostname is listed in Firebase Auth's authorizedDomains
 */
export async function ensureAuthorizedDomain(hostname) {
  if (!hostname || authorizedHostCache.has(hostname)) return;
  try {
    const sa = loadFirebaseServiceAccount();
    if (!sa) return;
    const token = await getServiceAccountAccessToken();
    const getRes = await fetch(
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${sa.project_id}/config`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!getRes.ok) return;
    const cfg = await getRes.json();
    const existing = Array.isArray(cfg.authorizedDomains) ? cfg.authorizedDomains : [];
    for (const d of existing) authorizedHostCache.add(d);

    if (!existing.includes(hostname)) {
      const updatedDomains = Array.from(new Set([...existing, hostname, 'chlio.ereuna.org', '100.79.34.33', '127.0.0.1']));
      const patchRes = await fetch(
        `https://identitytoolkit.googleapis.com/admin/v2/projects/${sa.project_id}/config?updateMask=authorizedDomains`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ authorizedDomains: updatedDomains }),
        }
      );
      if (patchRes.ok) {
        authorizedHostCache.add(hostname);
      }
    }
  } catch (err) {
    console.warn('Could not update Firebase authorizedDomains:', err.message);
  }
}

/**
 * Fetch the Firebase Web App config from Firebase Management API using the Service Account JSON
 */
export async function getFirebaseWebConfig(hostname) {
  if (hostname) {
    ensureAuthorizedDomain(hostname).catch(() => {});
  }
  if (cachedWebConfig) return cachedWebConfig;

  try {
    const sa = loadFirebaseServiceAccount();
    if (!sa) return FALLBACK_WEB_CONFIG;

    const token = await getServiceAccountAccessToken();
    const appsRes = await fetch(
      `https://firebase.googleapis.com/v1beta1/projects/${sa.project_id}/webApps`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (appsRes.ok) {
      const appsData = await appsRes.json();
      const firstApp = appsData.apps?.[0];
      if (firstApp?.name) {
        const cfgRes = await fetch(
          `https://firebase.googleapis.com/v1beta1/${firstApp.name}/config`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          cachedWebConfig = {
            projectId: cfg.projectId || sa.project_id,
            appId: cfg.appId || FALLBACK_WEB_CONFIG.appId,
            apiKey: cfg.apiKey || FALLBACK_WEB_CONFIG.apiKey,
            authDomain: cfg.authDomain || `${sa.project_id}.firebaseapp.com`,
            databaseURL: cfg.databaseURL || FALLBACK_WEB_CONFIG.databaseURL,
            storageBucket: cfg.storageBucket || FALLBACK_WEB_CONFIG.storageBucket,
            messagingSenderId: cfg.messagingSenderId || FALLBACK_WEB_CONFIG.messagingSenderId,
            measurementId: cfg.measurementId || FALLBACK_WEB_CONFIG.measurementId,
          };
          return cachedWebConfig;
        }
      }
    }
  } catch (err) {
    console.warn('Falling back to default Firebase web config:', err.message);
  }

  cachedWebConfig = FALLBACK_WEB_CONFIG;
  return cachedWebConfig;
}

/**
 * Mint a Firebase Custom Token using the Service Account RSA private key
 */
export function createFirebaseCustomToken(uid, additionalClaims = {}) {
  const sa = loadFirebaseServiceAccount();
  if (!sa) {
    throw new Error('Firebase service account JSON not loaded');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
      iat: now,
      exp: now + 3600,
      uid: String(uid),
      claims: additionalClaims,
    })
  ).toString('base64url');

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(sa.private_key, 'base64url');
  return `${header}.${payload}.${signature}`;
}

/**
 * Verify a Firebase ID token via Firebase Identity Toolkit using the Service Account / Web API key
 */
export async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing Firebase ID token');
  }

  const webConfig = await getFirebaseWebConfig();
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(webConfig.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Invalid Firebase ID token: ${errText}`);
  }

  const data = await res.json();
  const account = data.users?.[0];
  if (!account) {
    throw new Error('No Firebase user found for token');
  }

  const user = {
    uid: account.localId,
    email: account.email || '',
    name: account.displayName || (account.email ? account.email.split('@')[0] : 'User'),
    photoURL: account.photoUrl || '',
    emailVerified: !!account.emailVerified,
    provider: account.providerUserInfo?.[0]?.providerId || 'google.com',
    lastLoginAt: new Date().toISOString(),
  };

  saveAuthSession(user);
  return user;
}

export function getSavedAuthSession() {
  try {
    if (fs.existsSync(AUTH_SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(AUTH_SESSION_FILE, 'utf8'));
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveAuthSession(user) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(AUTH_SESSION_FILE, JSON.stringify(user, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not save auth session:', err.message);
  }
}

export function clearAuthSession() {
  try {
    if (fs.existsSync(AUTH_SESSION_FILE)) {
      fs.unlinkSync(AUTH_SESSION_FILE);
    }
  } catch {
    // ignore
  }
}
