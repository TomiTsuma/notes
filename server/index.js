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
import {
  getFirebaseWebConfig,
  verifyFirebaseIdToken,
  createFirebaseCustomToken,
  getSavedAuthSession,
  saveAuthSession,
  clearAuthSession,
} from './firebaseAuth.js';

const PORT = parseInt(process.env.PORT || '4191', 10);
const DIST_DIR = process.env.CLIO_DIST_DIR || path.join(__dirname, '..', 'dist');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ollamaUrl: process.env.OLLAMA_URL || 'http://192.168.100.17:11434' });
});

// Ollama AI Proxy (supports streaming /api/generate + automatic port & model discovery on 192.168.100.17)
function getOllamaCandidateBaseUrls() {
  const raw = (process.env.OLLAMA_URL || 'http://192.168.100.17:11434').trim().replace(/\/+$/, '');
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  const candidates = [withProtocol];
  try {
    const parsed = new URL(withProtocol);
    if (!parsed.port) {
      candidates.unshift(`${parsed.protocol}//${parsed.hostname}:11434`);
    } else if (parsed.port === '11434') {
      candidates.push(`${parsed.protocol}//${parsed.hostname}`);
    }
  } catch {
    // ignore URL parse error
  }
  return Array.from(new Set(candidates));
}

async function resolveFallbackOllamaModel(baseUrl) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const resp = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data = await resp.json();
    const models = Array.isArray(data?.models) ? data.models.map((m) => m.name).filter(Boolean) : [];
    if (models.length === 0) return null;
    const preferred = models.find((n) => /researcher|qwen|gemma|llama|deepseek/i.test(n));
    return preferred || models[0];
  } catch {
    return null;
  }
}

