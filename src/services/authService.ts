export interface AuthUser {
  email: string;
  name: string;
  picture?: string;
  kind?: 'session' | 'token';
  scope?: 'read' | 'write';
}

export interface MeResponse {
  authenticated: boolean;
  /** false when the server has no Google client / empty allow-list (sign-in can't work) */
  loginAvailable: boolean;
  user: AuthUser | null;
}

export interface AccessToken {
  id: string;
  name: string;
  prefix: string;
  scope: 'read' | 'write';
  created_by: string | null;
  created_at: number;
  last_used_at: number | null;
  expires_at: number | null;
  revoked_at: number | null;
  active: boolean;
}

export interface CreatedToken {
  id: string;
  name: string;
  scope: 'read' | 'write';
  token: string; // shown once
  expiresAt: number | null;
}

async function asJson<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || fallback);
  }
  return res.json();
}

export async function fetchMe(): Promise<MeResponse> {
  const res = await fetch('/api/auth/me');
  return asJson<MeResponse>(res, 'Could not check sign-in status');
}

/**
 * Full-page redirect to Google through the server (PKCE + state + nonce). A redirect, not a popup, so it
 * works in iPad Safari and Home-Screen web apps, where popups and third-party storage break.
 */
export function startGoogleLogin(returnTo = '/'): void {
  window.location.href = `/api/auth/login/google?return_to=${encodeURIComponent(returnTo)}`;
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

export async function listAccessTokens(): Promise<AccessToken[]> {
  const res = await fetch('/api/tokens');
  return (await asJson<{ tokens: AccessToken[] }>(res, 'Could not load access tokens')).tokens;
}

export async function createAccessToken(input: {
  name: string;
  scope: 'read' | 'write';
  expiresInDays: number | null;
}): Promise<CreatedToken> {
  const res = await fetch('/api/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return asJson<CreatedToken>(res, 'Could not create the token');
}

export async function revokeAccessToken(id: string): Promise<void> {
  const res = await fetch(`/api/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await asJson(res, 'Could not revoke the token');
}
