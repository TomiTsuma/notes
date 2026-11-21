/**
 * Standalone MCP service (its own container in docker-compose.yml, same image as the API).
 *
 *   node server/mcp-server.js        listens on MCP_PORT (default 4192)
 *
 * It shares the data volume with the API: the same SQLite file (state, access tokens) and the same Jira /
 * Google settings files. It serves ONLY /mcp and /healthz; there is no frontend, no REST API, no login.
 * Access tokens are checked against the same `api_tokens` table as in the API, so a token created in the
 * Chlio UI works here, and revoking it takes effect immediately.
 *
 * The API container reaches it over the compose network and forwards `/mcp` to it (MCP_UPSTREAM), so the public
 * address https://chlio.ereuna.org/mcp does not change.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import express from 'express';
import { db, getStateRevision } from './db.js';
import { createAuth, createGoogleClient } from './auth.js';
import { buildMcpHandler } from './mcp/wire.js';

const PORT = parseInt(process.env.MCP_PORT || '4192', 10);
const PUBLIC_URL = (process.env.CHLIO_PUBLIC_URL || 'https://chlio.ereuna.org').replace(/\/+$/, '');

// Only token verification is needed here (no Google login, no allow-list), but it is the same code as the API's.
const auth = createAuth({ db, google: createGoogleClient({}), allowedEmails: new Set(), publicUrl: PUBLIC_URL });

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // the API container (or Cloudflare via the API) is one hop in front

app.get('/healthz', (_req, res) => {
  try {
    res.json({ ok: true, revision: getStateRevision() }); // also proves the database is readable
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

app.post('/mcp', auth.tokenGate, express.json({ limit: '2mb' }), buildMcpHandler());
app.all('/mcp', (_req, res) => {
  res.setHeader('Allow', 'POST');
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed: this MCP server is stateless, use POST' }, id: null });
});
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Chlio MCP server listening on http://0.0.0.0:${PORT}/mcp`);
  console.log(`Data dir: ${process.env.CLIO_DATA_DIR || '(default ./data)'}`);
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`${sig}: shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