app.post('/api/ollama', async (req, res) => {
  const candidates = getOllamaCandidateBaseUrls();
  const payload = req.body && typeof req.body === 'object' ? { ...req.body } : {};
  if (process.env.OLLAMA_MODEL && (!payload.model || payload.model === 'qwen3.5:researcher')) {
    payload.model = process.env.OLLAMA_MODEL;
  }

  let lastError = null;

  for (const baseUrl of candidates) {
    try {
      const targetUrl = new URL(`${baseUrl}/api/generate`);
      const protocol = targetUrl.protocol === 'https:' ? https : http;

      const attemptRequest = (bodyObj) =>
        new Promise((resolve, reject) => {
          const bodyStr = JSON.stringify(bodyObj);
          const proxyReq = protocol.request(
            {
              hostname: targetUrl.hostname,
              port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
              path: `${targetUrl.pathname}${targetUrl.search}`,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyStr),
              },
              timeout: 8000,
            },
            (proxyRes) => {
              resolve({ proxyReq, proxyRes });
            }
          );

          proxyReq.on('timeout', () => {
            proxyReq.destroy(new Error(`Connection timeout to ${baseUrl}`));
          });
          proxyReq.on('error', (err) => reject(err));
          proxyReq.write(bodyStr);
          proxyReq.end();
        });

      let { proxyRes } = await attemptRequest(payload);

      // If the requested model isn't found on this Ollama instance, auto-discover an available model
      if (proxyRes.statusCode === 404) {
        proxyRes.resume();
        const fallbackModel = await resolveFallbackOllamaModel(baseUrl);
        if (fallbackModel && fallbackModel !== payload.model) {
          console.log(`[Ollama Proxy] Model '${payload.model}' not found on ${baseUrl}; using '${fallbackModel}'`);
          const retry = await attemptRequest({ ...payload, model: fallbackModel });
          proxyRes = retry.proxyRes;
        }
      }

      res.writeHead(proxyRes.statusCode || 200, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      proxyRes.pipe(res);
      return;
    } catch (err) {
      lastError = err;
    }
  }

  console.error('Ollama backend proxy error:', lastError?.message || lastError);
  if (!res.headersSent) {
    res.status(502).json({
      error: 'Ollama proxy connection failed',
      target: candidates[0],
      details: lastError?.message || 'Unreachable',
    });
  }
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

    // Use server-side .env NEXTCLOUD_USERNAME & NEXTCLOUD_PASSWORD if client did not provide password
    if (process.env.NEXTCLOUD_USERNAME && process.env.NEXTCLOUD_PASSWORD) {
      const authHeader = String(proxyHeaders.authorization || '');
      let shouldInjectEnvAuth = !authHeader;
      if (authHeader.startsWith('Basic ')) {
        try {
          const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
          if (decoded.endsWith(':') || decoded.endsWith(':__ENV__')) {
            shouldInjectEnvAuth = true;
          }
        } catch {
          // ignore
        }
      }
      if (shouldInjectEnvAuth) {
        proxyHeaders.authorization = `Basic ${Buffer.from(
          `${process.env.NEXTCLOUD_USERNAME}:${process.env.NEXTCLOUD_PASSWORD}`
        ).toString('base64')}`;
      }
    }

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

// Helper: parse user input into arXiv ID or DOI
function parsePaperIdentifier(rawInput) {
  let input = String(rawInput || '').trim();
  try {
    input = decodeURIComponent(input);
  } catch {
    // keep raw if not valid URI encoding
  }

  // 1. Check for official arXiv DOI: 10.48550/arXiv.<id>
  const arxivDoiMatch = input.match(/10\.48550\/arXiv\.([0-9]{4}\.[0-9]{4,5}(?:v\d+)?|[a-z-]+\/\d{7}(?:v\d+)?)/i);
  if (arxivDoiMatch) {
    return {
      type: 'arxiv',
      arxivId: arxivDoiMatch[1],
      doi: `10.48550/arXiv.${arxivDoiMatch[1]}`,
    };
  }

  // 2. Check for general DOI (10.xxxx/...) or doi.org URL or doi: prefix
  const doiCleaned = input
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim();
  const doiMatch = doiCleaned.match(/(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)/);
  if (doiMatch) {
    const doi = doiMatch[1].replace(/[.,;]+$/, '').replace(/\.pdf$/i, '');
    return {
      type: 'doi',
      doi,
      arxivId: null,
    };
  }

  // 3. Otherwise treat as arXiv ID or URL
  let cleanArxiv = input
    .replace(/^https?:\/\/(export\.)?arxiv\.org\/(abs|pdf)\//i, '')
    .replace(/^arxiv:\s*/i, '')
    .replace(/\.pdf$/i, '')
    .trim();

  return {
    type: 'arxiv',
    arxivId: cleanArxiv || null,
    doi: null,
  };
}

function formatAuthorsList(names) {
  const clean = (names || []).map(n => String(n || '').trim()).filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length <= 3) return clean.join(', ');
  return `${clean.slice(0, 3).join(', ')} et al.`;
}

function normalizeTitleForComparison(title) {
  return String(title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function fetchArxivMetadataByQuery(queryParam) {
  const metaRes = await fetch(`https://export.arxiv.org/api/query?${queryParam}`);
  if (!metaRes.ok) return [];
  const xml = await metaRes.text();
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)];
  return entries.map(match => {
    const entryXml = match[1];
    const idMatch = entryXml.match(/<id>([\s\S]*?)<\/id>/i);
    let entryArxivId = null;
    if (idMatch && idMatch[1]) {
      entryArxivId = idMatch[1].trim().replace(/^https?:\/\/(export\.)?arxiv\.org\/abs\//i, '').trim();
    }
    const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/i);
    const entryTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
    const authorMatches = [...entryXml.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi)];
    const entryAuthors = formatAuthorsList(authorMatches.map(m => m[1]));
    const doiMatch = entryXml.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/i);
    const entryDoi = doiMatch ? doiMatch[1].trim() : null;
    return {
      arxivId: entryArxivId,
      title: entryTitle,
      authors: entryAuthors,
      doi: entryDoi,
    };
  });
}

