import type { AppState } from '../store/appStore';

export interface BootstrapResponse {
  empty: boolean;
  state: Partial<AppState> | null;
  /** Server-side version of the state; saves must quote the one they were based on. */
  revision: number;
}

export async function fetchBootstrap(): Promise<BootstrapResponse> {
  const res = await fetch('/api/bootstrap');
  if (!res.ok) throw new Error(`Bootstrap fetch failed: ${res.status}`);
  return res.json();
}

/** Cheap check (a few bytes) for "did anyone else change the data?", used for polling. */
export async function fetchRevision(): Promise<number> {
  const res = await fetch('/api/bootstrap/revision');
  if (!res.ok) throw new Error(`Revision check failed: ${res.status}`);
  return (await res.json()).revision as number;
}

/** The server refused a save because the data changed since `revision` was read; it sends the current copy. */
export class ConflictError extends Error {
  revision: number;
  state: Record<string, unknown> | null;
  constructor(revision: number, state: Record<string, unknown> | null) {
    super('The data was changed elsewhere');
    this.name = 'ConflictError';
    this.revision = revision;
    this.state = state;
  }
}

/** Saves the state if the server is still at `ifRevision`; returns the new revision, or throws ConflictError. */
export async function saveBootstrap(state: Record<string, unknown>, ifRevision: number): Promise<number> {
  const res = await fetch('/api/bootstrap', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': `"${ifRevision}"` },
    body: JSON.stringify(state),
  });
  if (res.status === 409) {
    const body = await res.json();
    throw new ConflictError(body.revision, body.state ?? null);
  }
  if (!res.ok) throw new Error(`Bootstrap save failed: ${res.status}`);
  return (await res.json()).revision as number;
}

export async function uploadFileContent(
  fileId: string,
  dataUrl: string
): Promise<string> {
  const res = await fetch(`/api/files/${fileId}/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl }),
  });
  if (!res.ok) throw new Error(`File upload failed: ${res.status}`);
  const data = await res.json();
  return data.url as string;
}

export function fileContentUrl(fileId: string): string {
  return `/api/files/${fileId}/content`;
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    return res.ok;
  } catch {
    return false;
  }
}
