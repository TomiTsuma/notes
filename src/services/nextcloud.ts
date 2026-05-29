import { createClient } from 'webdav';
import type { WebDAVClient } from 'webdav';

let client: WebDAVClient | null = null;

const normalizeNextcloudUrl = (url: string) => {
  let normalized = url.trim();
  normalized = normalized.replace(/^https?:\/\/http:\/\//i, 'http://');
  normalized = normalized.replace(/^https?:\/\/https:\/\//i, 'https://');
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  normalized = normalized.replace(/\/+$/g, '');
  if (!/remote\.php\/(webdav|dav\/files)/i.test(normalized)) {
    normalized = `${normalized}/remote.php/webdav`;
  }
  return normalized;
};

export interface NextcloudPaper {
  id: string;
  title: string;
  authors: string;
  path: string;
  downloadUrl: string;
}

export const connectNextcloud = (url: string, user: string, pass: string) => {
  const normalizedUrl = normalizeNextcloudUrl(url);
  client = createClient(normalizedUrl, {
    username: user,
    password: pass
  });
  return client;
};

export const testNextcloudConnection = async () => {
  if (!client) throw new Error('Not connected to Nextcloud');
  const success = await client.exists('/');
  if (!success) throw new Error('Nextcloud connection succeeded but root path is unavailable');
  return true;
};

export const getPapersFromNextcloud = async (): Promise<NextcloudPaper[]> => {
  if (!client) throw new Error('Not connected to Nextcloud');
  try {
    const papersPath = '/Papers';
    let exists = await client.exists(papersPath);
    if (!exists) {
      await client.createDirectory(papersPath);
      return [];
    }

    const directoryItems: any = await client.getDirectoryContents(papersPath);
    return directoryItems
      .filter((item: any) => item.type === 'file' && item.basename?.toLowerCase().endsWith('.pdf'))
      .map((item: any) => ({
        id: item.filename,
        title: item.basename.replace(/\.pdf$/i, ''),
        authors: 'Nextcloud Paper',
        path: item.filename,
        downloadUrl: client!.getFileDownloadLink(item.filename)
      }));
  } catch (error) {
    console.error('Failed to fetch papers:', error);
    return [];
  }
};

const arrayBufferToBase64 = (buffer: ArrayBuffer | Uint8Array) => {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

export const downloadPaperFromNextcloud = async (remotePath: string): Promise<string> => {
  if (!client) throw new Error('Not connected to Nextcloud');
  const normalizedPath = remotePath.startsWith('/') ? remotePath : `/${remotePath}`;
  const data = await client.getFileContents(normalizedPath, { format: 'binary' });
  let bytes: Uint8Array;

  if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else if (data instanceof Uint8Array) {
    bytes = data;
  } else if (typeof data === 'string') {
    // The browser build may sometimes return a string for binary content.
    const text = unescape(encodeURIComponent(data));
    const buffer = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) buffer[i] = text.charCodeAt(i);
    bytes = buffer;
  } else {
    throw new Error('Unsupported file content format returned by Nextcloud');
  }

  const base64 = arrayBufferToBase64(bytes);
  return `data:application/pdf;base64,${base64}`;
};

export const syncNotesToNextcloud = async (noteData: string, filename: string) => {
  if (!client) return;
  try {
    const dirPath = '/Clio-Notes';
    const dirExists = await client.exists(dirPath);
    if (!dirExists) {
      await client.createDirectory(dirPath);
    }
    await client.putFileContents(`${dirPath}/${filename}.json`, noteData, { overwrite: true });
    console.log('Note synced successfully to Nextcloud.');
  } catch (err) {
    console.error('Failed to sync note:', err);
    throw err;
  }
};