async function resolvePaperMetadataAndCandidates(rawInput) {
  const parsed = parsePaperIdentifier(rawInput);
  if (!parsed.arxivId && !parsed.doi) {
    throw new Error('Invalid arXiv ID or DOI');
  }

  let title = '';
  let authors = '';
  let arxivId = parsed.arxivId;
  let doi = parsed.doi;
  const candidatePdfUrls = [];
  const addCandidateUrl = (url) => {
    if (url && typeof url === 'string' && /^https?:\/\//i.test(url) && !candidatePdfUrls.includes(url)) {
      candidatePdfUrls.push(url);
    }
  };

  if (parsed.type === 'arxiv' && arxivId) {
    try {
      const entries = await fetchArxivMetadataByQuery(`id_list=${encodeURIComponent(arxivId)}`);
      if (entries.length > 0 && entries[0].title) {
        title = entries[0].title;
        authors = entries[0].authors || 'arXiv';
        if (entries[0].doi && !doi) doi = entries[0].doi;
      }
    } catch (err) {
      console.warn('Failed to fetch arXiv metadata:', err.message);
    }
    addCandidateUrl(`https://export.arxiv.org/pdf/${arxivId}.pdf`);
    addCandidateUrl(`https://arxiv.org/pdf/${arxivId}.pdf`);
    return {
      type: 'arxiv',
      arxivId,
      doi,
      title: title || arxivId,
      authors: authors || 'arXiv',
      candidatePdfUrls,
    };
  }

  // DOI resolution across Crossref, OpenAlex, Semantic Scholar, EuropePMC, and arXiv
  const [crSettled, oaSettled, s2Settled, epmcSettled, arxivDoiSettled] = await Promise.allSettled([
    fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { 'User-Agent': 'ClioNotes/1.0 (mailto:support@ereuna.org)' },
    }).then(r => (r.ok ? r.json() : null)),
    fetch(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`, {
      headers: { 'User-Agent': 'ClioNotes/1.0 (mailto:support@ereuna.org)' },
    }).then(r => (r.ok ? r.json() : null)),
    fetch(`https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=title,authors,externalIds,openAccessPdf`, {
      headers: { 'User-Agent': 'ClioNotes/1.0' },
    }).then(r => (r.ok ? r.json() : null)),
    fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(doi)}&format=json&resultType=core`).then(r => (r.ok ? r.json() : null)),
    fetchArxivMetadataByQuery(`search_query=doi:${encodeURIComponent(doi)}&max_results=2`),
  ]);

  const cr = crSettled.status === 'fulfilled' ? crSettled.value?.message : null;
  const oa = oaSettled.status === 'fulfilled' ? oaSettled.value : null;
  const s2 = s2Settled.status === 'fulfilled' ? s2Settled.value : null;
  const epmc = epmcSettled.status === 'fulfilled' ? epmcSettled.value?.resultList?.result?.[0] : null;
  const arxivByDoi = arxivDoiSettled.status === 'fulfilled' ? arxivDoiSettled.value : [];

  // 1. Check arXiv match by DOI
  if (arxivByDoi && arxivByDoi.length > 0 && arxivByDoi[0].arxivId) {
    arxivId = arxivByDoi[0].arxivId;
    if (!title && arxivByDoi[0].title) title = arxivByDoi[0].title;
    if (!authors && arxivByDoi[0].authors) authors = arxivByDoi[0].authors;
  }

  // 2. Semantic Scholar metadata & externalIds
  if (s2) {
    if (!title && s2.title) title = s2.title;
    if (!authors && Array.isArray(s2.authors) && s2.authors.length > 0) {
      authors = formatAuthorsList(s2.authors.map(a => a.name));
    }
    if (!arxivId && s2.externalIds?.ArXiv) {
      arxivId = s2.externalIds.ArXiv;
    }
  }

  // 3. OpenAlex metadata & OA locations
  if (oa) {
    if (!title && (oa.title || oa.display_name)) title = oa.title || oa.display_name;
    if (!authors && Array.isArray(oa.authorships) && oa.authorships.length > 0) {
      authors = formatAuthorsList(oa.authorships.map(a => a.author?.display_name));
    }
    const allLocs = [
      oa.best_oa_location,
      oa.primary_location,
      ...(Array.isArray(oa.locations) ? oa.locations : []),
    ].filter(Boolean);
    for (const loc of allLocs) {
      const checkUrl = loc.pdf_url || loc.landing_page_url || '';
      const axMatch = checkUrl.match(/arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5}(?:v\d+)?|[a-z-]+\/\d{7}(?:v\d+)?)/i);
      if (axMatch && !arxivId) {
        arxivId = axMatch[1];
      }
    }
  }

  // 4. Crossref metadata & relations
  if (cr) {
    if (!title && Array.isArray(cr.title) && cr.title[0]) {
      title = String(cr.title[0]).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }
    if (!authors && Array.isArray(cr.author) && cr.author.length > 0) {
      authors = formatAuthorsList(
        cr.author.map(a => [a.given, a.family].filter(Boolean).join(' ') || a.name)
      );
    }
    if (!arxivId && cr.relation) {
      const relStr = JSON.stringify(cr.relation);
      const axRel = relStr.match(/10\.48550\/arXiv\.([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)/i) ||
                    relStr.match(/arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)/i);
      if (axRel) arxivId = axRel[1];
    }
  }

  // 5. EuropePMC metadata
  if (epmc) {
    if (!title && epmc.title) title = String(epmc.title).replace(/\.$/, '').trim();
    if (!authors && epmc.authorString) authors = epmc.authorString;
  }

  // 6. If still no arxivId but we have a title, check if an exact title match exists on arXiv
  if (!arxivId && title && title.length > 12) {
    try {
      const cleanQueryTitle = title.replace(/["\\():?]/g, ' ').replace(/\s+/g, ' ').trim();
      const titleEntries = await fetchArxivMetadataByQuery(`search_query=ti:%22${encodeURIComponent(cleanQueryTitle)}%22&max_results=5`);
      const normTarget = normalizeTitleForComparison(title);
      const matched = titleEntries.find(e => normalizeTitleForComparison(e.title) === normTarget);
      if (matched && matched.arxivId) {
        arxivId = matched.arxivId;
      }
    } catch {
      // ignore fallback search errors
    }
  }

  // Assemble candidate PDF URLs in priority order
  if (arxivId) {
    addCandidateUrl(`https://export.arxiv.org/pdf/${arxivId}.pdf`);
    addCandidateUrl(`https://arxiv.org/pdf/${arxivId}.pdf`);
  }
  if (oa) {
    addCandidateUrl(oa.best_oa_location?.pdf_url);
    addCandidateUrl(oa.primary_location?.pdf_url);
    if (Array.isArray(oa.locations)) {
      for (const loc of oa.locations) {
        addCandidateUrl(loc?.pdf_url);
      }
    }
    addCandidateUrl(oa.open_access?.oa_url);
  }
  if (s2?.openAccessPdf?.url) {
    addCandidateUrl(s2.openAccessPdf.url);
  }
  if (epmc) {
    const ftList = epmc.fullTextUrlList?.fullTextUrl;
    if (Array.isArray(ftList)) {
      for (const item of ftList) {
        if (item.documentStyle === 'pdf' || item.availabilityCode === 'OA') {
          addCandidateUrl(item.url);
        }
      }
    }
    if (epmc.pmcid) {
      addCandidateUrl(`https://europepmc.org/backend/ptpmcrender.fcgi?accid=${epmc.pmcid}&blobtype=pdf`);
    }
  }
  if (oa?.ids?.pmcid) {
    const pmcid = String(oa.ids.pmcid).replace(/^https?:\/\/.*\/(PMC\d+)\/?$/i, '$1');
    if (/^PMC\d+$/i.test(pmcid)) {
      addCandidateUrl(`https://europepmc.org/backend/ptpmcrender.fcgi?accid=${pmcid}&blobtype=pdf`);
    }
  }
  if (cr && Array.isArray(cr.link)) {
    for (const l of cr.link) {
      if (l['content-type'] === 'application/pdf' || l['content-type'] === 'unspecified') {
        addCandidateUrl(l.URL);
      }
    }
  }
  // Known publisher / preprint direct PDF patterns
  if (/^10\.1101\//i.test(doi)) {
    addCandidateUrl(`https://www.biorxiv.org/content/${doi}.full.pdf`);
    addCandidateUrl(`https://www.medrxiv.org/content/${doi}.full.pdf`);
  }
  if (/^10\.18653\/v1\//i.test(doi)) {
    const aclId = doi.split('/').pop();
    if (aclId) addCandidateUrl(`https://aclanthology.org/${aclId}.pdf`);
  }
  if (/^10\.1371\/journal\./i.test(doi)) {
    addCandidateUrl(`https://journals.plos.org/plosone/article/file?id=${encodeURIComponent(doi)}&type=printable`);
  }
  addCandidateUrl(`https://doi.org/${encodeURIComponent(doi)}`);

  return {
    type: 'doi',
    arxivId: arxivId || null,
    doi,
    title: title || doi,
    authors: authors || 'DOI',
    foundMetadata: Boolean(cr || oa || s2 || epmc || (arxivByDoi && arxivByDoi.length > 0)),
    candidatePdfUrls,
  };
}

async function tryFetchPdfBuffer(url, visited = new Set()) {
  if (!url || visited.has(url) || visited.size > 6) return null;
  visited.add(url);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timer);

    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check PDF magic header %PDF-
    if (buffer.length > 100 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
      return buffer;
    }

    // If HTML was returned, check for <meta name="citation_pdf_url" content="...">
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html') || buffer.subarray(0, 256).toString('utf8').includes('<html') || buffer.subarray(0, 256).toString('utf8').includes('<!DOCTYPE')) {
      const html = buffer.subarray(0, 150000).toString('utf8');
      const metaMatch =
        html.match(/<meta[^>]+(?:name|property)=["']citation_pdf_url["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']citation_pdf_url["']/i) ||
        html.match(/<link[^>]+type=["']application\/pdf["'][^>]+href=["']([^"']+)["']/i);
      if (metaMatch && metaMatch[1]) {
        const resolvedPdfUrl = new URL(metaMatch[1].replace(/&amp;/g, '&'), res.url || url).toString();
        return await tryFetchPdfBuffer(resolvedPdfUrl, visited);
      }
    }
  } catch {
    return null;
  }
  return null;
}

// Paper Metadata Lookup Endpoint (supports both arXiv ID and DOI)
app.post('/api/arxiv/lookup', async (req, res) => {
  const rawQuery = req.body?.query || req.body?.arxivId || req.body?.doi || '';
  if (!rawQuery || typeof rawQuery !== 'string' || !rawQuery.trim()) {
    return res.status(400).json({ error: 'arXiv ID or DOI is required' });
  }

  try {
    const info = await resolvePaperMetadataAndCandidates(rawQuery.trim());
    if (info.type === 'doi' && !info.foundMetadata && info.title === info.doi) {
      return res.status(404).json({ error: `No paper found for DOI "${info.doi}"` });
    }
    res.json({
      ok: true,
      type: info.type,
      arxivId: info.arxivId,
      doi: info.doi,
      title: info.title,
      authors: info.authors,
      hasPdfCandidates: info.candidatePdfUrls.length > 0,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to look up paper' });
  }
});

// ArXiv & DOI Paper Downloader Proxy
app.post('/api/arxiv/download', async (req, res) => {
  const rawInput = req.body?.arxivId || req.body?.doi || req.body?.query || '';
  if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
    return res.status(400).json({ error: 'arXiv ID, DOI, or URL is required' });
  }

  try {
    const info = await resolvePaperMetadataAndCandidates(rawInput.trim());
    if (info.type === 'doi' && !info.foundMetadata && info.title === info.doi) {
      return res.status(404).json({ error: `Paper not found for DOI "${info.doi}"` });
    }

    let pdfBuffer = null;
    for (const candidateUrl of info.candidatePdfUrls) {
      pdfBuffer = await tryFetchPdfBuffer(candidateUrl);
      if (pdfBuffer) break;
    }

    if (!pdfBuffer) {
      const label = info.doi ? `DOI "${info.doi}" (${info.title})` : `arXiv ID "${info.arxivId}"`;
      return res.status(404).json({
        error: `Could not retrieve an open-access PDF for ${label}. If the paper is behind a publisher paywall, please upload the PDF directly.`,
      });
    }

    const pdfBase64 = pdfBuffer.toString('base64');
    const cleanTitle = info.title.replace(/[\/\\:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
    const truncatedTitle = cleanTitle.length > 100 ? cleanTitle.substring(0, 100).trim() + '...' : cleanTitle;
    const primaryId = info.arxivId || info.doi || 'paper';
    const safeId = primaryId.replace(/[\/\\:*?"<>|]/g, '_');
    const filename = `${safeId} - ${truncatedTitle}.pdf`;

    res.json({
      ok: true,
      arxivId: info.arxivId,
      doi: info.doi,
      title: info.title,
      authors: info.authors,
      filename,
      pdfBase64,
    });
  } catch (err) {
    console.error('Paper download error:', err);
    res.status(500).json({ error: 'Failed to download paper', details: err.message });
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
    const defaultUri = process.env.GOOGLE_REDIRECT_URI || 'https://chlio.ereuna.org';
    const origin = req.query.origin || defaultUri;
    const redirectUri = req.query.redirectUri || defaultUri;
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
    const defaultUri = process.env.GOOGLE_REDIRECT_URI || 'https://chlio.ereuna.org';
    const result = await exchangeGoogleCode(code, redirectUri || defaultUri);
    res.json({ ok: true, email: result.email });
  } catch (err) {
    console.error('Exchange error:', err);
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const defaultUri = process.env.GOOGLE_REDIRECT_URI || 'https://chlio.ereuna.org';
    const { code, state, error } = req.query;
    if (error) {
      return res.redirect(`${defaultUri}/?google_error=${encodeURIComponent(error)}`);
    }
    if (!code) {
      return res.status(400).send('Missing authorization code');
    }
    const { returnOrigin, email } = await handleGoogleCallback(code, state);
    if (email) {
      saveAuthSession({
        uid: `google:${email.toLowerCase()}`,
        email,
        name: email.split('@')[0],
        photoURL: '',
        emailVerified: true,
        provider: 'google.com',
        lastLoginAt: new Date().toISOString(),
      });
    }
    res.redirect(`${returnOrigin || defaultUri}?google_connected=true`);
  } catch (err) {
    console.error('Google callback error:', err);
    res.redirect(`${process.env.GOOGLE_REDIRECT_URI || 'https://chlio.ereuna.org'}/?google_error=${encodeURIComponent(err.message)}`);
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
    const { timeMin, timeMax, timeZone } = req.query;
    const events = await getGoogleCalendarEvents(timeMin, timeMax, timeZone);
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

// ==========================================
// Firebase Google Authentication Endpoints
// ==========================================
app.get('/api/auth/firebase-config', async (req, res) => {
  try {
    const config = await getFirebaseWebConfig(req.hostname);
    res.json({ ok: true, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', (_req, res) => {
  try {
    const user = getSavedAuthSession();
    res.json({ ok: true, authenticated: !!user, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/verify', async (req, res) => {
  try {
    const { idToken } = req.body || {};
    const user = await verifyFirebaseIdToken(idToken);
    res.json({ ok: true, user });
  } catch (err) {
    console.error('Firebase token verification error:', err.message);
    res.status(401).json({ error: err.message });
  }
});

app.post('/api/auth/custom-token', async (req, res) => {
  try {
    const googleStatus = getGoogleStatus();
    const email = req.body?.email || (googleStatus.connected ? googleStatus.email : '');
    const name = req.body?.name || (email ? email.split('@')[0] : 'Google User');
    const photoURL = req.body?.photoURL || '';
    if (!email) {
      return res.status(400).json({ error: 'No Google account email available for custom token' });
    }
    const uid = `google:${email.toLowerCase()}`;
    const webConfig = await getFirebaseWebConfig(req.hostname);
    let customToken = '';
    let idToken = '';

    try {
      customToken = createFirebaseCustomToken(uid, { email, name });
      // Exchange custom token for a real Firebase ID token via Identity Toolkit
      const exchangeRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(webConfig.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: customToken, returnSecureToken: true }),
        }
      );
      if (exchangeRes.ok) {
        const exData = await exchangeRes.json();
        idToken = exData.idToken || '';
      } else {
        customToken = '';
      }
    } catch {
      customToken = '';
    }

    const user = {
      uid,
      email,
      name,
      photoURL,
      emailVerified: true,
      provider: 'google.com',
      lastLoginAt: new Date().toISOString(),
    };
    saveAuthSession(user);
    res.json({ ok: true, customToken, idToken, user });
  } catch (err) {
    console.error('Custom token error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  try {
    clearAuthSession();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// BibTeX & Citation Graph Discovery Endpoints
// ==========================================
app.post('/api/arxiv/bibtex', async (req, res) => {
  try {
    const { doi, arxivId, title = 'Untitled Paper', authors = 'Unknown Author', year } = req.body || {};
    const pubYear = year || (arxivId && /^\d{4}/.test(arxivId) ? `20${arxivId.slice(0, 2)}` : new Date().getFullYear());

    // 1. If DOI is available, try content-negotiation for official BibTeX
    if (doi) {
      try {
        const cleanDoi = String(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').trim();
        const doiRes = await fetch(`https://doi.org/${encodeURI(cleanDoi)}`, {
          headers: { Accept: 'application/x-bibtex; charset=utf-8' },
          redirect: 'follow',
        });
        if (doiRes.ok) {
          const bibText = (await doiRes.text()).trim();
          if (bibText.startsWith('@')) {
            const apa = `${authors} (${pubYear}). ${title}. https://doi.org/${cleanDoi}`;
            return res.json({ ok: true, bibtex: bibText, apa });
          }
        }
      } catch {
        // fall through to synthesized BibTeX
      }
    }

    // 2. Synthesize clean BibTeX entry
    const firstAuthorLast = String(authors)
      .split(',')[0]
      .trim()
      .split(/\s+/)
      .pop()
      ?.replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase() || 'paper';
    const firstWord = String(title)
      .split(/\s+/)[0]
      ?.replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase() || 'work';
    const citeKey = `${firstAuthorLast}${pubYear}${firstWord}`;
    const formattedAuthors = String(authors)
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean)
      .join(' and ');

    const lines = [
      `@article{${citeKey},`,
      `  title = {${title}},`,
      `  author = {${formattedAuthors || 'Unknown'}},`,
      `  year = {${pubYear}},`,
    ];
    if (arxivId) {
      lines.push(`  eprint = {${arxivId}},`);
      lines.push(`  archivePrefix = {arXiv},`);
      lines.push(`  url = {https://arxiv.org/abs/${arxivId}},`);
    }
    if (doi) {
      lines.push(`  doi = {${doi}},`);
    }
    lines.push(`}`);

    const bibtex = lines.join('\n');
    const apa = `${authors} (${pubYear}). ${title}.${doi ? ` https://doi.org/${doi}` : arxivId ? ` arXiv:${arxivId}` : ''}`;
    res.json({ ok: true, bibtex, apa });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/arxiv/citations', async (req, res) => {
  try {
    const { doi, arxivId, title } = req.body || {};
    let s2PaperId = '';
    if (doi) {
      const cleanDoi = String(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').trim();
      s2PaperId = `DOI:${cleanDoi}`;
    } else if (arxivId) {
      const cleanArxiv = String(arxivId).replace(/v\d+$/i, '').trim();
      s2PaperId = `ARXIV:${cleanArxiv}`;
    }

    const formatS2Item = (item) => {
      if (!item || !item.title) return null;
      const ext = item.externalIds || {};
      const itemAuthors = Array.isArray(item.authors)
        ? item.authors.map((a) => a.name).filter(Boolean).slice(0, 5).join(', ')
        : 'Unknown Authors';
      return {
        title: item.title,
        authors: itemAuthors || 'Unknown Authors',
        year: item.year || null,
        doi: ext.DOI || undefined,
        arxivId: ext.ArXiv || undefined,
        pdfUrl: item.openAccessPdf?.url || (ext.ArXiv ? `https://arxiv.org/pdf/${ext.ArXiv}.pdf` : undefined),
        identifier: ext.ArXiv || ext.DOI || item.title,
      };
    };

    if (s2PaperId) {
      try {
        const fields = [
          'title',
          'year',
          'authors',
          'externalIds',
          'References.title',
          'References.year',
          'References.authors',
          'References.externalIds',
          'References.openAccessPdf',
          'citations.title',
          'citations.year',
          'citations.authors',
          'citations.externalIds',
          'citations.openAccessPdf',
        ].join(',').replace(/References/g, 'references');

        const s2Res = await fetch(
          `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(s2PaperId)}?fields=${fields}`,
          { headers: { 'User-Agent': 'ChlioResearchApp/1.0' } }
        );
        if (s2Res.ok) {
          const s2Data = await s2Res.json();
          const references = (s2Data.references || []).map(formatS2Item).filter(Boolean).slice(0, 15);
          const citations = (s2Data.citations || []).map(formatS2Item).filter(Boolean).slice(0, 15);
          if (references.length > 0 || citations.length > 0) {
            return res.json({ ok: true, references, citations });
          }
        }
      } catch (err) {
        console.warn('Semantic Scholar citation graph lookup failed:', err.message);
      }
    }

    // Fallback: OpenAlex search by DOI or title
    try {
      let oaWork = null;
      if (doi) {
        const cleanDoi = String(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').trim();
        const oaRes = await fetch(`https://api.openalex.org/works/https://doi.org/${encodeURI(cleanDoi)}`);
        if (oaRes.ok) oaWork = await oaRes.json();
      } else if (title) {
        const oaSearch = await fetch(
          `https://api.openalex.org/works?search=${encodeURIComponent(title)}&per-page=1`
        );
        if (oaSearch.ok) {
          const oaList = await oaSearch.json();
          oaWork = oaList.results?.[0] || null;
        }
      }

      if (oaWork) {
        const refIds = (oaWork.referenced_works || [])
          .slice(0, 10)
          .map((u) => u.split('/').pop())
          .filter(Boolean);
        let references = [];
        if (refIds.length > 0) {
          const refRes = await fetch(
            `https://api.openalex.org/works?filter=openalex_id:${refIds.join('|')}&per-page=10`
          );
          if (refRes.ok) {
            const refData = await refRes.json();
            references = (refData.results || []).map((w) => {
              const wDoi = w.doi ? String(w.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') : undefined;
              const wAuthors = (w.authorships || [])
                .map((a) => a.author?.display_name)
                .filter(Boolean)
                .slice(0, 5)
                .join(', ');
              return {
                title: w.title || w.display_name || 'Untitled',
                authors: wAuthors || 'Unknown Authors',
                year: w.publication_year || null,
                doi: wDoi,
                pdfUrl: w.open_access?.oa_url || w.best_oa_location?.pdf_url || undefined,
                identifier: wDoi || w.title,
              };
            });
          }
        }

        // Fetch citing works from OpenAlex
        let citations = [];
        const oaId = oaWork.id?.split('/').pop();
        if (oaId) {
          const citeRes = await fetch(
            `https://api.openalex.org/works?filter=cites:${oaId}&per-page=10`
          );
          if (citeRes.ok) {
            const citeData = await citeRes.json();
            citations = (citeData.results || []).map((w) => {
              const wDoi = w.doi ? String(w.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') : undefined;
              const wAuthors = (w.authorships || [])
                .map((a) => a.author?.display_name)
                .filter(Boolean)
                .slice(0, 5)
                .join(', ');
              return {
                title: w.title || w.display_name || 'Untitled',
                authors: wAuthors || 'Unknown Authors',
                year: w.publication_year || null,
                doi: wDoi,
                pdfUrl: w.open_access?.oa_url || w.best_oa_location?.pdf_url || undefined,
                identifier: wDoi || w.title,
              };
            });
          }
        }

        return res.json({ ok: true, references, citations });
      }
    } catch (err) {
      console.warn('OpenAlex citation lookup failed:', err.message);
    }

    res.json({ ok: true, references: [], citations: [] });
  } catch (err) {
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
