import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { getBootstrap, putBootstrap, getFileContent, saveFileContent } from './bootstrap.js';
import { deleteFileBlob } from './db.js';
import {
  getJiraConfig,
  saveJiraConfig,
  testJiraConnection,
  getJiraProjects,
  getJiraIssues,
  createJiraIssue,
  transitionJiraIssue,
  addJiraComment,
} from './jira.js';
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  exchangeGoogleCode,
  getGoogleStatus,
  clearGoogleTokens,
  getGoogleCalendarEvents,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from './googleCalendar.js';
import { generateIcsFeed, parseIcsContent } from './icsService.js';

const PORT = parseInt(process.env.PORT || '4191', 10);
const DIST_DIR = process.env.CLIO_DIST_DIR || path.join(__dirname, '..', 'dist');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Nextcloud WebDAV Proxy
app.use('/api/nextcloud', (req, res) => {
  const targetHeader = req.headers['x-nextcloud-target-url'];
  const defaultTarget = process.env.NEXTCLOUD_URL || 'http://localhost:8080';
  let targetUrlStr = (typeof targetHeader === 'string' && targetHeader.trim()) ? targetHeader.trim() : defaultTarget;

  if (!/^https?:\/\//i.test(targetUrlStr)) {
    targetUrlStr = `http://${targetUrlStr}`;
  }

  try {
    const targetParsed = new URL(targetUrlStr);
    const targetBasePath = targetParsed.pathname.replace(/\/+$/, '');
    const reqPath = req.url.startsWith('/') ? req.url : `/${req.url}`;
    const fullTargetPath = `${targetBasePath}${reqPath}`;

    const protocol = targetParsed.protocol === 'https:' ? https : http;

    const proxyHeaders = { ...req.headers };
    delete proxyHeaders.host;
    delete proxyHeaders['x-nextcloud-target-url'];
    proxyHeaders.host = targetParsed.host;

    const proxyReq = protocol.request(
      {
        hostname: targetParsed.hostname,
        port: targetParsed.port || (targetParsed.protocol === 'https:' ? 443 : 80),
        path: fullTargetPath,
        method: req.method,
        headers: proxyHeaders,
      },
      (proxyRes) => {
        const responseHeaders = { ...proxyRes.headers };
        // Prevent browser-native basic auth dialog loops
        delete responseHeaders['www-authenticate'];

        res.writeHead(proxyRes.statusCode || 500, responseHeaders);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      console.error('Nextcloud backend proxy error:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Nextcloud proxy connection failed', details: err.message });
      }
    });

    req.pipe(proxyReq);
  } catch (err) {
    console.error('Invalid Nextcloud target URL:', err);
    if (!res.headersSent) {
      res.status(400).json({ error: 'Invalid Nextcloud target URL' });
    }
  }
});

app.get('/api/bootstrap', (_req, res) => {
  try {
    const result = getBootstrap();
    res.json(result);
  } catch (err) {
    console.error('GET /api/bootstrap error:', err);
    res.status(500).json({ error: 'Failed to load state' });
  }
});

app.put('/api/bootstrap', (req, res) => {
  try {
    const result = putBootstrap(req.body);
    res.json(result);
  } catch (err) {
    console.error('PUT /api/bootstrap error:', err);
    res.status(500).json({ error: 'Failed to save state' });
  }
});

