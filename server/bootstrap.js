import fs from 'fs';
import path from 'path';
import {
  loadStatePayload,
  saveStateIfRevision,
  getStateRevision,
  getUploadPath,
  registerFileBlob,
  fileBlobExists,
  deleteFileBlob,
  getFileBlob,
  UPLOADS_DIR,
} from './db.js';

const PERSIST_KEYS = [
  'activeTool', 'brushColor', 'brushSize',
  'folders', 'files', 'activeDocumentId', 'annotations',
  'papers', 'tags', 'tagSearchQuery',
  'nextcloudUrl', 'nextcloudUsername', 'nextcloudPapersPath', 'nextcloudSyncPath',
  'isRecording', 'showRightPanel',
  'activeView', 'selectedProjectId', 'currentBackground', 'theme',
  'calendarViewMode',
  'projects', 'kanbanTasks', 'calendarEvents', 'chatHistory', 'userStreak',
  'mindMapBoards', 'activeMindMapId',
  'palmRejection', 'markerStraightMode',
];

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:');
}

function mimeFromDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match ? match[1] : 'application/octet-stream';
}

function writeBlobFromDataUrl(fileId, dataUrl) {
  const mime = mimeFromDataUrl(dataUrl);
  const base64 = dataUrl.split('base64,')[1];
  if (!base64) return false;

  const buffer = Buffer.from(base64, 'base64');
  const ext = mime.includes('pdf') ? '.pdf' : mime.includes('text') ? '.txt' : '';
  const storagePath = path.join(UPLOADS_DIR, `${fileId}${ext}`);

  fs.writeFileSync(storagePath, buffer);
  registerFileBlob(fileId, mime, storagePath);
  return true;
}

function hydrateFilesForClient(files) {
  if (!Array.isArray(files)) return [];
  return files.map((file) => {
    const next = { ...file };
    if (fileBlobExists(file.id)) {
      next.dataUrl = `/api/files/${file.id}/content`;
      next.serverStored = true;
    } else if (next.dataUrl && isDataUrl(next.dataUrl)) {
      // Legacy inline dataUrl kept as-is for bundled assets
      next.serverStored = false;
    }
    return next;
  });
}

function stripEphemeralState(state) {
  return {
    ...state,
    nextcloudConnected: false,
    nextcloudStatus: 'idle',
    nextcloudError: null,
    tagSearchQuery: state.tagSearchQuery ?? '',
    focusedTextId: null,
  };
}

export function getBootstrap() {
  const revision = getStateRevision();
  const stored = loadStatePayload();
  if (!stored || Object.keys(stored).length === 0) {
    return { empty: true, state: null, revision };
  }

  const state = stripEphemeralState(stored);
  if (state.files) {
    state.files = hydrateFilesForClient(state.files);
  }
  return { empty: false, state, revision };
}

/**
 * Saves the state sent by the browser, but only if it was based on the current revision
 * (`ifMatchRevision`). Otherwise something else (the MCP server, another tab) changed the state since,
 * and a blind overwrite would silently destroy that change: return { conflict: true } with the current
 * state so the client can merge.
 *
 * The API and the MCP server are separate processes sharing one SQLite file, so the final check-and-write is a
 * single IMMEDIATE transaction (saveStateIfRevision); the early check below only avoids useless work. Files of
 * removed notes are deleted only AFTER that save succeeded, so a refused save never deletes anything.
 */
export function putBootstrap(incoming, ifMatchRevision) {
  const currentRevision = getStateRevision();
  if (ifMatchRevision !== currentRevision) {
    return { conflict: true, ...getBootstrap() };
  }

  const state = {};
  for (const key of PERSIST_KEYS) {
    if (incoming[key] !== undefined) {
      state[key] = incoming[key];
    }
  }

  state.nextcloudConnected = false;
  state.nextcloudStatus = 'idle';
  state.nextcloudError = null;

  const incomingFileIds = new Set((state.files || []).map((f) => f.id));

  // Files that this save removes (their blobs are deleted below, once the save has really happened).
  // `existing` is still accurate then: the save only succeeds if nothing changed since the check above.
  const existing = loadStatePayload();
  const removedFileIds = (existing?.files || []).map((f) => f.id).filter((id) => !incomingFileIds.has(id));

  // Persist new base64 uploads to disk
  if (Array.isArray(state.files)) {
    state.files = state.files.map((file) => {
      const next = { ...file };
      if (isDataUrl(file.dataUrl)) {
        writeBlobFromDataUrl(file.id, file.dataUrl);
        delete next.dataUrl;
        next.serverStored = true;
      } else if (file.dataUrl?.startsWith('/api/files/')) {
        delete next.dataUrl;
        next.serverStored = true;
      }
      return next;
    });
  }

  const saved = saveStateIfRevision(state, ifMatchRevision);
  if (!saved.ok) {
    return { conflict: true, ...getBootstrap() };
  }
  for (const id of removedFileIds) {
    if (fileBlobExists(id)) deleteFileBlob(id);
  }
  return { ok: true, revision: saved.revision };
}

export function getFileContent(fileId) {
  const blob = getFileBlob(fileId);
  if (!blob || !fs.existsSync(blob.storage_path)) {
    return null;
  }
  return {
    path: blob.storage_path,
    mimeType: blob.mime_type || 'application/octet-stream',
  };
}

export function saveFileContent(fileId, buffer, mimeType) {
  const ext = mimeType?.includes('pdf') ? '.pdf' : mimeType?.includes('text') ? '.txt' : '';
  const storagePath = getUploadPath(fileId) + ext;
  fs.writeFileSync(storagePath, buffer);
  registerFileBlob(fileId, mimeType || 'application/octet-stream', storagePath);
}
