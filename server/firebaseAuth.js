import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(ROOT_DIR, '.env') });
dotenv.config();

const DATA_DIR = process.env.CLIO_DATA_DIR || path.join(ROOT_DIR, 'data');
const AUTH_SESSION_FILE = path.join(DATA_DIR, 'firebase_auth_session.json');

function getEnvWebConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID || '';
  return {
    projectId,
    appId: process.env.FIREBASE_APP_ID || '',
    databaseURL: process.env.FIREBASE_DATABASE_URL || (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : ''),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || (projectId ? `${projectId}.firebasestorage.app` : ''),
    apiKey: process.env.FIREBASE_WEB_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : ''),
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || '',
  };
}

let cachedServiceAccount = null;
let cachedAccessToken = null;
let cachedAccessTokenExpiry = 0;
let cachedWebConfig = null;
const authorizedHostCache = new Set(['localhost', '127.0.0.1', 'chlio.ereuna.org', '100.79.34.33']);

export function loadFirebaseServiceAccount() {
  if (cachedServiceAccount) return cachedServiceAccount;

  // 1. Primary: Read from .env variables (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL)
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
  ) {
    cachedServiceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID.trim(),
      private_key_id: (process.env.FIREBASE_PRIVATE_KEY_ID || '').trim(),
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL.trim(),
      client_id: (process.env.FIREBASE_CLIENT_ID || '').trim(),
      token_uri: (process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token').trim(),
    };
    return cachedServiceAccount;
  }

  // 2. Secondary: Read from inline JSON string in .env if provided
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (parsed?.project_id && parsed?.private_key && parsed?.client_email) {
        parsed.private_key = String(parsed.private_key).replace(/\\n/g, '\n');
        cachedServiceAccount = parsed;
        return cachedServiceAccount;
      }
    } catch (err) {
      console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON from .env:', err.message);
    }
  }

  // 3. Fallback: Read from explicit path in .env if provided
  const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (explicitPath && fs.existsSync(explicitPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(explicitPath, 'utf8'));
      if (parsed?.project_id && parsed?.private_key && parsed?.client_email) {
        cachedServiceAccount = parsed;
        return cachedServiceAccount;
      }
    } catch (err) {
      console.warn('Failed to parse Firebase service account file:', explicitPath, err.message);
    }
  }

  return null;
}

/**
 * Use the Firebase Admin Service Account from .env to mint an OAuth2 access token
 */
export async function getServiceAccountAccessToken() {
  const sa = loadFirebaseServiceAccount();
  if (!sa) {
    throw new Error('Firebase service account credentials not configured in .env');
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
 * Fetch the Firebase Web App config from .env or Firebase Management API
 */
export async function getFirebaseWebConfig(hostname) {
  if (hostname) {
    ensureAuthorizedDomain(hostname).catch(() => {});
  }
  if (cachedWebConfig) return cachedWebConfig;

  const envConfig = getEnvWebConfig();
  if (envConfig.projectId && envConfig.apiKey && envConfig.appId) {
    cachedWebConfig = envConfig;
    return cachedWebConfig;
  }

  try {
    const sa = loadFirebaseServiceAccount();
    if (!sa) return envConfig;

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
            appId: cfg.appId || envConfig.appId,
            apiKey: cfg.apiKey || envConfig.apiKey,
            authDomain: cfg.authDomain || `${sa.project_id}.firebaseapp.com`,
            databaseURL: cfg.databaseURL || envConfig.databaseURL,
            storageBucket: cfg.storageBucket || envConfig.storageBucket,
            messagingSenderId: cfg.messagingSenderId || envConfig.messagingSenderId,
            measurementId: cfg.measurementId || envConfig.measurementId,
          };
          return cachedWebConfig;
        }
      }
    }
  } catch (err) {
    console.warn('Falling back to .env Firebase web config:', err.message);
  }

  cachedWebConfig = envConfig;
  return cachedWebConfig;
}

/**
 * Mint a Firebase Custom Token using the Service Account RSA private key
 */
export function createFirebaseCustomToken(uid, additionalClaims = {}) {
  const sa = loadFirebaseServiceAccount();
  if (!sa) {
    throw new Error('Firebase service account credentials not configured in .env');
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
