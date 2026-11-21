/** Single source of truth for the SQLite schema (also used by the tests with an in-memory DB). */
export function initSchema(db) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS file_blobs (
    file_id TEXT PRIMARY KEY,
    mime_type TEXT,
    storage_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO app_state (id, payload) VALUES (1, '{}');

  -- Authentication (see server/auth.js). Secrets are only ever stored as SHA-256 hashes.
  CREATE TABLE IF NOT EXISTS auth_sessions (
    id_hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT,
    picture TEXT,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_tokens (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    prefix TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'write',
    created_by TEXT,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER,
    expires_at INTEGER,
    revoked_at INTEGER
  );

  -- One row per in-flight Google login (state -> PKCE verifier + nonce), deleted on use.
  CREATE TABLE IF NOT EXISTS auth_flows (
    state_hash TEXT PRIMARY KEY,
    code_verifier TEXT NOT NULL,
    nonce TEXT NOT NULL,
    return_to TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS kv_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

  // Optimistic concurrency for the synced state: every successful write bumps `revision`; the browser
  // must present the revision it last saw (If-Match) and the MCP server writes through mutateState().
  const cols = db.prepare('PRAGMA table_info(app_state)').all().map((c) => c.name);
  if (!cols.includes('revision')) {
    db.exec('ALTER TABLE app_state ADD COLUMN revision INTEGER NOT NULL DEFAULT 0');
  }
}
