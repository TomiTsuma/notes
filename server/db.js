import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.CLIO_DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'clio.db');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

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
`);

export { db, DATA_DIR, UPLOADS_DIR, DB_PATH };

export function getUploadPath(fileId) {
  return path.join(UPLOADS_DIR, fileId);
}

export function fileBlobExists(fileId) {
  const row = db.prepare('SELECT 1 FROM file_blobs WHERE file_id = ?').get(fileId);
  return !!row;
}

export function registerFileBlob(fileId, mimeType, storagePath) {
  db.prepare(`
    INSERT INTO file_blobs (file_id, mime_type, storage_path)
    VALUES (?, ?, ?)
    ON CONFLICT(file_id) DO UPDATE SET
      mime_type = excluded.mime_type,
      storage_path = excluded.storage_path
  `).run(fileId, mimeType, storagePath);
}

export function getFileBlob(fileId) {
  return db.prepare('SELECT * FROM file_blobs WHERE file_id = ?').get(fileId);
}

export function deleteFileBlob(fileId) {
  const row = getFileBlob(fileId);
  if (row?.storage_path && fs.existsSync(row.storage_path)) {
    fs.unlinkSync(row.storage_path);
  }
  db.prepare('DELETE FROM file_blobs WHERE file_id = ?').run(fileId);
}

export function loadStatePayload() {
  const row = db.prepare('SELECT payload FROM app_state WHERE id = 1').get();
  if (!row?.payload) return null;
  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

export function saveStatePayload(payload) {
  const json = JSON.stringify(payload);
  db.prepare(`
    UPDATE app_state SET payload = ?, updated_at = datetime('now') WHERE id = 1
  `).run(json);
}
