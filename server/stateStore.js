/**
 * The synced app state (one JSON document + a revision counter) on top of a better-sqlite3 handle.
 * A factory so tests can use an in-memory database; db.js builds the real instance.
 */
export function createStateStore(db) {
  const getStateRevision = () => db.prepare('SELECT revision FROM app_state WHERE id = 1').get().revision;

  function loadStatePayload() {
    const row = db.prepare('SELECT payload FROM app_state WHERE id = 1').get();
    if (!row?.payload) return null;
    try {
      return JSON.parse(row.payload);
    } catch {
      return null;
    }
  }

  /** Overwrites the state and returns the NEW revision. */
  function saveStatePayload(payload) {
    db.prepare("UPDATE app_state SET payload = ?, revision = revision + 1, updated_at = datetime('now') WHERE id = 1").run(JSON.stringify(payload));
    return getStateRevision();
  }

  /**
   * Atomic read-modify-write for server-side writers (the MCP server). `fn(state)` mutates the parsed state in
   * place and may return a result. If it throws, nothing is saved. Returns { result, revision }.
   *
   * IMMEDIATE matters: the API and the MCP server are separate processes sharing this file. A plain (deferred)
   * transaction reads first and only then asks for the write lock, so two writers could both read revision N and
   * the second would overwrite the first. IMMEDIATE takes the write lock before the read, so writers queue
   * (waiting up to the 5 s busy timeout) instead of interleaving.
   */
  function mutateState(fn) {
    return db.transaction(() => {
      const state = loadStatePayload() || {};
      const result = fn(state);
      return { result, revision: saveStatePayload(state) };
    }).immediate();
  }

  /**
   * Compare-and-swap save for the browser: stores `payload` only if the revision is still `expectedRevision`.
   * The check and the write happen inside one IMMEDIATE transaction, so no other process can save in between.
   * Returns { ok: true, revision } or { ok: false, revision } (the current one) on a stale save.
   */
  function saveStateIfRevision(payload, expectedRevision) {
    return db.transaction(() => {
      const current = getStateRevision();
      if (current !== expectedRevision) return { ok: false, revision: current };
      return { ok: true, revision: saveStatePayload(payload) };
    }).immediate();
  }

  return { getStateRevision, loadStatePayload, saveStatePayload, saveStateIfRevision, mutateState };
}
