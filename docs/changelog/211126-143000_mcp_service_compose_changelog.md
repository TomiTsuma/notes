# Changelog: the MCP server as its own docker-compose service

**Branch:** `feat/auth-gate`. **Builds on:** `211126-124500_mcp_server_changelog.md`.
**Request:** the MCP server should be a service in `docker-compose.yml`, next to the API and the frontend.

## Where things stood

There was one compose service (`clio`): a single Node process serving the built frontend, the REST API and, since the
previous change, `/mcp`. So "API" and "frontend" were never separate containers; the MCP server was inside that process.

## What changed

- **New service `chlio-mcp`** (same image, `command: node server/mcp-server.js`), `depends_on` the app being healthy.
  `server/mcp-server.js` serves only `/mcp` and `/healthz`; tokens are checked against the same `api_tokens` table.
  `server/mcp/wire.js` builds the handler for both modes.
- **Public address unchanged.** `https://chlio.ereuna.org/mcp` is already in Claude Desktop / Open WebUI configs and the
  Cloudflare tunnel points at the app, so the app forwards `/mcp` to the service (`server/mcpProxy.js`, `MCP_UPSTREAM`).
  The request, including its token header, is passed through untouched; the MCP service makes the one authoritative check.
  Unset `MCP_UPSTREAM` and the MCP server runs inside the app process as before.
- **Two processes now share one SQLite file, which exposed a real hazard.** The earlier "atomic" writes relied on a single
  process. Fixed: `mutateState` runs as an IMMEDIATE transaction (takes the write lock before reading), and the browser's save is
  one atomic compare-and-swap (`saveStateIfRevision`), with uploaded-file deletion only after it succeeds. The `revision`
  migration tolerates the two containers starting at the same moment.
- **Least privilege for the new container:** explicit environment (Jira, Google client) instead of the whole `.env`;
  read-only root filesystem, all capabilities dropped, `no-new-privileges`, 512 MB, 256 pids; published on loopback only
  (`MCP_BIND` to open it up).
- **Healthchecks** on both services. Image, container names and ports are variables so a test project cannot collide with production.
- **`X-Chlio-Token` header.** Claude Desktop's custom-connector dialog reserves `Authorization` while sign-in is on. Chlio now accepts
  the same token as `X-Chlio-Token: chlio_pat_...` (API and `/mcp`, same scope rules; never forwarded to Nextcloud).
  (The owner got it working another way; this stays as a tested alternative.)

## Bugs the tests found

| Found by | Bug |
|---|---|
| proxy unit test | The forwarder sent `/mcp/mcp?groups=...` (a route sees the full path, a mounted router does not). Without the test, `?groups=` and all forwarded calls would have failed |
| test run | A test build in the same project re-tagged the production image name; the image name is now a variable |

## Verification (isolated test project on minos: own image, containers, ports, volume, fake credentials)

- 63 server tests, including **900 writes from 6 separate processes with no lost update**, and 6 proxy tests.
- Real MCP client suite through the forwarder: 19/19. Real-browser suite (live update, simultaneous edit with 409 then merge, typed note): 11/11.
- 41 compose-topology checks: both services healthy; MCP container has no Firebase/Nextcloud/allowed-emails variables but has Jira's;
  read-only root, zero capabilities; direct and forwarded access behave the same (401/200/405, `?groups=`, `X-Chlio-Token`);
  a revoked token stops working in the other container; a write in one container is visible in the other and refused/accepted
  correctly by revision; **stopping the MCP container leaves the app, API and frontend healthy, `/mcp` answers 502 with a JSON-RPC
  error, and everything recovers on restart with no data lost**.

## Not done / to know

- **Not deployed to production.** The live stack is still the single `clio-app` container (image `mcp-1`). To switch, on minos in `~/Chlio`:
  `git fetch && git checkout feat/auth-gate`, `npm ci && npm run build` (with `.env` present), `docker compose up -d --build`. Downtime is a few
  seconds; rollback is `git checkout main` plus re-tagging `ttsu/chlio:mcp-1` as `latest`.
- SQLite shared by two containers is a single-host design; see the README for the Postgres note.
