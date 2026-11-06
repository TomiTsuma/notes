import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import {
  signInWithGoogleFirebase,
  signInWithServerCustomToken,
  logoutFirebaseUser,
} from '../../services/firebaseAuth';
import { Button, Icon } from '../UI/clio';

interface GoogleAuthModalProps {
  open: boolean;
  onClose: () => void;
}

const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({ open, onClose }) => {
  const { authUser, setAuthUser } = useAppStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customEmail, setCustomEmail] = useState(
    import.meta.env.VITE_USER_EMAIL || ''
  );
  const [customName, setCustomName] = useState(import.meta.env.VITE_USER_NAME || '');

  if (!open) return null;

  const handleFirebaseGoogleSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const user = await signInWithGoogleFirebase();
      setAuthUser(user);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Google Sign-In failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCustomTokenSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const user = await signInWithServerCustomToken(customEmail.trim(), customName.trim());
      setAuthUser(user);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Firebase Custom Token sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logoutFirebaseUser();
      setAuthUser(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9500,
        background: 'rgba(15, 14, 12, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--surface-raised, #ffffff)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
          padding: 24,
          fontFamily: 'var(--font-sans)',
          color: 'var(--ink)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(10, 122, 255, 0.12)',
                color: '#0a7aff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
              }}
            >
              G
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Google Authentication</h3>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                Firebase Auth · Server-configured (.env)
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--ink-2)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {authUser ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                borderRadius: 12,
                background: 'var(--surface-inset)',
                border: '1px solid var(--line)',
              }}
            >
              {authUser.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt={authUser.name}
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: '#0a7aff',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  {(authUser.name || authUser.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{authUser.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {authUser.email}
                </div>
                <div style={{ fontSize: 11, color: '#10b981', marginTop: 2, fontWeight: 600 }}>
                  ✓ Verified via Firebase Admin SDK
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" onClick={onClose}>
                Done
              </Button>
              <Button variant="primary" onClick={handleLogout} disabled={busy}>
                Sign Out
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--danger, #ef4444)',
                  fontSize: 12,
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={handleFirebaseGoogleSignIn}
              disabled={busy}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                width: '100%',
                padding: '11px 16px',
                borderRadius: 10,
                border: '1px solid var(--line-strong)',
                background: 'var(--surface)',
                color: 'var(--ink)',
                fontSize: 14,
                fontWeight: 600,
                cursor: busy ? 'wait' : 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                />
              </svg>
              <span>{busy ? 'Signing in…' : 'Continue with Google (Popup)'}</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Or Instant Server Key Sign-In (iPad Safari)
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>

            <form onSubmit={handleCustomTokenSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Display Name"
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-inset)',
                    color: 'var(--ink)',
                    fontSize: 13,
                  }}
                />
                <input
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="Google Email"
                  style={{
                    flex: 1.5,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-inset)',
                    color: 'var(--ink)',
                    fontSize: 13,
                  }}
                />
              </div>
              <Button variant="primary" type="submit" disabled={busy}>
                Authenticate with Firebase Admin Key
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleAuthModal;

