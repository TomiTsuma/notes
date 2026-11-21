# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Docker

This repository can be built as a Docker image for deployment or Docker Hub publishing.

Build the image:

```bash
docker build -t clio-app .
```

Run the container locally:

```bash
docker run --rm -p 8080:80 clio-app
```

Open http://localhost:8080 in your browser.

If you want to publish to Docker Hub, tag and push the image:

```bash
docker tag clio-app your-dockerhub-username/clio:latest
docker push your-dockerhub-username/clio:latest
```

## Authentication

Every `/api` route requires a signed-in browser session or an access token (see
`server/auth.js` and `docs/changelog/*_auth_gate_changelog.md`). Only the static app, `GET /api/health`,
the sign-in routes and the secret-keyed calendar feed are public.

- **Browser:** "Continue with Google" (server-side OAuth code flow with PKCE, a full-page redirect so it
  works on iPad). Only emails in `CHLIO_ALLOWED_EMAILS` get in. The session is an HttpOnly cookie.
- **Machines (Claude Desktop, Open WebUI, scripts):** create a token in **Account → Access tokens**, or on the host:
  `docker exec clio-app node server/cli.js token create <name> [--scope read|write] [--days N]`.
  Use it as `Authorization: Bearer chlio_pat_...`. Tokens are shown once, stored hashed, and can be revoked.
- **Required `.env`:** `CHLIO_ALLOWED_EMAILS`, `CHLIO_PUBLIC_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
  Register `https://<your host>/api/auth/login/google/callback` as an authorized redirect URI on the Google client.
- **Tests:** `cd server && npm install && npm test` (needs `better-sqlite3`; run it in the node:20 image).
- **Locked out?** Anyone who can `docker exec` on the host can mint a token with the CLI above.

## MCP server (Claude Desktop, Claude Code, Open WebUI)

`POST https://<host>/mcp`: Streamable HTTP, stateless, **access tokens only** (create one under Account ->
Access tokens; a browser session is refused). Pick tool groups with `?groups=`: `mindmaps`, `planner`, `notes`,
`jira`, `search` (default all, about 4.2k tokens of tool schema; `mindmaps` alone is about 1.7k). A read-only token
sees only the read tools. Full tool list and design: `docs/changelog/*_mcp_server_changelog.md`.

**Claude Desktop** (`claude_desktop_config.json`; keep spaces out of the argument, the header comes from `env`):

```json
{ "mcpServers": { "chlio": {
    "command": "npx",
    "args": ["-y", "mcp-remote", "https://chlio.ereuna.org/mcp", "--header", "Authorization:${AUTH_HEADER}"],
    "env": { "AUTH_HEADER": "Bearer chlio_pat_..." } } } }
```

**Claude Code:** `claude mcp add --transport http chlio https://chlio.ereuna.org/mcp --header "Authorization: Bearer chlio_pat_..."`

**Open WebUI:** Admin -> Settings -> External Tools -> add a server of type *MCP (Streamable HTTP)*, URL
`https://chlio.ereuna.org/mcp?groups=mindmaps,planner,search`, auth *Bearer*, key = the token.

Try: *"Make a mind map of this paper's argument"*, *"Add a task to project X due Friday"*,
*"What do my notes say about codebooks?"*. Changes made through MCP appear in an open Chlio tab within ~10 seconds.

**How it stays consistent with the browser:** the saved state has a revision; the browser saves with `If-Match` and
merges (three-way, per item) if someone else saved first, and polls for outside changes. See `src/utils/stateMerge.ts`.

## Docker Compose: the app and the MCP server as separate services

`docker-compose.yml` defines two services built from **one image** (`ttsu/chlio`):

| Service | Container | Runs | Published |
|---|---|---|---|
| `clio` | `clio-app` | the built frontend (static files) and the REST API: `node server/index.js` | `PORT` (4191), the one the Cloudflare tunnel points at |
| `chlio-mcp` | `clio-mcp` | the MCP server only: `node server/mcp-server.js` (serves `/mcp` and `/healthz`) | `127.0.0.1:MCP_PORT` (4192) only |

`/mcp` on the public address still works unchanged: the app forwards it to `chlio-mcp` (`MCP_UPSTREAM`), and the MCP
service does the token check. If the MCP container is down, `/mcp` answers `502` and everything else keeps working.
Remove `MCP_UPSTREAM` from the `clio` service to run the MCP server inside the app process again.

```sh
npm ci && npm run build        # the Dockerfile copies the pre-built ./dist (build with your .env so VITE_* defaults are baked in)
docker compose up -d --build   # builds the image once; chlio-mcp starts after clio is healthy
docker compose ps              # both should say (healthy)
```

- **Shared state:** both containers mount the `clio-data` volume, so they read and write the same SQLite file (state,
  access tokens). Writes take the lock first (`server/stateStore.js`: IMMEDIATE transactions and an atomic revision
  compare-and-swap), tested with 6 separate processes writing at once. This is safe on one host. SQLite in WAL mode
  must not be on a network filesystem; to run the services on different hosts, move the state to Postgres first.
- **Least privilege:** `chlio-mcp` gets only the variables it needs (Jira, Google client for calendar refresh), not the whole
  `.env` (no Firebase key, no Nextcloud password, no allowed-emails list). It runs with a read-only root filesystem, no Linux
  capabilities, `no-new-privileges`, 512 MB and 256 processes.
- **Variables** (all optional): `PORT`, `MCP_PORT`, `MCP_BIND` (set `0.0.0.0` to reach the MCP service directly, e.g. over
  Tailscale), `CLIO_IMAGE` (image name, default `ttsu/chlio`), `CLIO_APP_CONTAINER` / `CLIO_MCP_CONTAINER` (container names).
  Running a second copy for testing? Set `CLIO_IMAGE`, the two container names and the ports, and use `docker compose -p <name>`;
  otherwise the test build re-tags your production image.
- **Claude Desktop custom connector:** if the dialog refuses the header name `Authorization` ("reserved when sign-in is
  enabled"), turn sign-in off for the connector, or use the header **`X-Chlio-Token`** with the bare token as its value
  (no `Bearer`). Chlio accepts the token in either header.
