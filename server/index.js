import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';
import { getBootstrap, putBootstrap, getFileContent, saveFileContent } from './bootstrap.js';
import { deleteFileBlob } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
  const defaultTarget = process.env.NEXTCLOUD_URL || 'http://100.100.133.10:30027';
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
