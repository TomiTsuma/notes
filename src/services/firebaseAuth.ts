export interface AuthUser {
  uid: string;
  email: string;
  name: string;
  photoURL?: string;
  emailVerified?: boolean;
  provider?: string;
  lastLoginAt?: string;
}

const DEFAULT_FIREBASE_CONFIG = {
  projectId: 'karma-fcf68',
  appId: '1:281104290097:web:9d592b8b8b288fa4bd2010',
  databaseURL: 'https://karma-fcf68-default-rtdb.firebaseio.com',
  storageBucket: 'karma-fcf68.firebasestorage.app',
  apiKey: 'AIzaSyCdNRMBSHzLlqmYwYJv2twiyjX5IBqG75A',
  authDomain: 'karma-fcf68.firebaseapp.com',
  messagingSenderId: '281104290097',
  measurementId: 'G-90GN6XHFLQ',
};

let firebaseRuntimePromise: Promise<{ app: any; auth: any; mod: any }> | null = null;

async function getFirebaseRuntime() {
  if (firebaseRuntimePromise) return firebaseRuntimePromise;

  firebaseRuntimePromise = (async () => {
    let config = DEFAULT_FIREBASE_CONFIG;
    try {
      const res = await fetch('/api/auth/firebase-config');
      if (res.ok) {
        const data = await res.json();
        if (data?.config?.apiKey) {
          config = data.config;
        }
      }
    } catch {
      // use default config
    }

    const appUrl = 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
    const authUrl = 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';

    const appMod: any = await import(/* @vite-ignore */ appUrl);
    const authMod: any = await import(/* @vite-ignore */ authUrl);

    const existingApps = appMod.getApps ? appMod.getApps() : [];
    const app = existingApps.length > 0 ? existingApps[0] : appMod.initializeApp(config);
    const auth = authMod.getAuth(app);

    return { app, auth, mod: authMod };
  })();

  return firebaseRuntimePromise;
}

export async function checkRedirectResultAndVerify(): Promise<AuthUser | null> {
  try {
    const { auth, mod } = await getFirebaseRuntime();
    const result = await mod.getRedirectResult(auth);
    if (result?.user) {
      const idToken = await result.user.getIdToken();
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (verifyRes.ok) {
        const data = await verifyRes.json();
        return data.user || null;
      }
    }
  } catch {
    // ignore redirect check errors
  }
  return null;
}

export async function fetchCurrentAuthUser(): Promise<AuthUser | null> {
  try {
    const redirectUser = await checkRedirectResultAndVerify();
    if (redirectUser) return redirectUser;

    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      if (data?.authenticated && data.user) {
        return data.user;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function signInWithGoogleFirebase(): Promise<AuthUser> {
  try {
    const { auth, mod } = await getFirebaseRuntime();
    const provider = new mod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const result = await mod.signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();

    const verifyRes = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!verifyRes.ok) {
      const err = await verifyRes.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to verify Firebase token on server');
    }
    const data = await verifyRes.json();
    return data.user;
  } catch (err: any) {
    // If popup was blocked on iPad Safari, fall back to Firebase Redirect or Custom Token
    if (
      err?.code === 'auth/popup-blocked' ||
      err?.code === 'auth/operation-not-supported-in-this-environment'
    ) {
      const { auth, mod } = await getFirebaseRuntime();
      const provider = new mod.GoogleAuthProvider();
      await mod.signInWithRedirect(auth, provider);
      throw new Error('Redirecting to Google Sign-In…');
    }
    throw err;
  }
}

export async function signInWithServerCustomToken(email: string, name?: string): Promise<AuthUser> {
  const res = await fetch('/api/auth/custom-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to mint Firebase custom token');
  }
  const data = await res.json();
  if (data.customToken) {
    try {
      const { auth, mod } = await getFirebaseRuntime();
      await mod.signInWithCustomToken(auth, data.customToken);
    } catch {
      // Server already verified and saved session
    }
  }
  return data.user;
}

export async function logoutFirebaseUser(): Promise<void> {
  try {
    const { auth, mod } = await getFirebaseRuntime();
    await mod.signOut(auth);
  } catch {
    // ignore
  }
  await fetch('/api/auth/logout', { method: 'POST' });
}
