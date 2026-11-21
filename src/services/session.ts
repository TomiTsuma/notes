/**
 * Same-origin API guard, installed once at startup (see main.tsx).
 *
 *  - adds `X-Chlio-Request: 1` to every /api call (the server requires it, or a matching Origin, on
 *    cookie-authenticated writes: a cross-site form or <img> cannot add a custom header);
 *  - makes sure the session cookie is sent;
 *  - turns any 401 from a data route into a `chlio:unauthorized` event so the UI can show the sign-in
 *    screen instead of silently failing (auth routes are excluded: "not signed in" is their normal answer).
 *
 * Patching window.fetch (rather than editing ~50 call sites) also covers libraries that call the global
 * fetch at request time, such as the WebDAV client.
 */
export const UNAUTHORIZED_EVENT = 'chlio:unauthorized';

export function installApiFetchGuard(): void {
  const w = window as unknown as { __chlioFetchGuard?: boolean };
  if (w.__chlioFetchGuard) return;
  w.__chlioFetchGuard = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = url.startsWith(window.location.origin) ? url.slice(window.location.origin.length) : url;
    if (!path.startsWith('/api/')) return originalFetch(input, init);

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set('X-Chlio-Request', '1');
    const response = await originalFetch(input, { ...init, headers, credentials: 'same-origin' });

    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    return response;
  };
}
