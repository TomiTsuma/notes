// Run in the node:20 image: cd server && npm test      (needs better-sqlite3)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import Database from 'better-sqlite3';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { initSchema } from '../schema.js';
import { createStateStore } from '../stateStore.js';
import { createAuth, createGoogleClient, parseAllowedEmails, sha256 } from '../auth.js';
import { createMcpHandler } from '../mcp/handler.js';

let server, base, db, auth, store, calls;
const OWNER = 'owner@example.com';

before(async () => {
  db = new Database(':memory:');
  initSchema(db);
  store = createStateStore(db);
  auth = createAuth({
    db,
    google: createGoogleClient({ clientId: 'c', clientSecret: 's' }),
    allowedEmails: parseAllowedEmails(OWNER),
    publicUrl: 'https://chlio.test',
  });
  calls = [];
  const handler = createMcpHandler({
    store: { read: () => store.loadStatePayload() || {}, mutate: store.mutateState },
    deps: {
      createGoogleEvent: async (e) => { calls.push(['google', e]); return { id: 'g-123', htmlLink: 'https://calendar.test/g-123' }; },
      jira: {
        getIssues: async () => [{ jiraKey: 'PRJ-1', jiraStatusName: 'In Progress', title: 'Fix the sync', jiraUrl: 'https://jira.test/browse/PRJ-1' }],
        createIssue: async (d) => { calls.push(['jira.create', d]); return { jiraKey: 'PRJ-2', jiraUrl: 'https://jira.test/browse/PRJ-2' }; },
        transition: async (k, t) => { calls.push(['jira.transition', k, t]); return { transitionedTo: 'Done' }; },
        comment: async (k, c) => { calls.push(['jira.comment', k, c]); },
      },
    },
  });
  const app = express();
  app.use('/api', auth.middleware);
  app.use('/api', auth.router);
  app.get('/api/bootstrap', (_q, r) => r.json({ revision: store.getStateRevision() }));
  app.post('/mcp', auth.tokenGate, express.json({ limit: '2mb' }), handler);
  app.all('/mcp', (_q, r) => r.status(405).json({ error: 'POST only' }));
  await new Promise((ok) => (server = app.listen(0, '127.0.0.1', ok)));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function connect(token, query = '') {
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp${query}`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  return client;
}
const rwToken = () => auth.createAccessToken({ name: 'rw' }).token;
const roToken = () => auth.createAccessToken({ name: 'ro', scope: 'read' }).token;
const out = (r) => r.content.map((c) => c.text).join('\n');
const state = () => store.loadStatePayload() || {};
const idIn = (text, re) => re.exec(text)?.[1];
async function call(c, name, args = {}) { return c.callTool({ name, arguments: args }); }

// ---------------------------------------------------------------------------------------------- access control
test('/mcp: no token, bad token, and browser cookie sessions are all refused', async () => {
  const post = (headers) => fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
  assert.equal((await post({})).status, 401);
  assert.equal((await post({ authorization: 'Bearer chlio_pat_nope' })).status, 401);
  // a valid signed-in browser session must NOT be usable here (CSRF / DNS-rebinding defence)
  const n = Date.now();
  db.prepare('INSERT INTO auth_sessions VALUES (?,?,?,?,?,?,?)').run(sha256('sess'), OWNER, 'Owner', '', n, n, n + 1e9);
  assert.equal((await post({ cookie: 'chlio_session=sess' })).status, 401);
  assert.equal((await fetch(`${base}/api/bootstrap`, { headers: { cookie: 'chlio_session=sess' } })).status, 200, 'the same cookie does work for the API');
  assert.equal((await post({ authorization: `Bearer ${rwToken()}`, origin: 'https://evil.example' })).status, 403);
  assert.equal((await fetch(`${base}/mcp`)).status, 405);
});

test('tools: read-only tokens do not even see write tools; groups narrow the list', async () => {
  const rw = await connect(rwToken());
  const rwNames = (await rw.listTools()).tools.map((t) => t.name);
  assert.equal(rwNames.length, 26, 'mindmaps 9 + planner 9 + notes 3 + jira 4 + search 1');
  for (const n of ['mindmap_create', 'mindmap_add_nodes', 'task_create', 'note_create', 'jira_comment', 'chlio_search']) assert.ok(rwNames.includes(n), n);

  const ro = await connect(roToken());
  const roNames = (await ro.listTools()).tools.map((t) => t.name);
  assert.ok(roNames.includes('mindmap_get') && roNames.includes('chlio_search'));
  for (const n of ['mindmap_create', 'mindmap_delete_board', 'task_create', 'task_delete', 'note_create', 'jira_create_issue', 'jira_transition']) assert.ok(!roNames.includes(n), `${n} hidden from read-only`);
  assert.ok((await ro.callTool({ name: 'mindmap_create', arguments: { name: 'x', outline: '- a' } })).isError, 'calling a hidden write tool fails');

  const only = await connect(rwToken(), '?groups=search');
  assert.deepEqual((await only.listTools()).tools.map((t) => t.name), ['chlio_search']);
  const two = await connect(rwToken(), '?groups=mindmaps,planner');
  const twoNames = (await two.listTools()).tools.map((t) => t.name);
  assert.ok(twoNames.every((n) => n.startsWith('mindmap_') || /^(project|task|event)s?_/.test(n)));
  const junk = await connect(rwToken(), '?groups=bogus');
  assert.equal((await junk.listTools()).tools.length, rwNames.length, 'unknown groups fall back to all');
  await Promise.all([rw, ro, only, two, junk].map((c) => c.close()));
});

test('tool schemas are small enough to be sent with every message', async () => {
  const c = await connect(rwToken());
  const tools = (await c.listTools()).tools;
  const bytes = JSON.stringify(tools).length;
  console.log(`# ${tools.length} tools, ~${Math.round(bytes / 4)} tokens of schema in total`);
  assert.ok(bytes / 4 < 9000, `schemas are ${Math.round(bytes / 4)} tokens`);
  await c.close();
});

// ---------------------------------------------------------------------------------------------- mind maps
test('mind map lifecycle: create, read, add, edit, link, delete', async () => {
  const c = await connect(rwToken());
  const rev0 = store.getStateRevision();

  const created = await call(c, 'mindmap_create', { name: 'Thesis plan', outline: '- Thesis | main argument\n  - Chapter 1 | background\n    - Lit review\n  - Chapter 2\n  - Chapter 3' });
  assert.ok(!created.isError, out(created));
  const boardId = idIn(out(created), /\[(board-[\w-]+)\]/);
  assert.ok(boardId);
  assert.equal(state().mindMapBoards.length, 1);
  assert.equal(state().mindMapBoards[0].nodes.length, 5);
  assert.equal(state().mindMapBoards[0].edges.length, 4);
  assert.ok(store.getStateRevision() > rev0, 'writing bumps the revision so the browser notices');

  assert.match(out(await call(c, 'mindmap_list')), /Thesis plan/);
  const got = out(await call(c, 'mindmap_get', { board: 'thesis PLAN' })); // by name, case-insensitive
  assert.match(got, /Lit review \[mm-/);
  const ch1 = idIn(got, /Chapter 1 \[(mm-[\w-]+)\]/);
  const thesis = idIn(got, /Thesis \[(mm-[\w-]+)\]/);

  const added = await call(c, 'mindmap_add_nodes', { board: boardId, nodes: [
    { ref: 'a', title: 'Methods', parent: ch1, content: 'how I did it' },
    { title: 'Survey design', parent: 'a' },
    { title: 'Reminder', type: 'sticky' },
  ] });
  assert.ok(!added.isError, out(added));
  const b = state().mindMapBoards[0];
  assert.equal(b.nodes.length, 8);
  const methods = b.nodes.find((n) => n.title === 'Methods');
  assert.ok(methods.x > b.nodes.find((n) => n.id === ch1).x, 'placed beside its parent');
  assert.ok(b.edges.some((e) => e.fromNodeId === methods.id && e.toNodeId === b.nodes.find((n) => n.title === 'Survey design').id), 'ref resolved to a link');
  assert.equal(b.nodes.find((n) => n.title === 'Reminder').type, 'sticky');
  assert.equal(b.nodes.find((n) => n.title === 'Reminder').color, 'amber');

  assert.ok(!(await call(c, 'mindmap_update_node', { board: boardId, node_id: methods.id, title: 'Research methods', color: 'sage' })).isError);
  assert.equal(state().mindMapBoards[0].nodes.find((n) => n.id === methods.id).title, 'Research methods');

  const link = await call(c, 'mindmap_connect', { board: boardId, from_id: methods.id, to_id: thesis, label: 'supports', style: 'dashed' });
  assert.ok(!link.isError, out(link));
  assert.ok((await call(c, 'mindmap_connect', { board: boardId, from_id: methods.id, to_id: thesis })).isError, 'duplicate link refused');
  assert.match(out(await call(c, 'mindmap_get', { board: boardId })), /Cross-links:[\s\S]*supports/);
  assert.ok(!(await call(c, 'mindmap_connect', { board: boardId, from_id: methods.id, to_id: thesis, remove: true })).isError);

  const del = await call(c, 'mindmap_delete_nodes', { board: boardId, node_ids: [methods.id] });
  assert.ok(!del.isError);
  const after = state().mindMapBoards[0];
  assert.ok(!after.nodes.some((n) => n.id === methods.id) && !after.edges.some((e) => e.fromNodeId === methods.id || e.toNodeId === methods.id));
  assert.ok(after.nodes.some((n) => n.title === 'Survey design'), 'children survive, unlinked');

  assert.ok(!(await call(c, 'mindmap_relayout', { board: boardId, layout: 'radial' })).isError);

  const json = JSON.parse(out(await call(c, 'mindmap_get', { board: boardId, format: 'json' })));
  assert.equal(json.nodes.length, after.nodes.length);

  const refuse = await call(c, 'mindmap_delete_board', { board: boardId, confirm: false });
  assert.ok(refuse.isError);
  assert.equal(state().mindMapBoards.length, 1, 'still there');
  assert.ok(!(await call(c, 'mindmap_delete_board', { board: boardId, confirm: true })).isError);
  assert.equal(state().mindMapBoards.length, 0);
  await c.close();
});

test('a failing call changes nothing (transaction rolls back, revision unchanged)', async () => {
  const c = await connect(rwToken());
  const made = await call(c, 'mindmap_create', { name: 'Atomic', outline: '- Root\n  - A' });
  const boardId = idIn(out(made), /\[(board-[\w-]+)\]/);
  const before = JSON.stringify(state());
  const rev = store.getStateRevision();
  const r = await call(c, 'mindmap_add_nodes', { board: boardId, nodes: [{ title: 'fine' }, { title: 'broken', parent: 'mm-does-not-exist' }] });
  assert.ok(r.isError);
  assert.match(out(r), /Unknown parent/);
  assert.equal(JSON.stringify(state()), before, 'the first (valid) node was not half-saved');
  assert.equal(store.getStateRevision(), rev);
  for (const [name, args] of [
    ['mindmap_get', { board: 'no such board' }],
    ['mindmap_create', { name: 'x' }],
    ['mindmap_create', { name: 'x', outline: '- a', project_id: 'proj-missing' }],
    ['mindmap_update_node', { board: boardId, node_id: 'mm-nope', title: 'x' }],
  ]) assert.ok((await call(c, name, args)).isError, name);
  assert.equal(store.getStateRevision(), rev);
  await c.close();
});

test('mindmap_create handles the largest allowed outline and rejects one node more', async () => {
  const c = await connect(rwToken());
  const lines = (n) => ['- Root', ...Array.from({ length: n - 1 }, (_, i) => `  - Node ${i}`)].join('\n');
  assert.ok(!(await call(c, 'mindmap_create', { name: 'Big', outline: lines(200) })).isError);
  assert.match(out(await call(c, 'mindmap_create', { name: 'Too big', outline: lines(201) })), /Too many nodes/);
  const tree = await call(c, 'mindmap_create', { name: 'From JSON', tree: { title: 'R', children: [{ title: 'K', color: 'rose' }] } });
  assert.ok(!tree.isError, out(tree));
  await c.close();
});

// ---------------------------------------------------------------------------------------------- planner
test('planner: projects, tasks, events (incl. Google) work and validate references', async () => {
  const c = await connect(rwToken());
  const proj = out(await call(c, 'project_create', { name: 'Dissertation', description: 'INTI' }));
  const pid = idIn(proj, /\[(proj-[\w-]+)\]/);
  assert.match(out(await call(c, 'projects_list')), /Dissertation/);

  assert.ok((await call(c, 'task_create', { project_id: 'proj-missing', title: 'x' })).isError);
  const t1 = out(await call(c, 'task_create', { project_id: pid, title: 'Write abstract', priority: 'high', due_date: '2026-12-01' }));
  const tid = idIn(t1, /\[(task-[\w-]+)\]/);
  await call(c, 'task_create', { project_id: pid, title: 'Collect data' });
  assert.ok((await call(c, 'task_create', { project_id: pid, title: 'bad', due_date: '01/12/2026' })).isError, 'bad date rejected by the schema');

  await call(c, 'task_update', { task_id: tid, status: 'inprogress' });
  assert.match(out(await call(c, 'tasks_list', { status: 'inprogress' })), /Write abstract/);
  assert.match(out(await call(c, 'tasks_list', { query: 'collect' })), /Collect data/);
  assert.equal(out(await call(c, 'tasks_list', { project_id: pid, status: 'done' })), 'No matching tasks.');
  await call(c, 'task_update', { task_id: tid, due_date: '' });
  assert.equal(state().kanbanTasks.find((t) => t.id === tid).dueDate, undefined, 'empty due_date clears it');

  const ev = out(await call(c, 'event_create', { title: 'Supervisor meeting', date: '2026-12-02', start_time: '14:00', end_time: '15:00', add_to_google: true }));
  assert.match(ev, /also in Google Calendar/);
  assert.equal(calls.find((x) => x[0] === 'google')[1].startTime, '14:00');
  assert.equal(state().calendarEvents[0].googleEventId, 'g-123');
  assert.match(out(await call(c, 'events_list', { from: '2026-12-01', to: '2026-12-31' })), /Supervisor meeting/);
  assert.match(out(await call(c, 'events_list', { from: '2027-01-01', to: '2027-01-31' })), /No events/);

  const eid = idIn(ev, /\[(ev-[\w-]+)\]/);
  assert.ok(!(await call(c, 'event_delete', { event_id: eid })).isError);
  assert.ok(!(await call(c, 'task_delete', { task_id: tid })).isError);
  assert.ok((await call(c, 'task_delete', { task_id: tid })).isError);
  await c.close();
});

// ---------------------------------------------------------------------------------------------- notes, jira, search
test('notes: typed notebooks are created in the same shape the app uses, paginated, and readable', async () => {
  const c = await connect(rwToken());
  const body = Array.from({ length: 70 }, (_, i) => `Line ${i + 1}: ${'word '.repeat(i % 5 === 0 ? 30 : 4)}`).join('\n');
  const made = out(await call(c, 'note_create', { name: 'Reading notes', text: body }));
  const nid = idIn(made, /\[(notebook-\d+)\]/);
  const f = state().files.find((x) => x.id === nid);
  assert.equal(f.type, 'notebook');
  assert.ok(f.name.endsWith('.notebook'));
  assert.ok(f.notebookPageIds.length >= 3);
  const first = state().annotations[f.notebookPageIds[0]];
  assert.equal(first.textElements[0].id, `${f.notebookPageIds[0]}-lined-notes`, 'the id the notebook editor looks up');
  assert.deepEqual([first.textElements[0].x, first.textElements[0].y], [88, 32]);
  assert.ok(first.textElements[0].text.split('\n').length <= 28, 'a page holds at most 28 lines');
  assert.match(out(await call(c, 'notes_list', { query: 'reading' })), /Reading notes/);
  const read = out(await call(c, 'note_read', { file_id: nid }));
  assert.match(read, /--- Page 1/);
  assert.match(read, /Line 1:/);
  assert.match(read, /Line 70:/, 'later pages are included');
  assert.ok((await call(c, 'note_read', { file_id: 'nope' })).isError);
  await c.close();
});

test('jira tools pass through to the existing Jira client', async () => {
  const c = await connect(rwToken());
  assert.match(out(await call(c, 'jira_issues', { query: 'sync' })), /PRJ-1 \[In Progress\] Fix the sync/);
  assert.match(out(await call(c, 'jira_create_issue', { title: 'New thing', due_date: '2026-12-10' })), /PRJ-2/);
  assert.equal(calls.find((x) => x[0] === 'jira.create')[1].dueDate, '2026-12-10');
  assert.match(out(await call(c, 'jira_transition', { issue_key: 'PRJ-1', to: 'done' })), /Done/);
  await call(c, 'jira_comment', { issue_key: 'PRJ-1', comment: 'looks good' });
  assert.deepEqual(calls.find((x) => x[0] === 'jira.comment').slice(1), ['PRJ-1', 'looks good']);
  assert.ok((await call(c, 'jira_transition', { issue_key: 'lowercase-1', to: 'done' })).isError, 'malformed issue key rejected');
  await c.close();
});

test('search finds node text, tasks, events and typed notes', async () => {
  const c = await connect(rwToken());
  await call(c, 'mindmap_create', { name: 'Search board', outline: '- Root\n  - Photosynthesis | chlorophyll absorbs light' });
  const r = out(await call(c, 'chlio_search', { query: 'chlorophyll' }));
  assert.match(r, /mind-map node: "Photosynthesis"/);
  assert.match(out(await call(c, 'chlio_search', { query: 'collect' })), /task:/); // ("Write abstract" was deleted by the planner test)
  assert.match(out(await call(c, 'chlio_search', { query: 'Line 70' })), /note text: Reading notes/);
  assert.match(out(await call(c, 'chlio_search', { query: 'zzzz-not-here' })), /Nothing in Chlio matches/);
  await c.close();
});
