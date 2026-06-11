import type { AppState } from '../store/appStore';

export interface BootstrapResponse {
  empty: boolean;
  state: Partial<AppState> | null;
}

export async function fetchBootstrap(): Promise<BootstrapResponse> {
  const res = await fetch('/api/bootstrap');
  if (!res.ok) throw new Error(`Bootstrap fetch failed: ${res.status}`);
  return res.json();
}

export async function saveBootstrap(state: Record<string, unknown>): Promise<void> {
  const res = await fetch('/api/bootstrap', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error(`Bootstrap save failed: ${res.status}`);
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
