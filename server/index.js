import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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
