import React, { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import {
  logout,
  listAccessTokens,
  createAccessToken,
  revokeAccessToken,
  type AccessToken,
  type CreatedToken,
} from '../../services/authService';
import { Button, Icon } from '../UI/clio';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
}

const fmtDate = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

const field: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--line-strong)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  fontSize: 13,
};

/**
 * Account + access tokens. (File keeps its old name to avoid import churn; the old Firebase popup and the
 * "sign in as any email" form are gone. Sign-in itself is the full-page flow in AuthGate.)
 */
const GoogleAuthModal: React.FC<AccountModalProps> = ({ open, onClose }) => {
  const { authUser, setAuthUser } = useAppStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'read' | 'write'>('write');
  const [days, setDays] = useState<string>('90');
  const [created, setCreated] = useState<CreatedToken | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setTokens(await listAccessTokens());
    } catch (err: any) {
      setError(err?.message || 'Could not load access tokens');
    }
  }, []);

  useEffect(() => {
    if (open && authUser) refresh();
    if (!open) {
      setCreated(null); // never keep a shown-once secret around after the dialog closes
      setCopied(false);
      setError(null);
    }
  }, [open, authUser, refresh]);

  if (!open) return null;

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logout();
    } finally {
      setAuthUser(null);
      window.location.reload(); // back to the sign-in screen with a clean in-memory state
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const t = await createAccessToken({ name: name.trim(), scope, expiresInDays: days === 'never' ? null : Number(days) });
      setCreated(t);
      setCopied(false);
      setName('');
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Could not create the token');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (t: AccessToken) => {
    if (!window.confirm(`Revoke "${t.name}"? Anything using it will stop working immediately.`)) return;
    setBusy(true);
    setError(null);
    try {
      await revokeAccessToken(t.id);
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Could not revoke the token');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
    } catch {
      setError('Copy failed. Select the token text and copy it manually.');
    }
  };

  const active = tokens.filter((t) => t.active);

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
          maxWidth: 560,
          maxHeight: '90vh',
          overflowY: 'auto',
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
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Account</h3>
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer', padding: 4 }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {authUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, background: 'var(--surface-inset)', border: '1px solid var(--line)' }}>
            {authUser.photoURL ? (
              <img src={authUser.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#0a7aff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
                {(authUser.name || authUser.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{authUser.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{authUser.email}</div>
            </div>
            <Button variant="secondary" onClick={handleLogout} disabled={busy}>
              Sign out
            </Button>
          </div>
        )}

        {error && (
          <div role="alert" style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger, #ef4444)', fontSize: 12 }}>
            {error}
          </div>
        )}

        <h4 style={{ margin: '22px 0 4px', fontSize: 14 }}>Access tokens</h4>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          For connecting Claude Desktop, Open WebUI or scripts to Chlio. Send a token as{' '}
          <code>Authorization: Bearer &lt;token&gt;</code>. A token is shown <strong>once</strong>; only a hash is kept, so
          create one per app and revoke it if it leaks.
        </p>

        {created && (
          <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              “{created.name}” created. Copy it now; it cannot be shown again.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly value={created.token} onFocus={(e) => e.currentTarget.select()} style={{ ...field, flex: 1, fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }} />
              <Button variant="primary" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleCreate} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Claude Desktop" maxLength={80} style={{ ...field, flex: '1 1 180px' }} />
          <select value={scope} onChange={(e) => setScope(e.target.value as 'read' | 'write')} style={field}>
            <option value="write">Read &amp; write</option>
            <option value="read">Read-only</option>
          </select>
          <select value={days} onChange={(e) => setDays(e.target.value)} style={field}>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">1 year</option>
            <option value="never">No expiry</option>
          </select>
          <Button variant="primary" type="submit" disabled={busy || !name.trim()}>
            Create token
          </Button>
        </form>

        {active.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>No active tokens.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {active.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {t.name}{' '}
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: t.scope === 'read' ? 'rgba(10,122,255,0.12)' : 'rgba(245,158,11,0.15)' }}>
                      {t.scope === 'read' ? 'read-only' : 'read & write'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                    <code>{t.prefix}…</code> · created {fmtDate(t.created_at)} · last used {fmtDate(t.last_used_at)} · expires {t.expires_at ? fmtDate(t.expires_at) : 'never'}
                  </div>
                </div>
                <Button variant="secondary" onClick={() => handleRevoke(t)} disabled={busy}>
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GoogleAuthModal;
