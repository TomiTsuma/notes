import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const GOOGLE_TOKENS_FILE = path.join(process.env.CLIO_DATA_DIR || './data', 'google_tokens.json');

const getClientId = () => process.env.GOOGLE_CLIENT_ID || '';
const getClientSecret = () => process.env.GOOGLE_CLIENT_SECRET || '';
const getDefaultRedirectUri = () => process.env.GOOGLE_REDIRECT_URI || 'https://chlio.ereuna.org';

export function getGoogleTokens() {
  try {
    if (fs.existsSync(GOOGLE_TOKENS_FILE)) {
      return JSON.parse(fs.readFileSync(GOOGLE_TOKENS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading Google tokens:', err);
  }
  return null;
}

export function saveGoogleTokens(tokens) {
  try {
    const current = getGoogleTokens() || {};
    const merged = { ...current, ...tokens, updatedAt: Date.now() };
    fs.writeFileSync(GOOGLE_TOKENS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  } catch (err) {
    console.error('Error saving Google tokens:', err);
    throw err;
  }
}

export function clearGoogleTokens() {
  try {
    if (fs.existsSync(GOOGLE_TOKENS_FILE)) {
      fs.unlinkSync(GOOGLE_TOKENS_FILE);
    }
    return { ok: true };
  } catch (err) {
    console.error('Error clearing Google tokens:', err);
    return { ok: false };
  }
}

/**
 * Generate Google OAuth 2.0 authorization URL
 */
export function getGoogleAuthUrl(redirectUri = getDefaultRedirectUri(), returnOrigin = process.env.GOOGLE_REDIRECT_URI || 'https://chlio.ereuna.org') {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Google OAuth Client ID is not configured. Please set GOOGLE_CLIENT_ID in your .env file.');
  }

  const scopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ');

  const statePayload = Buffer.from(JSON.stringify({ returnOrigin, redirectUri })).toString('base64url');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
    state: statePayload,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens directly
 */
export async function exchangeGoogleCode(code, redirectUri = getDefaultRedirectUri()) {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials are not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.');
  }

  const tokenParams = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams.toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google token exchange failed (HTTP ${res.status}): ${errorText}`);
  }

  const tokenData = await res.json();
  const expiryDate = Date.now() + (tokenData.expires_in || 3600) * 1000;

  // Fetch user profile email
  let email = '';
  try {
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (profileRes.ok) {
      const profile = await profileRes.json();
      email = profile.email || '';
    }
  } catch (err) {
    console.warn('Failed to fetch user email:', err.message);
  }

  saveGoogleTokens({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expiry_date: expiryDate,
    email,
  });

  return { email, tokenData };
}

/**
 * Exchange authorization code for tokens from server callback
 */
export async function handleGoogleCallback(code, state) {
  let returnOrigin = process.env.GOOGLE_REDIRECT_URI || 'https://chlio.ereuna.org';
  let redirectUri = getDefaultRedirectUri();
  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
      if (decoded.returnOrigin) {
        returnOrigin = decoded.returnOrigin;
      }
      if (decoded.redirectUri) {
        redirectUri = decoded.redirectUri;
      }
    } catch (e) {
      console.warn('Could not decode state param:', e.message);
    }
  }

  const { email } = await exchangeGoogleCode(code, redirectUri);
  return { returnOrigin, email };
}

/**
 * Get valid access token, refreshing if necessary
 */
export async function getValidAccessToken() {
  const tokens = getGoogleTokens();
  if (!tokens || !tokens.access_token) {
    return null;
  }

  // Check if token expires within 2 minutes
  const isExpired = tokens.expiry_date ? Date.now() > tokens.expiry_date - 120000 : false;

  if (!isExpired) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    console.warn('Google access token is expired and no refresh token is available');
    return null;
  }

  // Refresh token
  try {
    const params = new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      console.error('Failed to refresh Google token:', await res.text());
      return null;
    }

    const data = await res.json();
    const expiryDate = Date.now() + (data.expires_in || 3600) * 1000;

    const updated = saveGoogleTokens({
      access_token: data.access_token,
      expiry_date: expiryDate,
    });

    return updated.access_token;
  } catch (err) {
    console.error('Error refreshing Google access token:', err);
    return null;
  }
}

/**
 * Get connection status
 */
export function getGoogleStatus() {
  const tokens = getGoogleTokens();
  if (!tokens || !tokens.access_token) {
    return { connected: false };
  }
  return {
    connected: true,
    email: tokens.email || 'Connected Google Account',
    hasRefreshToken: !!tokens.refresh_token,
  };
}

/**
 * Format an ISO dateTime string in a target IANA timezone without UTC container drift
 */
function formatDateTimeInZone(isoString, timeZone) {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    if (timeZone) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(d);
      const map = {};
      for (const p of parts) map[p.type] = p.value;
      const hour = map.hour === '24' ? '00' : map.hour;
      if (map.year && map.month && map.day && hour && map.minute) {
        return {
          date: `${map.year}-${map.month}-${map.day}`,
          time: `${hour}:${map.minute}`,
        };
      }
    }
  } catch {
    // Fall back to direct ISO parsing below
  }

  // Fallback: extract YYYY-MM-DD and HH:MM directly from the ISO string before any timezone conversion
  const match = String(isoString).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (match) {
    return { date: match[1], time: match[2] };
  }
  return null;
}

/**
 * Fetch all pages of events for a single Google Calendar ID within [min, max]
 */
async function fetchEventsForCalendar(token, calendarId, min, max, clientTimeZone) {
  const items = [];
  let pageToken = null;
  let calTimeZone = null;
  let pages = 0;

  do {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('timeMin', min);
    url.searchParams.set('timeMax', max);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '2500');
    if (clientTimeZone) {
      url.searchParams.set('timeZone', clientTimeZone);
    }
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (calendarId === 'primary') {
        const errorText = await res.text();
        throw new Error(`Failed to fetch Google Calendar events: ${errorText}`);
      }
      break;
    }

    const data = await res.json();
    if (data.timeZone && !calTimeZone) {
      calTimeZone = data.timeZone;
    }
    if (Array.isArray(data.items)) {
      items.push(...data.items);
    }
    pageToken = data.nextPageToken || null;
    pages += 1;
  } while (pageToken && pages < 5);

  return { items, calTimeZone };
}

/**
 * List calendar events across the user's primary and active Google Calendars
 */
export async function getGoogleCalendarEvents(timeMin, timeMax, clientTimeZone) {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error('Not connected to Google Calendar');
  }

  const min = timeMin || new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const max = timeMax || new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();

  // Discover the user's calendars so events on secondary/selected calendars are included
  let calendarsToQuery = [{ id: 'primary', summary: 'Primary', primary: true }];
  try {
    const listRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (listRes.ok) {
      const listData = await listRes.json();
      const discovered = (listData.items || []).filter((cal) => {
        if (!cal || !cal.id) return false;
        if (cal.id.includes('#holiday@') || cal.id.includes('#sports@') || cal.id.includes('addressbook#contacts')) {
          return false;
        }
        if (cal.accessRole === 'freeBusyReader') {
          return false;
        }
        return Boolean(cal.primary || cal.selected || cal.accessRole === 'owner' || cal.accessRole === 'writer');
      });
      if (discovered.length > 0) {
        calendarsToQuery = discovered;
      }
    }
  } catch (err) {
    console.warn('Could not list secondary Google calendars, falling back to primary:', err.message);
  }

  const results = await Promise.all(
    calendarsToQuery.map((cal) =>
      fetchEventsForCalendar(token, cal.id, min, max, clientTimeZone).catch((err) => {
        console.warn(`Skipping calendar ${cal.id}:`, err.message);
        return { items: [], calTimeZone: null };
      })
    )
  );

  const mappedEvents = [];
  const seenKeys = new Set();

  for (const { items, calTimeZone } of results) {
    for (const item of items) {
      if (item.status === 'cancelled') continue;
      // Skip unnamed free/busy blocks from shared calendars
      if (!item.summary && item.visibility === 'private') continue;

      const effectiveTz = clientTimeZone || item.start?.timeZone || calTimeZone || 'UTC';
      const endTz = clientTimeZone || item.end?.timeZone || effectiveTz;

      if (item.start?.dateTime) {
        const startParsed = formatDateTimeInZone(item.start.dateTime, effectiveTz);
        const endParsed = item.end?.dateTime
          ? formatDateTimeInZone(item.end.dateTime, endTz)
          : null;

        const date = startParsed?.date || item.start.dateTime.slice(0, 10);
        const startTime = startParsed?.time || '09:00';
        const endTime = endParsed?.time || '10:00';

        const dedupKey = `${item.iCalUID || item.id}_${date}_${startTime}`;
        if (seenKeys.has(dedupKey)) continue;
        seenKeys.add(dedupKey);

        mappedEvents.push({
          id: `gcal-${item.id}`,
          googleEventId: item.id,
          title: item.summary || '(No title)',
          description: item.description || '',
          date,
          startTime,
          endTime,
          color: 'sky',
          source: 'google',
          completed: false,
          projectId: null,
          htmlLink: item.htmlLink,
          createdAt: item.created || new Date().toISOString(),
        });
      } else if (item.start?.date) {
        const date = item.start.date;
        const dedupKey = `${item.iCalUID || item.id}_${date}_allday`;
        if (seenKeys.has(dedupKey)) continue;
        seenKeys.add(dedupKey);

        mappedEvents.push({
          id: `gcal-${item.id}`,
          googleEventId: item.id,
          title: item.summary || '(No title)',
          description: item.description || '',
          date,
          startTime: '',
          endTime: '',
          color: 'sky',
          source: 'google',
          completed: false,
          projectId: null,
          htmlLink: item.htmlLink,
          createdAt: item.created || new Date().toISOString(),
        });
      }
    }
  }

  mappedEvents.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
  });

  return mappedEvents;
}

/**
 * Create an event in Google Calendar
 */
export async function createGoogleCalendarEvent(eventData) {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error('Not connected to Google Calendar');
  }

  const { title, description, date, startTime, endTime } = eventData;

  const startDateTime = new Date(`${date}T${startTime || '09:00'}:00`).toISOString();
  const endDateTime = new Date(`${date}T${endTime || '10:00'}:00`).toISOString();

  const body = {
    summary: title,
    description: description || 'Created from Clio',
    start: { dateTime: startDateTime },
    end: { dateTime: endDateTime },
  };

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create Google Calendar event: ${errorText}`);
  }

  return await res.json();
}

/**
 * Delete an event from Google Calendar
 */
export async function deleteGoogleCalendarEvent(googleEventId) {
  const token = await getValidAccessToken();
  if (!token) {
    throw new Error('Not connected to Google Calendar');
  }

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 404) {
    const errorText = await res.text();
    throw new Error(`Failed to delete Google Calendar event: ${errorText}`);
  }

  return { ok: true };
}
