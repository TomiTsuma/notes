/**
 * Forwards `/mcp` to the standalone MCP service (docker-compose service `chlio-mcp`).
 *
 * Why the API forwards it instead of exposing a second public address: https://chlio.ereuna.org/mcp is already
 * configured in Claude Desktop / Open WebUI and the Cloudflare tunnel points at the API's port. Forwarding keeps
 * that address unchanged. No authentication happens here on purpose: the request, including its Authorization
 * header, is passed through untouched and the MCP service does the (single, authoritative) token check.
 *
 * Streaming pass-through with no body parsing and no new dependency.
 */
import http from 'node:http';
import https from 'node:https';

// hop-by-hop headers must not be forwarded (RFC 9110 7.6.1)
const HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);

export function createMcpProxy(upstream, { timeoutMs = 120_000 } = {}) {
  const target = new URL(upstream);
  const lib = target.protocol === 'https:' ? https : http;

  return function mcpProxy(req, res) {
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k)) headers[k] = v;
    // let the MCP service see the original scheme/host (its origin check and logs rely on them)
    headers['x-forwarded-proto'] = req.protocol;
    headers['x-forwarded-for'] = [req.headers['x-forwarded-for'], req.socket.remoteAddress].filter(Boolean).join(', ');

    const upstreamReq = lib.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        method: req.method,
        path: req.originalUrl, // exactly as received, incl. the query string (?groups=...); this is a route, not a mounted router
        headers,
        timeout: timeoutMs,
      },
      (upstreamRes) => {
        const out = {};
        for (const [k, v] of Object.entries(upstreamRes.headers)) if (!HOP.has(k)) out[k] = v;
        res.writeHead(upstreamRes.statusCode || 502, out);
        upstreamRes.pipe(res);
      }
    );

    const fail = (status, message) => {
      if (res.headersSent) return res.destroy();
      res.status(status).json({ jsonrpc: '2.0', error: { code: -32000, message }, id: null });
    };
    upstreamReq.on('timeout', () => upstreamReq.destroy(new Error('timeout')));
    upstreamReq.on('error', (err) => {
      console.error('[mcp-proxy] upstream error:', err.message);
      fail(err.message === 'timeout' ? 504 : 502, 'The MCP service is unavailable; the rest of Chlio is unaffected. Try again shortly.');
    });
    req.on('aborted', () => upstreamReq.destroy());
    req.pipe(upstreamReq);
  };
}
