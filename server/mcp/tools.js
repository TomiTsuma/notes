/**
 * Chlio MCP tools.
 *
 * Tools are grouped so a client can load only what it needs (every tool's schema is sent to the model with
 * every message, so a small local model should not get all of them): mindmaps, planner, notes, papers, jira, search.
 * Select groups with `/mcp?groups=mindmaps,planner` (default: all).
 *
 * Writes go through store.mutate(), which is an atomic read-modify-write that bumps the state revision, so
 * the browser notices and merges (see src/hooks/useStoreSync.ts). Errors are thrown as UserError inside the
 * mutation so the transaction rolls back and nothing is saved.
 */
import crypto from 'node:crypto';
import { z } from 'zod';
import {
  TONES,
  NODE_TYPES,
  TONE_ACCENT,
  MAX_NODES_PER_CALL,
  parseOutline,
  normalizeTree,
  createBoardFromTree,
  layout,
  placeNear,
  boardToOutline,
  boardToJson,
  summarizeBoard,
  newNodeId,
  newEdgeId,
} from './mindmap.js';

export const GROUPS = ['mindmaps', 'planner', 'notes', 'papers', 'jira', 'search'];

class UserError extends Error {}

const rid = () => crypto.randomBytes(4).toString('hex');
const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${rid()}`;
const today = () => new Date().toISOString().slice(0, 10);

const text = (s) => ({ content: [{ type: 'text', text: s }] });
const fail = (s) => ({ content: [{ type: 'text', text: s }], isError: true });
const list = (state, key) => (Array.isArray(state[key]) ? state[key] : (state[key] = []));

const STATUSES = ['todo', 'inprogress', 'review', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');
const TIME = z.string().regex(/^\d{2}:\d{2}$/, 'use HH:MM (24h)');

function findBoard(state, ref) {
  const boards = list(state, 'mindMapBoards');
  const r = String(ref || '').trim();
  const byId = boards.find((b) => b.id === r);
  if (byId) return byId;
  const byName = boards.filter((b) => String(b.name).toLowerCase() === r.toLowerCase());
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) throw new UserError(`More than one board is named "${r}". Use an id: ${byName.map((b) => b.id).join(', ')}`);
  throw new UserError(`No mind map "${r}". Call mindmap_list to see the boards and their ids.`);
}

function findNode(board, nodeId) {
  const n = board.nodes.find((x) => x.id === nodeId);
  if (!n) throw new UserError(`No node "${nodeId}" on board "${board.name}". Call mindmap_get to see node ids.`);
  return n;
}

const touch = (board) => {
  board.updatedAt = new Date().toISOString();
};

/** Finds a project by id, exact name, or a unique case-insensitive part of its name ("ereuna"). */
function findProject(state, ref) {
  const projects = list(state, 'projects');
  const r = String(ref || '').trim().toLowerCase();
  const exact = projects.find((p) => p.id === ref) || projects.find((p) => String(p.name).toLowerCase() === r);
  if (exact) return exact;
  const partial = projects.filter((p) => r && String(p.name).toLowerCase().includes(r));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) throw new UserError(`"${ref}" matches several projects: ${partial.map((p) => `"${p.name}" [${p.id}]`).join(', ')}. Use an id.`);
  const names = projects.map((p) => `"${p.name}" [${p.id}]`).join(', ') || 'none yet (use project_create)';
  throw new UserError(`No project "${ref}". Existing projects: ${names}.`);
}

// Identity of a paper, so adding the same paper twice (from two databases, or in two searches) does not duplicate it.
const normDoi = (d) => String(d || '').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').replace(/^doi:\s*/, '');
const normArxiv = (a) => String(a || '').trim().toLowerCase().replace(/^https?:\/\/arxiv\.org\/(abs|pdf)\//, '').replace(/^arxiv:\s*/, '').replace(/\.pdf$/, '').replace(/v\d+$/, '');
const normTitle = (t) => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function sameProjectItem(a, b) {
  if (normDoi(a.doi) && normDoi(a.doi) === normDoi(b.doi)) return true;
  if (normArxiv(a.arxivId) && normArxiv(a.arxivId) === normArxiv(b.arxivId)) return true;
  return normTitle(a.title).length > 10 && normTitle(a.title) === normTitle(b.title);
}
const describePaper = (r) => `[${r.status}] ${r.title}${r.authors ? ` - ${r.authors}` : ''}${r.year ? ` (${r.year})` : ''} [${r.id}]${r.doi ? ` doi:${r.doi}` : ''}${r.arxivId ? ` arXiv:${r.arxivId}` : ''}`;

function projectName(state, projectId) {
  return list(state, 'projects').find((p) => p.id === projectId)?.name;
}

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {{ scope: 'read'|'write', groups: Set<string>, store: {read: Function, mutate: Function}, deps: object }} ctx
 */
export function registerTools(server, { scope, groups, store, deps = {} }) {
  const canWrite = scope !== 'read';

  /** Registers a tool; write tools are not even offered to read-only tokens. */
  const tool = (group, name, { title, description, input = {}, write = false, destructive = false }, handler) => {
    if (!groups.has(group)) return;
    if (write && !canWrite) return;
    server.registerTool(
      name,
      {
        title,
        description,
        inputSchema: input,
        annotations: { readOnlyHint: !write, destructiveHint: write && destructive, idempotentHint: !write, openWorldHint: false },
      },
      async (args) => {
        try {
          if (write && !canWrite) return fail('This token is read-only.');
          return await handler(args);
        } catch (e) {
          if (e instanceof UserError) return fail(e.message);
          console.error(`[mcp] ${name} failed:`, e);
          return fail(`${name} failed: ${e.message}`);
        }
      }
    );
  };

  /** Runs `fn(state)` atomically; a UserError inside rolls everything back. */
  const mutate = (fn) => {
    let out;
    store.mutate((state) => {
      out = fn(state);
    });
    return out;
  };

  // ============================================================================================= mind maps
  tool('mindmaps', 'mindmap_list', {
    title: 'List mind maps',
    description: 'List the mind-map boards in Chlio with their ids, names and sizes.',
  }, async () => {
    const boards = list(store.read(), 'mindMapBoards');
    if (!boards.length) return text('There are no mind maps yet. Use mindmap_create to make one.');
    return text(boards.map((b) => { const s = summarizeBoard(b); return `- ${s.name} [${s.id}] ${s.nodes} nodes, ${s.edges} links, updated ${s.updatedAt}`; }).join('\n'));
  });

  tool('mindmaps', 'mindmap_get', {
    title: 'Read a mind map',
    description: 'Read one mind map. format="outline" (default) shows the tree as an indented list with node ids; "json" gives every node and link.',
    input: { board: z.string().describe('Board id or exact name'), format: z.enum(['outline', 'json']).optional() },
  }, async ({ board, format }) => {
    const b = findBoard(store.read(), board);
    if (format === 'json') return text(JSON.stringify(boardToJson(b), null, 1));
    return text(`Mind map "${b.name}" [${b.id}]\n\n${boardToOutline(b)}`);
  });

  tool('mindmaps', 'mindmap_create', {
    title: 'Create a mind map',
    write: true,
    description:
      'Create a new mind map from an outline; Chlio positions and colours the nodes. Outline format: one node per line, indent with 2 spaces to nest, "Title | optional note" for text inside the node. Example:\n- Central idea | why it matters\n  - Branch A\n    - Detail 1 | a note\n  - Branch B\nUp to 200 nodes. Alternatively pass `tree` as JSON {title, content?, children?: [...]}.',
    input: {
      name: z.string().min(1).max(120).describe('Name of the board'),
      outline: z.string().max(40000).optional().describe('Indented outline (preferred)'),
      tree: z.object({ title: z.string() }).passthrough().optional().describe('JSON tree, alternative to outline'),
      layout: z.enum(['tree', 'radial']).optional().describe('tree (default, left to right) or radial'),
      project_id: z.string().optional().describe('Attach to a project (see projects_list)'),
    },
  }, async ({ name, outline, tree, layout: kind, project_id }) => {
    if (!outline && !tree) throw new UserError('Provide an `outline` (or a `tree`).');
    const t = tree ? normalizeTree(tree) : parseOutline(outline, name);
    return mutate((state) => {
      if (project_id && !list(state, 'projects').some((p) => p.id === project_id)) throw new UserError(`No project "${project_id}". Call projects_list.`);
      const board = createBoardFromTree(name, t, { layoutKind: kind || 'tree', projectId: project_id });
      list(state, 'mindMapBoards').push(board);
      return text(`Created mind map "${board.name}" [${board.id}] with ${board.nodes.length} nodes. It appears in Chlio's Mind Map view within a few seconds.\n\n${boardToOutline(board, { maxChars: 4000 })}`);
    });
  });

  tool('mindmaps', 'mindmap_add_nodes', {
    title: 'Add nodes to a mind map',
    write: true,
    description:
      'Add nodes to an existing mind map without disturbing its layout. Each node: title, optional content, optional parent (an existing node id, or the `ref` of an earlier node in this same call), optional type (idea|sticky|paper|point) and color (sky|amber|rose|sage|lilac|stone). Nodes with a parent are linked to it and placed beside it. Up to 100 per call.',
    input: {
      board: z.string().describe('Board id or exact name'),
      nodes: z.array(z.object({
        ref: z.string().max(40).optional().describe('Temporary name so later nodes in this call can use it as parent'),
        title: z.string().min(1).max(200),
        content: z.string().max(4000).optional(),
        parent: z.string().optional().describe('Existing node id or an earlier ref'),
        type: z.enum(NODE_TYPES).optional(),
        color: z.enum(TONES).optional(),
      })).min(1).max(100),
    },
  }, async ({ board, nodes }) => mutate((state) => {
    const b = findBoard(state, board);
    const refs = new Map();
    const created = [];
    for (const spec of nodes) {
      let parentId = null;
      if (spec.parent) {
        parentId = refs.get(spec.parent) || (b.nodes.some((n) => n.id === spec.parent) ? spec.parent : null);
        if (!parentId) throw new UserError(`Unknown parent "${spec.parent}" for node "${spec.title}". Use a node id from mindmap_get or the ref of an earlier node in this call.`);
      }
      const parent = parentId ? b.nodes.find((n) => n.id === parentId) : null;
      const type = spec.type || 'idea';
      const node = {
        id: newNodeId(), type, x: 0, y: 0, width: type === 'sticky' ? 220 : 260,
        title: spec.title.trim(), content: (spec.content || '').trim(),
        color: spec.color || parent?.color || (type === 'sticky' ? 'amber' : type === 'paper' ? 'rose' : type === 'point' ? 'lilac' : 'sky'),
      };
      placeNear(b, node, parentId);
      b.nodes.push(node);
      if (parentId) {
        b.edges.push({ id: newEdgeId(), fromNodeId: parentId, toNodeId: node.id, color: TONE_ACCENT[node.color] || TONE_ACCENT.sky, style: 'solid' });
      }
      if (spec.ref) refs.set(spec.ref, node.id);
      created.push(`- ${node.title} [${node.id}]`);
    }
    touch(b);
    return text(`Added ${created.length} node(s) to "${b.name}":\n${created.join('\n')}`);
  }));

  tool('mindmaps', 'mindmap_update_node', {
    title: 'Edit a mind-map node',
    write: true,
    description: 'Change a node\'s title, text, color, type, or position.',
    input: {
      board: z.string(), node_id: z.string(),
      title: z.string().min(1).max(200).optional(), content: z.string().max(4000).optional(),
      color: z.enum(TONES).optional(), type: z.enum(NODE_TYPES).optional(),
      x: z.number().optional(), y: z.number().optional(),
    },
  }, async ({ board, node_id, title, content, color, type, x, y }) => mutate((state) => {
    const b = findBoard(state, board);
    const n = findNode(b, node_id);
    if (title !== undefined) n.title = title.trim();
    if (content !== undefined) n.content = content.trim();
    if (color !== undefined) n.color = color;
    if (type !== undefined) n.type = type;
    if (x !== undefined) n.x = Math.round(x);
    if (y !== undefined) n.y = Math.round(y);
    touch(b);
    return text(`Updated node "${n.title}" [${n.id}] on "${b.name}".`);
  }));

  tool('mindmaps', 'mindmap_connect', {
    title: 'Link or unlink two nodes',
    write: true,
    description: 'Draw a link from one node to another (optionally labelled, solid or dashed). Set remove=true to delete the link between them instead.',
    input: {
      board: z.string(), from_id: z.string(), to_id: z.string(),
      label: z.string().max(80).optional(), style: z.enum(['solid', 'dashed']).optional(), remove: z.boolean().optional(),
    },
  }, async ({ board, from_id, to_id, label, style, remove }) => mutate((state) => {
    const b = findBoard(state, board);
    const a = findNode(b, from_id);
    const c = findNode(b, to_id);
    if (remove) {
      const before = b.edges.length;
      b.edges = b.edges.filter((e) => !(e.fromNodeId === from_id && e.toNodeId === to_id));
      if (b.edges.length === before) throw new UserError('There is no link between those nodes.');
      touch(b);
      return text(`Removed the link "${a.title}" -> "${c.title}".`);
    }
    if (from_id === to_id) throw new UserError('A node cannot link to itself.');
    if (b.edges.some((e) => e.fromNodeId === from_id && e.toNodeId === to_id)) throw new UserError('Those nodes are already linked.');
    b.edges.push({ id: newEdgeId(), fromNodeId: from_id, toNodeId: to_id, color: TONE_ACCENT[a.color] || TONE_ACCENT.sky, style: style || 'solid', ...(label ? { label } : {}) });
    touch(b);
    return text(`Linked "${a.title}" -> "${c.title}"${label ? ` (${label})` : ''}.`);
  }));

  tool('mindmaps', 'mindmap_delete_nodes', {
    title: 'Delete mind-map nodes',
    write: true,
    destructive: true,
    description: 'Delete nodes (and the links attached to them) from a mind map. Children are NOT deleted; they stay on the board, unlinked.',
    input: { board: z.string(), node_ids: z.array(z.string()).min(1).max(100) },
  }, async ({ board, node_ids }) => mutate((state) => {
    const b = findBoard(state, board);
    const gone = new Set(node_ids);
    for (const nid of gone) findNode(b, nid);
    b.nodes = b.nodes.filter((n) => !gone.has(n.id));
    b.edges = b.edges.filter((e) => !gone.has(e.fromNodeId) && !gone.has(e.toNodeId));
    touch(b);
    return text(`Deleted ${gone.size} node(s) from "${b.name}".`);
  }));

  tool('mindmaps', 'mindmap_relayout', {
    title: 'Re-arrange a mind map',
    write: true,
    destructive: true,
    description: 'Re-position ALL nodes of a board automatically (tree or radial). This overwrites any manual arrangement, so only use it when asked to tidy a board.',
    input: { board: z.string(), layout: z.enum(['tree', 'radial']).optional() },
  }, async ({ board, layout: kind }) => mutate((state) => {
    const b = findBoard(state, board);
    layout(b.nodes, b.edges, kind || 'tree');
    touch(b);
    return text(`Re-arranged "${b.name}" (${kind || 'tree'} layout, ${b.nodes.length} nodes).`);
  }));

  tool('mindmaps', 'mindmap_delete_board', {
    title: 'Delete a mind map',
    write: true,
    destructive: true,
    description: 'Permanently delete a whole mind map board. Requires confirm=true.',
    input: { board: z.string(), confirm: z.boolean() },
  }, async ({ board, confirm }) => mutate((state) => {
    if (confirm !== true) throw new UserError('Set confirm=true to delete the board.');
    const b = findBoard(state, board);
    state.mindMapBoards = list(state, 'mindMapBoards').filter((x) => x.id !== b.id);
    if (state.activeMindMapId === b.id) state.activeMindMapId = state.mindMapBoards[0]?.id || null;
    return text(`Deleted mind map "${b.name}".`);
  }));

  // ============================================================================================= planner
  tool('planner', 'projects_list', { title: 'List projects', description: 'List projects with their ids.' }, async () => {
    const ps = list(store.read(), 'projects');
    return text(ps.length ? ps.map((p) => `- ${p.name} [${p.id}]${p.jiraKey ? ` (Jira ${p.jiraKey})` : ''}${p.description ? ` - ${p.description}` : ''}`).join('\n') : 'No projects.');
  });

  tool('planner', 'project_create', {
    title: 'Create a project', write: true,
    description: 'Create a project that tasks, notes, mind maps and events can belong to.',
    input: { name: z.string().min(1).max(120), description: z.string().max(1000).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe('#rrggbb') },
  }, async ({ name, description, color }) => mutate((state) => {
    const p = { id: id('proj'), name: name.trim(), description: (description || '').trim(), color: color || '#0a7aff', createdAt: new Date().toISOString() };
    list(state, 'projects').push(p);
    return text(`Created project "${p.name}" [${p.id}].`);
  }));

  tool('planner', 'tasks_list', {
    title: 'List tasks',
    description: 'List kanban tasks. Filter by project, status (todo|inprogress|review|done) or a text query.',
    input: { project_id: z.string().optional(), status: z.enum(STATUSES).optional(), query: z.string().optional(), limit: z.number().int().min(1).max(100).optional() },
  }, async ({ project_id, status, query, limit }) => {
    const s = store.read();
    const q = (query || '').toLowerCase();
    const rows = list(s, 'kanbanTasks')
      .filter((t) => (!project_id || t.projectId === project_id) && (!status || t.status === status) && (!q || `${t.title} ${t.description}`.toLowerCase().includes(q)))
      .slice(0, limit || 50);
    if (!rows.length) return text('No matching tasks.');
    return text(rows.map((t) => `- [${t.status}] ${t.title} [${t.id}] ${t.priority} priority${t.dueDate ? `, due ${t.dueDate}` : ''}${t.projectId ? `, project ${projectName(s, t.projectId) || t.projectId}` : ''}${t.jiraKey ? `, Jira ${t.jiraKey}` : ''}`).join('\n'));
  });

  tool('planner', 'task_create', {
    title: 'Create a task', write: true,
    description: 'Create a kanban task in a project. (Local to Chlio; use the jira_* tools to create Jira issues.)',
    input: { project_id: z.string(), title: z.string().min(1).max(200), description: z.string().max(4000).optional(), status: z.enum(STATUSES).optional(), priority: z.enum(PRIORITIES).optional(), due_date: DATE.optional() },
  }, async (a) => mutate((state) => {
    if (!list(state, 'projects').some((p) => p.id === a.project_id)) throw new UserError(`No project "${a.project_id}". Call projects_list.`);
    const t = { id: id('task'), projectId: a.project_id, title: a.title.trim(), description: (a.description || '').trim(), status: a.status || 'todo', priority: a.priority || 'medium', ...(a.due_date ? { dueDate: a.due_date } : {}), createdAt: new Date().toISOString() };
    list(state, 'kanbanTasks').push(t);
    return text(`Created task "${t.title}" [${t.id}] (${t.status}).`);
  }));

  tool('planner', 'task_update', {
    title: 'Update a task', write: true,
    description: 'Change a task: title, description, status (moves it between columns), priority or due date. Pass due_date="" to clear it.',
    input: { task_id: z.string(), title: z.string().min(1).max(200).optional(), description: z.string().max(4000).optional(), status: z.enum(STATUSES).optional(), priority: z.enum(PRIORITIES).optional(), due_date: z.union([DATE, z.literal('')]).optional() },
  }, async (a) => mutate((state) => {
    const t = list(state, 'kanbanTasks').find((x) => x.id === a.task_id);
    if (!t) throw new UserError(`No task "${a.task_id}". Call tasks_list.`);
    if (a.title !== undefined) t.title = a.title.trim();
    if (a.description !== undefined) t.description = a.description.trim();
    if (a.status !== undefined) t.status = a.status;
    if (a.priority !== undefined) t.priority = a.priority;
    if (a.due_date !== undefined) { if (a.due_date) t.dueDate = a.due_date; else delete t.dueDate; }
    return text(`Updated task "${t.title}" [${t.id}] -> ${t.status}.${t.jiraKey ? ' Note: this only changes Chlio\'s copy; use jira_transition to move the Jira issue.' : ''}`);
  }));

  tool('planner', 'task_delete', {
    title: 'Delete a task', write: true, destructive: true,
    description: 'Delete a kanban task.', input: { task_id: z.string() },
  }, async ({ task_id }) => mutate((state) => {
    const ts = list(state, 'kanbanTasks');
    const t = ts.find((x) => x.id === task_id);
    if (!t) throw new UserError(`No task "${task_id}".`);
    state.kanbanTasks = ts.filter((x) => x.id !== task_id);
    return text(`Deleted task "${t.title}".`);
  }));

  tool('planner', 'events_list', {
    title: 'List calendar events',
    description: 'List calendar events between two dates (inclusive, YYYY-MM-DD). Defaults to the next 14 days.',
    input: { from: DATE.optional(), to: DATE.optional() },
  }, async ({ from, to }) => {
    const start = from || today();
    const end = to || new Date(Date.parse(start) + 14 * 864e5).toISOString().slice(0, 10);
    const evs = list(store.read(), 'calendarEvents').filter((e) => e.date >= start && e.date <= end).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
    return text(evs.length ? evs.map((e) => `- ${e.date} ${e.startTime}-${e.endTime} ${e.title} [${e.id}]${e.source && e.source !== 'clio' ? ` (${e.source})` : ''}`).join('\n') : `No events from ${start} to ${end}.`);
  });

  tool('planner', 'event_create', {
    title: 'Create a calendar event', write: true,
    description: 'Create a calendar event. Set add_to_google=true to also create it in the connected Google Calendar.',
    input: { title: z.string().min(1).max(200), date: DATE, start_time: TIME.optional(), end_time: TIME.optional(), description: z.string().max(4000).optional(), project_id: z.string().optional(), add_to_google: z.boolean().optional() },
  }, async (a) => {
    let google = null;
    if (a.add_to_google) {
      if (!deps.createGoogleEvent) throw new UserError('Google Calendar is not available.');
      try {
        google = await deps.createGoogleEvent({ title: a.title, description: a.description || '', date: a.date, startTime: a.start_time || '09:00', endTime: a.end_time || '10:00' });
      } catch (e) {
        throw new UserError(`Could not create the Google Calendar event: ${e.message}`);
      }
    }
    return mutate((state) => {
      if (a.project_id && !list(state, 'projects').some((p) => p.id === a.project_id)) throw new UserError(`No project "${a.project_id}".`);
      const ev = { id: id('ev'), title: a.title.trim(), description: (a.description || '').trim(), date: a.date, startTime: a.start_time || '09:00', endTime: a.end_time || '10:00', projectId: a.project_id || null, color: '#a8c5ff', completed: false, createdAt: new Date().toISOString(), source: 'clio', ...(google?.id ? { googleEventId: google.id, htmlLink: google.htmlLink } : {}) };
      list(state, 'calendarEvents').push(ev);
      return text(`Created event "${ev.title}" [${ev.id}] on ${ev.date} ${ev.startTime}-${ev.endTime}${google ? ' (also in Google Calendar)' : ''}.`);
    });
  });

  tool('planner', 'event_delete', {
    title: 'Delete a calendar event', write: true, destructive: true,
    description: 'Delete a calendar event from Chlio (Google-synced events are only removed locally; they come back on the next Google sync).',
    input: { event_id: z.string() },
  }, async ({ event_id }) => mutate((state) => {
    const evs = list(state, 'calendarEvents');
    const e = evs.find((x) => x.id === event_id);
    if (!e) throw new UserError(`No event "${event_id}".`);
    state.calendarEvents = evs.filter((x) => x.id !== event_id);
    return text(`Deleted event "${e.title}".`);
  }));

  // ============================================================================================= notes
  const pageTexts = (state, file) =>
    (file.notebookPageIds || []).map((pid, i) => {
      const els = state.annotations?.[pid]?.textElements || [];
      const lined = els.find((t) => t.id === `${pid}-lined-notes`);
      const others = els.filter((t) => t !== lined).map((t) => t.text).filter(Boolean);
      return { page: i + 1, typed: lined?.text || '', floating: others, strokes: (state.annotations?.[pid]?.strokes || []).length };
    });

  tool('notes', 'notes_list', {
    title: 'List notes and documents',
    description: 'List notebooks and documents (PDFs etc.) with ids, optionally filtered by project or name.',
    input: { project_id: z.string().optional(), query: z.string().optional() },
  }, async ({ project_id, query }) => {
    const s = store.read();
    const q = (query || '').toLowerCase();
    const rows = list(s, 'files').filter((f) => (!project_id || f.projectId === project_id) && (!q || f.name.toLowerCase().includes(q)));
    return text(rows.length ? rows.map((f) => `- ${f.name} [${f.id}] ${f.type}${f.projectId ? `, project ${projectName(s, f.projectId) || f.projectId}` : ''}${f.tags?.length ? `, tags ${f.tags.join('/')}` : ''}`).join('\n') : 'No matching notes.');
  });

  tool('notes', 'note_read', {
    title: 'Read a note',
    description: 'Read the typed text of a notebook (page by page). Handwritten ink cannot be read; its stroke count is reported. For other documents only metadata is available.',
    input: { file_id: z.string() },
  }, async ({ file_id }) => {
    const s = store.read();
    const f = list(s, 'files').find((x) => x.id === file_id || x.name.toLowerCase() === String(file_id).toLowerCase());
    if (!f) throw new UserError(`No note "${file_id}". Call notes_list.`);
    if (f.type !== 'notebook') return text(`"${f.name}" [${f.id}] is a ${f.type} document; its content is not available through MCP.`);
    const pages = pageTexts(s, f);
    return text(`Notebook "${f.name}" [${f.id}], ${pages.length} page(s)\n\n` + pages.map((p) => `--- Page ${p.page}${p.strokes ? ` (${p.strokes} handwritten stroke(s), not readable)` : ''}\n${p.typed || '(no typed text)'}${p.floating.length ? `\nFloating text: ${p.floating.join(' | ')}` : ''}`).join('\n\n'));
  });

  tool('notes', 'note_create', {
    title: 'Create a typed note', write: true,
    description: 'Create a new notebook with typed text on lined pages (it can still be handwritten on later). Long text is split across pages.',
    input: { name: z.string().min(1).max(120), text: z.string().min(1).max(60000), project_id: z.string().optional() },
  }, async ({ name, text: body, project_id }) => mutate((state) => {
    if (project_id && !list(state, 'projects').some((p) => p.id === project_id)) throw new UserError(`No project "${project_id}".`);
    const LINES_PER_PAGE = 28;
    const COLS = 78;
    const wrapped = [];
    for (const line of body.replace(/\r/g, '').split('\n')) {
      if (line.length <= COLS) { wrapped.push(line); continue; }
      let rest = line;
      while (rest.length > COLS) {
        let cut = rest.lastIndexOf(' ', COLS);
        if (cut < COLS / 2) cut = COLS;
        wrapped.push(rest.slice(0, cut).trimEnd());
        rest = rest.slice(cut).trimStart();
      }
      wrapped.push(rest);
    }
    const chunks = [];
    for (let i = 0; i < wrapped.length; i += LINES_PER_PAGE) chunks.push(wrapped.slice(i, i + LINES_PER_PAGE).join('\n'));
    const nbId = `notebook-${Date.now()}`;
    const pageIds = chunks.map((_, i) => `${nbId}-pg-${i + 1}`);
    if (pageIds.length < 3) for (let i = pageIds.length; i < 3; i++) pageIds.push(`${nbId}-pg-${i + 1}`); // the app starts notebooks with 3 pages
    const file = {
      id: nbId, name: name.endsWith('.notebook') ? name : `${name}.notebook`, type: 'notebook', folderId: null, projectId: project_id || null,
      notebookPageIds: pageIds,
      notebookMeta: { pageWidth: 800, pageHeight: 1130, lineSpacing: 32, lineColor: '#d4d4d8', marginColor: '#ffcccc' },
    };
    list(state, 'files').push(file);
    state.annotations = state.annotations || {};
    chunks.forEach((chunk, i) => {
      state.annotations[pageIds[i]] = { strokes: [], textElements: [{ id: `${pageIds[i]}-lined-notes`, x: 88, y: 32, text: chunk, type: 'text' }] };
    });
    return text(`Created notebook "${file.name}" [${file.id}] with ${chunks.length} typed page(s).`);
  }));

  // ============================================================================================= jira (thin wrappers over the app's existing Jira client)
  tool('jira', 'jira_issues', {
    title: 'List Jira issues',
    description: 'List recent Jira issues for the configured Jira project, with status and key.',
    input: { query: z.string().optional(), limit: z.number().int().min(1).max(50).optional() },
  }, async ({ query, limit }) => {
    if (!deps.jira) throw new UserError('Jira is not available.');
    const q = (query || '').toLowerCase();
    const issues = (await deps.jira.getIssues()).filter((i) => !q || `${i.title} ${i.jiraKey}`.toLowerCase().includes(q)).slice(0, limit || 20);
    return text(issues.length ? issues.map((i) => `- ${i.jiraKey} [${i.jiraStatusName}] ${i.title}${i.dueDate ? `, due ${i.dueDate}` : ''} ${i.jiraUrl}`).join('\n') : 'No matching Jira issues.');
  });

  tool('jira', 'jira_create_issue', {
    title: 'Create a Jira issue', write: true,
    description: 'Create a Task in Jira (uses the configured Jira project unless project_key is given).',
    input: { title: z.string().min(1).max(250), description: z.string().max(8000).optional(), project_key: z.string().optional(), due_date: DATE.optional() },
  }, async ({ title, description, project_key, due_date }) => {
    if (!deps.jira) throw new UserError('Jira is not available.');
    const r = await deps.jira.createIssue({ title, description: description || '', projectKey: project_key, dueDate: due_date });
    return text(`Created Jira issue ${r.jiraKey}: ${r.jiraUrl}`);
  });

  tool('jira', 'jira_transition', {
    title: 'Move a Jira issue', write: true,
    description: 'Move a Jira issue to a column: todo, inprogress, review or done.',
    input: { issue_key: z.string().regex(/^[A-Z][A-Z0-9_]+-\d+$/), to: z.enum(STATUSES) },
  }, async ({ issue_key, to }) => {
    if (!deps.jira) throw new UserError('Jira is not available.');
    const r = await deps.jira.transition(issue_key, to);
    return text(`Moved ${issue_key} to "${r.transitionedTo}".`);
  });

  tool('jira', 'jira_comment', {
    title: 'Comment on a Jira issue', write: true,
    description: 'Add a comment to a Jira issue.',
    input: { issue_key: z.string().regex(/^[A-Z][A-Z0-9_]+-\d+$/), comment: z.string().min(1).max(8000) },
  }, async ({ issue_key, comment }) => {
    if (!deps.jira) throw new UserError('Jira is not available.');
    await deps.jira.comment(issue_key, comment);
    return text(`Commented on ${issue_key}.`);
  });

  // ============================================================================================= papers (reading list)
  const READING = ['to-read', 'reading', 'read'];
  const paperInput = z.object({
    title: z.string().min(1).max(500),
    authors: z.union([z.string().max(2000), z.array(z.string().max(200)).max(100)]).optional().describe('"A. Author, B. Author" or a list'),
    year: z.number().int().min(1400).max(2100).optional(),
    venue: z.string().max(300).optional().describe('journal / conference / preprint server'),
    url: z.string().url().max(2000).refine((u) => /^https?:\/\//i.test(u), 'must be an http(s) link').optional(),
    doi: z.string().max(200).optional(),
    arxiv_id: z.string().max(60).optional(),
    abstract: z.string().max(6000).optional(),
    source: z.string().max(60).optional().describe('database it was found in, e.g. arXiv, OpenAlex, PubMed, Semantic Scholar'),
    tags: z.array(z.string().max(40)).max(10).optional(),
    notes: z.string().max(4000).optional().describe('why it matters / what to look for'),
  });

  tool('papers', 'paper_add', {
    title: 'Add papers to a project reading list', write: true,
    description: 'Add one or more papers to a project\'s reading list (visible on the Chlio project page). Pass the metadata you found (title, authors, year, DOI or arXiv id, URL, abstract). Papers already on that project\'s list (same DOI, arXiv id or title) are skipped, so it is safe to re-run a search and add the results again. Up to 50 per call.',
    input: {
      project: z.string().describe('project name (e.g. "Ereuna") or id; see projects_list'),
      papers: z.array(paperInput).min(1).max(50),
      status: z.enum(READING).optional().describe('default to-read'),
    },
  }, async ({ project, papers, status }) => mutate((state) => {
    const proj = findProject(state, project);
    const items = list(state, 'readingList');
    const added = [];
    const skipped = [];
    for (const p of papers) {
      const item = {
        id: id('paper'), projectId: proj.id, title: p.title.trim().replace(/\s+/g, ' '),
        authors: (Array.isArray(p.authors) ? p.authors.join(', ') : p.authors || '').trim(),
        ...(p.year ? { year: p.year } : {}), ...(p.venue ? { venue: p.venue.trim() } : {}), ...(p.url ? { url: p.url } : {}),
        ...(p.doi ? { doi: normDoi(p.doi) } : {}), ...(p.arxiv_id ? { arxivId: normArxiv(p.arxiv_id) } : {}),
        ...(p.abstract ? { abstract: p.abstract.trim() } : {}), ...(p.source ? { source: p.source.trim() } : {}),
        ...(p.tags?.length ? { tags: p.tags.map((t) => t.trim()).filter(Boolean) } : {}), ...(p.notes ? { notes: p.notes.trim() } : {}),
        status: status || 'to-read', addedAt: new Date().toISOString(),
      };
      const dup = items.find((x) => x.projectId === proj.id && sameProjectItem(x, item));
      if (dup) { skipped.push(`"${item.title}" (already on the list [${dup.id}])`); continue; }
      items.push(item);
      added.push(item);
    }
    return text(`Added ${added.length} paper(s) to "${proj.name}" [${proj.id}], skipped ${skipped.length} duplicate(s).` +
      (added.length ? `\nAdded:\n${added.map((r) => `- ${describePaper(r)}`).join('\n')}` : '') +
      (skipped.length ? `\nSkipped:\n${skipped.map((x) => `- ${x}`).join('\n')}` : ''));
  }));

  tool('papers', 'papers_list', {
    title: 'List a reading list',
    description: 'List papers on reading lists. Filter by project (name or id), status (to-read|reading|read) or a text query over title, authors, abstract, tags and notes. Use it before paper_add to see what is already collected.',
    input: { project: z.string().optional(), status: z.enum(READING).optional(), query: z.string().optional(), limit: z.number().int().min(1).max(200).optional() },
  }, async ({ project, status, query, limit }) => {
    const s = store.read();
    const pid = project ? findProject(s, project).id : null;
    const q = (query || '').toLowerCase();
    const all = list(s, 'readingList').filter((r) => (!pid || r.projectId === pid) && (!status || r.status === status) &&
      (!q || [r.title, r.authors, r.abstract, r.notes, ...(r.tags || [])].filter(Boolean).join(' ').toLowerCase().includes(q)));
    if (!all.length) return text('No matching papers on the reading list.');
    const rows = all.slice(0, limit || 100);
    return text(`${all.length} paper(s)${all.length > rows.length ? `, showing ${rows.length}` : ''}:\n` +
      rows.map((r) => `- ${describePaper(r)}${pid ? '' : `, project ${projectName(s, r.projectId) || 'none'}`}`).join('\n'));
  });

  tool('papers', 'paper_update', {
    title: 'Update a paper on a reading list', write: true,
    description: 'Change a paper\'s reading status, notes or tags, or move it to another project. Pass notes="" to clear the notes.',
    input: { paper_id: z.string(), status: z.enum(READING).optional(), notes: z.string().max(4000).optional(), tags: z.array(z.string().max(40)).max(10).optional(), project: z.string().optional().describe('move to this project') },
  }, async (a) => mutate((state) => {
    const r = list(state, 'readingList').find((x) => x.id === a.paper_id);
    if (!r) throw new UserError(`No paper "${a.paper_id}". Call papers_list to see ids.`);
    if (a.status !== undefined) r.status = a.status;
    if (a.notes !== undefined) { if (a.notes.trim()) r.notes = a.notes.trim(); else delete r.notes; }
    if (a.tags !== undefined) r.tags = a.tags.map((t) => t.trim()).filter(Boolean);
    if (a.project !== undefined) r.projectId = findProject(state, a.project).id;
    return text(`Updated: ${describePaper(r)}`);
  }));

  tool('papers', 'paper_remove', {
    title: 'Remove papers from a reading list', write: true, destructive: true,
    description: 'Remove papers from the reading list by id.', input: { paper_ids: z.array(z.string()).min(1).max(50) },
  }, async ({ paper_ids }) => mutate((state) => {
    const items = list(state, 'readingList');
    const gone = items.filter((r) => paper_ids.includes(r.id));
    if (!gone.length) throw new UserError('None of those ids are on a reading list. Call papers_list.');
    state.readingList = items.filter((r) => !paper_ids.includes(r.id));
    return text(`Removed ${gone.length} paper(s): ${gone.map((r) => `"${r.title}"`).join(', ')}.`);
  }));

  // ============================================================================================= search
  tool('search', 'chlio_search', {
    title: 'Search everything in Chlio',
    description: 'Search mind maps (titles and node text), tasks, events, projects, notes (names and typed text) and papers for a word or phrase.',
    input: { query: z.string().min(2).max(200), limit: z.number().int().min(1).max(50).optional() },
  }, async ({ query, limit }) => {
    const s = store.read();
    const q = query.toLowerCase();
    const has = (...parts) => parts.filter(Boolean).join(' ').toLowerCase().includes(q);
    const hits = [];
    for (const b of list(s, 'mindMapBoards')) {
      if (has(b.name)) hits.push(`mind map: ${b.name} [${b.id}]`);
      for (const n of b.nodes || []) if (has(n.title, n.content)) hits.push(`mind-map node: "${n.title}" [${n.id}] on board ${b.name} [${b.id}]`);
    }
    for (const t of list(s, 'kanbanTasks')) if (has(t.title, t.description, t.jiraKey)) hits.push(`task: [${t.status}] ${t.title} [${t.id}]`);
    for (const e of list(s, 'calendarEvents')) if (has(e.title, e.description)) hits.push(`event: ${e.date} ${e.title} [${e.id}]`);
    for (const p of list(s, 'projects')) if (has(p.name, p.description)) hits.push(`project: ${p.name} [${p.id}]`);
    for (const p of list(s, 'papers')) if (has(p.title, p.authors)) hits.push(`paper: ${p.title} (${p.authors})`);
    for (const r of list(s, 'readingList')) if (has(r.title, r.authors, r.abstract, r.notes, ...(r.tags || []))) hits.push(`reading list: [${r.status}] ${r.title} [${r.id}]`);
    for (const f of list(s, 'files')) {
      if (has(f.name)) hits.push(`note: ${f.name} [${f.id}]`);
      if (f.type === 'notebook') for (const pg of pageTexts(s, f)) if (has(pg.typed, ...pg.floating)) hits.push(`note text: ${f.name} [${f.id}] page ${pg.page}`);
    }
    const out = hits.slice(0, limit || 25);
    return text(out.length ? `${hits.length} match(es)${hits.length > out.length ? `, showing ${out.length}` : ''}:\n${out.map((h) => `- ${h}`).join('\n')}` : `Nothing in Chlio matches "${query}".`);
  });
}

export { MAX_NODES_PER_CALL };
