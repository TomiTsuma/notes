import type { CalendarEvent } from '../store/appStore';

export interface GoogleStatus {
  connected: boolean;
  email?: string;
  hasRefreshToken?: boolean;
}

export async function fetchGoogleAuthUrl(redirectUri = 'http://localhost:4191'): Promise<string> {
  const res = await fetch(
    `/api/auth/google/url?origin=${encodeURIComponent(window.location.origin)}&redirectUri=${encodeURIComponent(redirectUri)}`
  );
  if (!res.ok) throw new Error('Failed to get Google Auth URL');
  const data = await res.json();
  return data.url;
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri = 'http://localhost:4191'
): Promise<{ ok: boolean; email: string }> {
  const res = await fetch('/api/auth/google/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Token exchange failed' }));
    throw new Error(err.error || 'Token exchange failed');
  }
  return res.json();
}

export async function fetchGoogleStatus(): Promise<GoogleStatus> {
  const res = await fetch('/api/google/status');
  if (!res.ok) throw new Error('Failed to get Google status');
  return res.json();
}

export async function disconnectGoogle(): Promise<void> {
  const res = await fetch('/api/google/disconnect', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to disconnect Google Calendar');
}

export async function fetchGoogleCalendarEvents(timeMin?: string, timeMax?: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams();
  if (timeMin) params.set('timeMin', timeMin);
  if (timeMax) params.set('timeMax', timeMax);

  const res = await fetch(`/api/google/events?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch Google events' }));
    throw new Error(err.error || 'Failed to fetch Google events');
  }
  const data = await res.json();
  return data.events || [];
}

export async function createGoogleCalendarEvent(event: {
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
}): Promise<any> {
  const res = await fetch('/api/google/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create Google event' }));
    throw new Error(err.error || 'Failed to create Google event');
  }
  return res.json();
}

export async function deleteGoogleCalendarEvent(id: string): Promise<void> {
  const res = await fetch(`/api/google/events/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete Google event');
}

export async function importIcsEvents(options: { icsText?: string; url?: string }): Promise<CalendarEvent[]> {
  const res = await fetch('/api/calendar/import-ics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to import iCalendar events' }));
    throw new Error(err.error || 'Failed to import iCalendar events');
  }
  const data = await res.json();
  return data.events || [];
}

export function getIcsFeedUrl(): string {
  return `${window.location.origin}/api/calendar/feed.ics`;
}

export function getIcsExportUrl(): string {
  return `/api/calendar/export.ics`;
}
