/**
 * Streamable-HTTP MCP endpoint (POST /mcp).
 *
 * Stateless: a fresh McpServer + transport per request, JSON responses (no SSE), so it works through
 * Cloudflare and needs no session bookkeeping. The caller is already authenticated (auth.tokenGate), and
 * its token scope decides which tools exist at all.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools, GROUPS } from './tools.js';

const INSTRUCTIONS = [
  "Chlio is the user's personal research workspace: mind maps, notes, projects, kanban tasks, a calendar and Jira.",
  'To draw a mind map, call mindmap_create with an indented outline; Chlio lays it out. Use mindmap_get first to see node ids before editing.',
  'IDs appear in square brackets in tool results. Ask the user before deleting anything.',
].join(' ');

/** `?groups=mindmaps,planner` -> Set of valid group names; missing/empty/unknown -> all groups. */
export function parseGroups(raw) {
  const wanted = String(Array.isArray(raw) ? raw.join(',') : raw || '')
    .split(',')
    .map((g) => g.trim().toLowerCase())
    .filter((g) => GROUPS.includes(g));
  return new Set(wanted.length ? wanted : GROUPS);
}

export function createMcpHandler({ store, deps = {}, version = '1.0.0' }) {
  return async function mcpHandler(req, res) {
    let server;
    let transport;
    try {
      server = new McpServer({ name: 'chlio', version }, { instructions: INSTRUCTIONS });
      registerTools(server, { scope: req.auth.scope, groups: parseGroups(req.query.groups), store, deps });
      transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on('close', () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('[mcp] request failed:', err);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
      }
    }
  };
}
