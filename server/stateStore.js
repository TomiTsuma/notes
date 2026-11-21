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
   * better-sqlite3 is synchronous, so nothing can interleave between the read and the write.
   */
  function mutateState(fn) {
    return db.transaction(() => {
      const state = loadStatePayload() || {};
      const result = fn(state);
      return { result, revision: saveStatePayload(state) };
    })();
  }

  return { getStateRevision, loadStatePayload, saveStatePayload, mutateState };
}
