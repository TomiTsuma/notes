# Changelog: authentication gate, Google sign-in, access tokens

**Branch:** `feat/auth-gate` (not merged, not pushed, not deployed)
**Why:** `https://chlio.ereuna.org` served the whole API with no authentication. Anyone with the URL could read
and overwrite all data. The owner also wants to use Chlio from Claude Desktop and Open WebUI, which needs
a long-lived credential that can be revoked.

## Findings in the code that was running (all fixed in this branch)

| # | Finding | Impact |
|---|---|---|
| 1 | No auth middleware at all, only `cors()`. `GET/PUT /api/bootstrap` returned or replaced the entire state (843 KB of notes, papers, chat history). Checked status and size only, never the body. | Anyone could read or wipe everything |
| 2 | `POST /api/auth/custom-token` minted a **valid Firebase ID token for any email** passed in the body, using the service account. Chlio and Lyre share Firebase project `karma-fcf68`, and Lyre accepts any valid token. | Forged identities for the shared project. Not tested live: calling it would create a user in the shared project. |
| 3 | The Nextcloud proxy took its destination from the `x-nextcloud-target-url` header and **injected the stored Nextcloud username and password** when no password was sent. | Pointing the header at any server handed it the Nextcloud login. Not tested live. **Rotate the Nextcloud password.** |
| 4 | The Google Calendar callback also called `saveAuthSession`, so completing that flow with **any** Google account "logged in" the instance, and the OAuth `state` was unsigned. | Account linking / open redirect |
| 5 | `/api/health` returned the internal Ollama URL. `/api/calendar/feed.ics` (events and tasks) was public. Jira create/transition/comment, `/api/ollama` and `/api/calendar/import-ics` (server-side fetch of any URL) were open. | Information leak, free GPU use, SSRF |
| 6 | `ensureAuthorizedDomain` PATCHed the shared Firebase project's authorized domains with whatever `Host` header arrived. | Attacker domains in the shared project |

## What changed

- **`server/auth.js` (new):** one gate on every `/api` route, registered before body parsing. Public routes
  are an explicit list: `GET /api/health`, `GET /api/auth/me`, the two login routes, `POST /api/auth/logout`,
  the calendar-connect callback (signed state), and `feed.ics` (secret key).
- **Browser sign-in:** server-side Google OAuth code flow with PKCE (S256), `state` and `nonce`. It is a
  full-page redirect, not a popup, so it works on iPad Safari and Home-Screen apps (the popup flow is why the
  insecure custom-token workaround existed). The ID token's RS256 signature, issuer, audience, expiry, nonce
  and `email_verified` are checked locally against Google's published keys.
- **Authorisation:** the verified email must be in `CHLIO_ALLOWED_EMAILS`. An empty list means nobody can sign in
  (fail closed). The list is re-checked on every request, so removing an email revokes its sessions.
- **Sessions:** random 256-bit id in an `HttpOnly; Secure; SameSite=Lax` cookie, stored hashed, 30-day sliding
  expiry. A cookie rather than a bearer header, because `<img>` and PDF loads of `/api/files/*` cannot send headers.
- **CSRF:** cookie-authenticated writes need `X-Chlio-Request: 1` or an `Origin` that matches us. There is no CORS.
- **Access tokens (`chlio_pat_...`):** created by a signed-in user in the new Account dialog, or on the host
  with `server/cli.js`. Named, optional expiry, `read` or `write` scope, stored as SHA-256 only, shown once,
  revocable. They authenticate `Authorization: Bearer ...`. A token cannot create or revoke tokens.
- **Calendar feed:** `feed.ics` now needs `?key=<secret>`; `GET /api/calendar/feed-url` returns the full URL.
  **Existing calendar subscriptions to the old URL will stop updating**: re-subscribe with the new URL.
- **Nextcloud proxy:** no longer forwards the session cookie or `chlio_pat_` tokens. The stored
  password is injected only when the target host equals the host in `NEXTCLOUD_URL`.
- **Removed:** `server/firebaseAuth.js`, `/api/auth/{custom-token,verify,firebase-config}`, the client Firebase code
  and the "sign in as any email" form. `cors` dependency. `X-Powered-By`. The Ollama URL in `/api/health`.
- **Frontend:** `AuthGate` (sign-in screen, wraps the whole app so nothing syncs before login),
  a fetch guard (CSRF header, 401 -> sign-in screen), Account dialog with token management.
- **Calendar connect:** the OAuth `state` is now server-signed and expires; origins are checked.

## New configuration (`.env`)

| Variable | Required | Meaning |
|---|---|---|
| `CHLIO_ALLOWED_EMAILS` | yes | Comma-separated Google accounts allowed to sign in |
| `CHLIO_PUBLIC_URL` | recommended | `https://chlio.ereuna.org` (defaults to `GOOGLE_REDIRECT_URI`) |
| `CHLIO_COOKIE_SECURE` | no | `false` only for plain-http local testing |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | yes (already set) | Same client as the calendar integration |

Google Cloud Console: add the **Authorized redirect URI**
`https://chlio.ereuna.org/api/auth/login/google/callback` to that OAuth client.
`FIREBASE_*` variables are no longer used by Chlio and can be removed from `.env`.

## Verification

- 19 server unit tests (`cd server && npm test`, run in node:20): real RSA-signed ID tokens against a fake Google;
  forged signature, wrong audience/nonce/issuer, expired, unverified email, replayed state, PKCE mismatch,
  open redirect, CSRF, expiry, revocation, read-only scope, large state save.
- 61 end-to-end checks against the built Docker image (fake credentials, throwaway volume): every data route
  returns 401 anonymously (including the old token minter), token and cookie flows, feed key, and a header-capturing
  stand-in for Nextcloud proving no cookie or token is forwarded and the stored password goes only to the configured host.
- 18 real-browser checks (Edge, headless): sign-in screen, error message, redirect to Google with PKCE/state/nonce,
  signed-in app, Account dialog, token created from the UI and revealed once, revoke, sign-out.
- **Not tested:** a real Google sign-in. It needs the redirect URI registered, HTTPS, and your Google account.

## Deploy (not done)

```sh
npm ci && npm run build              # the Dockerfile copies the pre-built ./dist
docker build -t ttsu/chlio:auth-gate .
docker push ttsu/chlio:auth-gate     # needs `docker login` as ttsu
# on minos: add CHLIO_ALLOWED_EMAILS / CHLIO_PUBLIC_URL to .env, point the compose image at the new tag, then
docker compose pull && docker compose up -d
docker exec clio-app node server/cli.js token create claude-desktop --days 365   # break-glass / first token
```
Rollback: set the compose image back to the previous tag (`ttsu/chlio:latest` as of 2026-11-08, id `b7f09e1c113c`).
The new tables are additive; the old image ignores them.
