import { createClient, AuthType } from 'webdav';
import type { WebDAVClient, FileStat } from 'webdav';

let client: WebDAVClient | null = null;
let papersPath = '/Papers';
let syncPath = '/Chlio';
let connectPromise: Promise<WebDAVClient> | null = null;

const decodePath = (path: string) => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

/** Convert any Nextcloud/WebDAV path variant into a user-root-relative path like `/Papers`. */
export const normalizeRemotePath = (path: string): string => {
  if (!path || path === '/') return '/';

  let normalized = decodePath(path.trim()).replace(/\\/g, '/');

  const davMatch = normalized.match(/remote\.php\/dav\/files\/[^/]+\/(.*)$/i);
  if (davMatch) {
    normalized = davMatch[1];
  } else {
    normalized = normalized
      .replace(/^https?:\/\/[^/]+/i, '')
      .replace(/^\/?api\/nextcloud\/?/i, '')
      .replace(/^\/?remote\.php\/dav\/files\/[^/]+\/?/i, '');
  }

  const parts = normalized.split('/').filter(Boolean);
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      resolved.pop();
      continue;
    }
    resolved.push(part);
  }

  return resolved.length ? `/${resolved.join('/')}` : '/';
};

export const getParentRemotePath = (path: string): string => {
  const normalized = normalizeRemotePath(path);
  if (normalized === '/') return '/';
  const parts = normalized.split('/').filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join('/')}` : '/';
};

const isBrowser = typeof window !== 'undefined';

const basicAuthHeader = (user: string, pass: string) =>
  `Basic ${typeof btoa === 'function' ? btoa(`${user}:${pass}`) : Buffer.from(`${user}:${pass}`).toString('base64')}`;

const normalizeNextcloudUrl = (url: string, username: string) => {
  let normalized = url.trim();
  normalized = normalized.replace(/^https?:\/\/http:\/\//i, 'http://');
  normalized = normalized.replace(/^https?:\/\/https:\/\//i, 'https://');
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `http://${normalized}`;
  }
  normalized = normalized.replace(/\/+$/g, '');
  normalized = normalized.replace(/\/remote\.php\/(webdav|dav\/files\/.*)$/i, '');

  if (isBrowser) {
    return `/api/nextcloud/remote.php/dav/files/${username}/`;
  }

  if (!/remote\.php\/(webdav|dav\/files)/i.test(normalized)) {
    normalized = `${normalized}/remote.php/dav/files/${username}`;
  }
  return normalized;
};

const createNextcloudClient = (clientUrl: string, user: string, pass: string): WebDAVClient =>
  createClient(clientUrl, {
    username: user,
    password: pass,
    authType: AuthType.Password,
    withCredentials: false,
    headers: {
      Authorization: basicAuthHeader(user, pass),
    },
  });

export interface NextcloudPaper {
  id: string;
  title: string;
  authors: string;
  path: string;
  downloadUrl: string;
}

export interface NextcloudDirectory {
  name: string;
  path: string;
}

export const setPapersPath = (path: string) => { papersPath = normalizeRemotePath(path); };
export const setSyncPath = (path: string) => { syncPath = normalizeRemotePath(path); };
export const getPapersPath = () => papersPath;
export const getSyncPath = () => syncPath;

export const disconnectNextcloud = () => {
  client = null;
  connectPromise = null;
};

export const connectNextcloud = (url: string, user: string, pass: string) => {
  const normalizedUrl = normalizeNextcloudUrl(url, user);
  client = createNextcloudClient(normalizedUrl, user, pass);
  return client;
};

const tryConnect = async (url: string, user: string, pass: string): Promise<WebDAVClient> => {
  const davFilesUrl = normalizeNextcloudUrl(url, user);
  const c = createNextcloudClient(davFilesUrl, user, pass);

  try {
    const ok = await c.exists('/');
    if (ok) return c;
    throw new Error('Nextcloud root path unavailable');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/too many requests|429/i.test(message)) {
      throw new Error('Nextcloud rate limit reached — wait a minute and try again');
    }
    throw new Error(message.includes('401') ? 'Invalid Nextcloud username or password' : message);
  }
};

export const connectNextcloudWithFallback = async (url: string, user: string, pass: string) => {
  if (connectPromise) return connectPromise;

  connectPromise = tryConnect(url, user, pass)
    .then((connectedClient) => {
      client = connectedClient;
      return connectedClient;
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
};

export const testNextcloudConnection = async () => {
  if (!client) throw new Error('Not connected to Nextcloud');
  const success = await client.exists('/');
  if (!success) throw new Error('Nextcloud root path unavailable');
  return true;
};

export const listDirectories = async (path: string = '/'): Promise<NextcloudDirectory[]> => {
  if (!client) throw new Error('Not connected to Nextcloud');
  const normalized = normalizeRemotePath(path);
  const items = await client.getDirectoryContents(normalized) as FileStat[];
  return items
    .filter(item => item.type === 'directory')
    .map(item => ({
      name: item.basename,
      path: normalizeRemotePath(item.filename),
    }));
};

export const getPapersFromNextcloud = async (customPath?: string): Promise<NextcloudPaper[]> => {
  if (!client) throw new Error('Not connected to Nextcloud');
  const target = normalizeRemotePath(customPath || papersPath);

  try {
    const directoryItems = await client.getDirectoryContents(target) as FileStat[];
    return directoryItems
      .filter(item => item.type === 'file' && item.basename?.toLowerCase().endsWith('.pdf'))
      .map(item => ({
        id: item.filename,
        title: item.basename.replace(/\.pdf$/i, ''),
        authors: 'Nextcloud Paper',
        path: normalizeRemotePath(item.filename),
        downloadUrl: '',
      }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/404|not found/i.test(message)) {
      await client.createDirectory(target);
      return [];
    }
    console.error('Failed to fetch papers:', error);
    throw error;
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
  const normalizedPath = normalizeRemotePath(remotePath);
  const data = await client.getFileContents(normalizedPath, { format: 'binary' });
  let bytes: Uint8Array;

  if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else if (data instanceof Uint8Array) {
    bytes = data;
  } else if (typeof data === 'string') {
    const text = unescape(encodeURIComponent(data));
    const buffer = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) buffer[i] = text.charCodeAt(i);
    bytes = buffer;
  } else {
    throw new Error('Unsupported file content format returned by Nextcloud');
  }

  return `data:application/pdf;base64,${arrayBufferToBase64(bytes)}`;
};

export const uploadFileToNextcloud = async (filename: string, dataUrl: string, customSyncPath?: string) => {
  if (!client) throw new Error('Not connected to Nextcloud');
  const targetDir = normalizeRemotePath(customSyncPath || syncPath);

  try {
    await client.getDirectoryContents(targetDir);
  } catch {
    await client.createDirectory(targetDir);
  }

  const base64 = dataUrl.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

  const remotePath = `${targetDir}/${filename}`;
  await client.putFileContents(remotePath, bytes.buffer as ArrayBuffer, { overwrite: true });
  return remotePath;
};

export const syncNotesToNextcloud = async (noteData: string, filename: string) => {
  if (!client) return;
  const dirPath = '/Clio-Notes';

  try {
    await client.getDirectoryContents(dirPath);
  } catch {
    await client.createDirectory(dirPath);
  }

  await client.putFileContents(`${dirPath}/${filename}.json`, noteData, { overwrite: true });
};
