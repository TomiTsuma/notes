import React, { useCallback, useEffect, useState } from 'react';
import logoUrl from '../../assets/logo.png';
import { fetchMe, startGoogleLogin } from '../../services/authService';
import { UNAUTHORIZED_EVENT } from '../../services/session';
import { useAppStore } from '../../store/appStore';

type Phase = 'checking' | 'signed-out' | 'signed-in' | 'unreachable';

const LOGIN_ERRORS: Record<string, string> = {
  not_allowed: 'That Google account is not approved for this Chlio. Try a different account.',
  not_configured: 'Sign-in is not configured on this server yet.',
  cancelled: 'Sign-in was cancelled.',
  expired: 'That sign-in attempt expired. Please try again.',
  failed: 'Google sign-in failed. Please try again.',
};

/**
 * Renders the app only for a signed-in user, so no data request (and no state sync) happens before
 * sign-in. The session itself is an HttpOnly cookie set by the server; nothing secret lives in JS.
 */
const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const setAuthUser = useAppStore((s) => s.setAuthUser);
  const [phase, setPhase] = useState<Phase>('checking');
  const [loginAvailable, setLoginAvailable] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const me = await fetchMe();
      setLoginAvailable(me.loginAvailable);
      if (me.authenticated && me.user) {
        setAuthUser({
          uid: me.user.email,
          email: me.user.email,
          name: me.user.name || me.user.email,
          photoURL: me.user.picture,
          provider: 'google.com',
        });
        setPhase('signed-in');
      } else {
        setAuthUser(null);
        setPhase('signed-out');
      }
    } catch {
      setPhase('unreachable');
    }
  }, [setAuthUser]);

  useEffect(() => {
    // Surface the outcome of a failed sign-in (the server redirects back with ?login_error=...).
    const params = new URLSearchParams(window.location.search);
    const code = params.get('login_error');
    if (code) {
      setMessage(LOGIN_ERRORS[code] || LOGIN_ERRORS.failed);
      params.delete('login_error');
      const rest = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
    }
    check();
  }, [check]);

  useEffect(() => {
    const onUnauthorized = () => {
      setMessage('Your session has ended. Please sign in again.');
      setAuthUser(null);
      setPhase('signed-out');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [setAuthUser]);

  if (phase === 'signed-in') return <>{children}</>;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'var(--bg, #f6f4ef)',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        color: 'var(--ink, #1b1a17)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          textAlign: 'center',
          background: 'var(--surface-raised, #ffffff)',
          border: '1px solid var(--line, #e4e0d6)',
          borderRadius: 18,
          boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
          padding: '36px 28px 28px',
        }}
      >
        <img src={logoUrl} alt="Chlio" style={{ width: 64, height: 64, objectFit: 'contain', marginBottom: 12 }} />
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Chlio</h1>
        <p style={{ margin: '6px 0 24px', fontSize: 14, color: 'var(--ink-2, #5b5850)' }}>
          {phase === 'checking' ? 'Checking your session…' : 'Sign in to continue'}
        </p>

        {message && (
          <div
            role="alert"
            style={{
              margin: '0 0 16px',
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--danger, #b42318)',
              fontSize: 13,
              textAlign: 'left',
            }}
          >
            {message}
          </div>
        )}

        {phase === 'unreachable' && (
          <button onClick={() => { setPhase('checking'); check(); }} style={buttonStyle}>
            Can’t reach the server — retry
          </button>
        )}

        {phase === 'signed-out' && loginAvailable && (
          <button onClick={() => startGoogleLogin(window.location.pathname + window.location.hash)} style={buttonStyle}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z" />
            </svg>
            <span>Continue with Google</span>
          </button>
        )}

        {phase === 'signed-out' && !loginAvailable && (
          <p style={{ fontSize: 13, color: 'var(--ink-2, #5b5850)', margin: 0 }}>
            Google sign-in isn’t configured on this server. The administrator needs to set the Google
            client and the list of approved accounts.
          </p>
        )}

        <p style={{ margin: '20px 0 0', fontSize: 11.5, color: 'var(--ink-3, #8a867b)' }}>
          Access is limited to approved Google accounts.
        </p>
      </div>
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  width: '100%',
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid var(--line-strong, #cfcabd)',
  background: 'var(--surface, #fff)',
  color: 'var(--ink, #1b1a17)',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
};

export default AuthGate;