// ArXiv Paper Downloader Proxy
app.post('/api/arxiv/download', async (req, res) => {
  const { arxivId } = req.body || {};
  if (!arxivId || typeof arxivId !== 'string') {
    return res.status(400).json({ error: 'arXiv ID or URL is required' });
  }

  let cleanId = arxivId.trim();
  cleanId = cleanId.replace(/^https?:\/\/(export\.)?arxiv\.org\/(abs|pdf)\//i, '');
  cleanId = cleanId.replace(/^arxiv:/i, '');
  cleanId = cleanId.replace(/\.pdf$/i, '');
  cleanId = cleanId.trim();

  if (!cleanId) {
    return res.status(400).json({ error: 'Invalid arXiv ID or URL' });
  }

  try {
    let title = cleanId;
    let authors = 'arXiv';

    // Fetch arXiv metadata (Atom XML)
    try {
      const metaRes = await fetch(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(cleanId)}`);
      if (metaRes.ok) {
        const xml = await metaRes.text();
        const titleMatch = xml.match(/<entry>[\s\S]*?<title>([\s\S]*?)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].replace(/\s+/g, ' ').trim();
        }
        const authorMatches = [...xml.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi)];
        if (authorMatches.length > 0) {
          const names = authorMatches.map(m => m[1].trim());
          if (names.length <= 3) {
            authors = names.join(', ');
          } else {
            authors = `${names.slice(0, 3).join(', ')} et al.`;
          }
        }
      }
    } catch (metaErr) {
      console.warn('Failed to fetch arXiv metadata:', metaErr.message);
    }

    // Fetch PDF binary
    let pdfRes = await fetch(`https://export.arxiv.org/pdf/${cleanId}.pdf`);
    if (!pdfRes.ok) {
      pdfRes = await fetch(`https://arxiv.org/pdf/${cleanId}.pdf`);
    }

    if (!pdfRes.ok) {
      return res.status(404).json({ error: `Paper not found on arXiv for ID "${cleanId}" (HTTP ${pdfRes.status})` });
    }

    const arrayBuffer = await pdfRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfBase64 = buffer.toString('base64');

    const cleanTitle = title.replace(/[\/\\:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
    const truncatedTitle = cleanTitle.length > 100 ? cleanTitle.substring(0, 100).trim() + '...' : cleanTitle;
    const safeId = cleanId.replace(/[\/\\:*?"<>|]/g, '_');
    const filename = `${safeId} - ${truncatedTitle}.pdf`;

    res.json({
      ok: true,
      arxivId: cleanId,
      title,
      authors,
      filename,
      pdfBase64,
    });
  } catch (err) {
    console.error('arXiv download error:', err);
    res.status(500).json({ error: 'Failed to download arXiv paper', details: err.message });
  }
});

app.get('/api/files/:id/content', (req, res) => {
  try {
    const file = getFileContent(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    fs.createReadStream(file.path).pipe(res);
  } catch (err) {
    console.error('GET file content error:', err);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

app.post('/api/files/:id/content', upload.single('file'), (req, res) => {
  try {
    let buffer;
    let mimeType = req.body?.mimeType || req.file?.mimetype;

    if (req.file) {
      buffer = req.file.buffer;
      mimeType = req.file.mimetype;
    } else if (req.body?.dataUrl) {
      const dataUrl = req.body.dataUrl;
      mimeType = dataUrl.match(/^data:([^;]+);/)?.[1] || 'application/octet-stream';
      const base64 = dataUrl.split('base64,')[1];
      if (!base64) return res.status(400).json({ error: 'Invalid dataUrl' });
      buffer = Buffer.from(base64, 'base64');
    } else {
      return res.status(400).json({ error: 'No file or dataUrl provided' });
    }

    saveFileContent(req.params.id, buffer, mimeType);
    res.json({ ok: true, url: `/api/files/${req.params.id}/content` });
  } catch (err) {
    console.error('POST file content error:', err);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

app.delete('/api/files/:id', (req, res) => {
  try {
    deleteFileBlob(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE file error:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// ==========================================
// Jira Integration Endpoints
// ==========================================

app.get('/api/jira/config', (_req, res) => {
  try {
    const config = getJiraConfig();
    res.json({
      host: config.host || '',
      email: config.email || '',
      hasToken: Boolean(config.apiToken),
      projectKey: config.projectKey || '',
      syncEnabled: Boolean(config.syncEnabled),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/jira/config', (req, res) => {
  try {
    const updated = saveJiraConfig(req.body);
    res.json({
      ok: true,
      config: {
        host: updated.host,
        email: updated.email,
        hasToken: Boolean(updated.apiToken),
        projectKey: updated.projectKey,
        syncEnabled: Boolean(updated.syncEnabled),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jira/test', async (_req, res) => {
  try {
    const user = await testJiraConnection();
    res.json({ ok: true, user: { displayName: user.displayName, emailAddress: user.emailAddress, accountId: user.accountId } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/jira/projects', async (_req, res) => {
  try {
    const projects = await getJiraProjects();
    res.json({ ok: true, projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jira/issues', async (_req, res) => {
  try {
    const issues = await getJiraIssues();
    res.json({ ok: true, issues });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/jira/issues', async (req, res) => {
  try {
    const created = await createJiraIssue(req.body);
    res.json({ ok: true, issue: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/jira/issues/:key/transition', async (req, res) => {
  try {
    const { status } = req.body;
    const result = await transitionJiraIssue(req.params.key, status);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/jira/issues/:key/comments', async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }
    const result = await addJiraComment(req.params.key, comment.trim());
    res.json({ ok: true, comment: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Google Calendar Integration Endpoints
// ==========================================

app.get('/api/auth/google/url', (req, res) => {
  try {
    const origin = req.query.origin || 'http://localhost:4191';
    const redirectUri = req.query.redirectUri || 'http://localhost:4191';
    const authUrl = getGoogleAuthUrl(redirectUri, origin);
    res.json({ ok: true, url: authUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/google/exchange', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }
    const result = await exchangeGoogleCode(code, redirectUri || 'http://localhost:4191');
    res.json({ ok: true, email: result.email });
  } catch (err) {
    console.error('Exchange error:', err);
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) {
      return res.redirect(`http://localhost:4191/?google_error=${encodeURIComponent(error)}`);
    }
    if (!code) {
      return res.status(400).send('Missing authorization code');
    }
    const { returnOrigin } = await handleGoogleCallback(code, state);
    res.redirect(`${returnOrigin || 'http://localhost:4191'}?google_connected=true`);
  } catch (err) {
    console.error('Google callback error:', err);
    res.redirect(`http://localhost:4191/?google_error=${encodeURIComponent(err.message)}`);
  }
});

app.get('/api/google/status', (_req, res) => {
  try {
    const status = getGoogleStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/google/disconnect', (_req, res) => {
  try {
    clearGoogleTokens();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/google/events', async (req, res) => {
  try {
    const { timeMin, timeMax } = req.query;
    const events = await getGoogleCalendarEvents(timeMin, timeMax);
    res.json({ ok: true, events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/google/events', async (req, res) => {
  try {
    const created = await createGoogleCalendarEvent(req.body);
    res.json({ ok: true, event: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/google/events/:id', async (req, res) => {
  try {
    await deleteGoogleCalendarEvent(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// iCalendar (.ics) Protocol Endpoints
// ==========================================

// Live iCal subscription feed (for Google Calendar "Add from URL")
app.get('/api/calendar/feed.ics', (_req, res) => {
  try {
    const bootstrap = getBootstrap();
    const state = bootstrap.state || {};
    const events = state.calendarEvents || [];
    const tasks = state.kanbanTasks || [];
    const icsContent = generateIcsFeed(events, tasks);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="clio-schedule.ics"');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(icsContent);
  } catch (err) {
    console.error('feed.ics error:', err);
    res.status(500).send('Error generating calendar feed');
  }
});

// Download .ics file
app.get('/api/calendar/export.ics', (_req, res) => {
  try {
    const bootstrap = getBootstrap();
    const state = bootstrap.state || {};
    const events = state.calendarEvents || [];
    const tasks = state.kanbanTasks || [];
    const icsContent = generateIcsFeed(events, tasks);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="clio-calendar.ics"');
    res.send(icsContent);
  } catch (err) {
    console.error('export.ics error:', err);
    res.status(500).send('Error exporting calendar');
  }
});

// Import .ics file or remote iCal URL (e.g. Google Calendar secret iCal URL)
app.post('/api/calendar/import-ics', async (req, res) => {
  try {
    let icsText = req.body?.icsText || '';
    const url = req.body?.url;

    if (url) {
      const fetchRes = await fetch(url);
      if (!fetchRes.ok) {
        return res.status(400).json({ error: `Failed to fetch .ics URL (HTTP ${fetchRes.status})` });
      }
      icsText = await fetchRes.text();
    }

    if (!icsText || !icsText.trim()) {
      return res.status(400).json({ error: 'No iCalendar (.ics) content or URL provided' });
    }

    const parsedEvents = parseIcsContent(icsText);
    res.json({ ok: true, events: parsedEvents, count: parsedEvents.length });
  } catch (err) {
    console.error('import-ics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Static frontend
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Clio server listening on http://0.0.0.0:${PORT}`);
  console.log(`Data dir: ${process.env.CLIO_DATA_DIR || '(default ./data)'}`);
});
