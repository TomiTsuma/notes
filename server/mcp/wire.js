/**
 * Builds the MCP request handler against the real database and the app's existing Jira / Google clients.
 * Shared by the two ways the MCP server can run:
 *   - inside the API process (server/index.js, when MCP_UPSTREAM is not set), and
 *   - as its own service/container (server/mcp-server.js).
 */
import { loadStatePayload, mutateState } from '../db.js';
import { getJiraIssues, createJiraIssue, transitionJiraIssue, addJiraComment } from '../jira.js';
import { createGoogleCalendarEvent } from '../googleCalendar.js';
import { createMcpHandler } from './handler.js';

export function buildMcpHandler() {
  return createMcpHandler({
    store: { read: () => loadStatePayload() || {}, mutate: mutateState },
    deps: {
      createGoogleEvent: (e) => createGoogleCalendarEvent(e),
      jira: {
        getIssues: () => getJiraIssues(),
        createIssue: (d) => createJiraIssue(d),
        transition: (key, to) => transitionJiraIssue(key, to),
        comment: (key, body) => addJiraComment(key, body),
      },
    },
  });
}
