/**
 * Mind-map logic for the MCP tools: pure functions on Chlio's board objects (see MindMapBoard in
 * src/store/appStore.ts). No database, no MCP; tested in server/test/mindmap.test.js.
 *
 * Models are bad at choosing pixel coordinates, so tools accept STRUCTURE (an outline / parent ids) and this
 * module places the nodes with the same spacing the app uses (children ~340px to the right, ~230px apart).
 */
import crypto from 'node:crypto';

export const TONES = ['sky', 'amber', 'rose', 'sage', 'lilac', 'stone'];
// Accent colours of the tones in src/components/MindMap/MindMapView.tsx (used for edge colours).
export const TONE_ACCENT = {
  sky: '#0a7aff',
  amber: '#d97706',
  rose: '#e11d48',
  sage: '#059669',
  lilac: '#7c3aed',
  stone: '#475569',
};
export const NODE_TYPES = ['idea', 'sticky', 'paper', 'point'];

const COL_GAP = 340; // horizontal distance parent -> child
const NODE_W = { idea: 260, paper: 260, point: 260, sticky: 220 };
const ROW_PAD = 36; // vertical breathing room between sibling subtrees
export const MAX_NODES_PER_CALL = 200;

const rid = () => crypto.randomBytes(4).toString('hex');
export const newNodeId = () => `mm-${Date.now().toString(36)}-${rid()}`;
export const newEdgeId = () => `edge-${Date.now().toString(36)}-${rid()}`;
export const newBoardId = () => `board-${Date.now().toString(36)}-${rid()}`;

/** Rough rendered height of a node (the app's defaults: idea 145, sticky 175, paper 165), grown for long text. */
export function estimateHeight(node) {
  const base = node.type === 'sticky' ? 175 : node.type === 'paper' ? 165 : 145;
  const text = String(node.content || '');
  const lines = text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 34)), 0);
  return Math.min(480, Math.max(base, 80 + lines * 19));
}
const widthOf = (n) => n.width || NODE_W[n.type] || 260;
const heightOf = (n) => n.height || estimateHeight(n);

export function normalizeTone(tone, fallback = 'sky') {
  return TONES.includes(tone) ? tone : fallback;
}

// ---------------------------------------------------------------------------------------------- outline
/**
 * Parses an indented outline into a tree.
 *
 *   - Root idea | optional note for this node
 *     - Child A
 *       - Grandchild | note
 *     - Child B
 *
 * Bullets may be `-`, `*`, `+` or numbers ("1."), indentation 2/4 spaces or tabs. Several top-level items
 * are allowed (they are joined under a synthetic root named `rootTitle`). A trailing ` [mm-...]` id marker
 * (as produced by boardToOutline) is ignored.
 */
export function parseOutline(text, rootTitle = 'Mind map') {
  const items = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const m = /^([ \t]*)(?:[-*+•]|\d+[.)])?\s*(.+?)\s*$/.exec(raw);
    if (!m) continue;
    const indent = m[1].replace(/\t/g, '    ').length;
    const body = m[2];
    let title = body;
    let content = '';
    const bar = body.indexOf(' | ');
    if (bar >= 0) {
      title = body.slice(0, bar).trim();
      content = body.slice(bar + 3).trim();
    }
    // drop the ` [mm-...]` id marker boardToOutline adds (it sits right after the title, before any note)
    title = title.replace(/\s*\[(?:mm|node)-[\w-]+\]\s*$/, '').trim();
    if (!title) continue;
    items.push({ indent, title, content });
  }
  if (items.length === 0) throw new Error('The outline is empty');
  if (items.length > MAX_NODES_PER_CALL) throw new Error(`Too many nodes (max ${MAX_NODES_PER_CALL} per call)`);

  const roots = [];
  const stack = []; // { indent, node }
  for (const it of items) {
    const node = { title: it.title, content: it.content, children: [] };
    while (stack.length && stack[stack.length - 1].indent >= it.indent) stack.pop();
    if (stack.length) stack[stack.length - 1].node.children.push(node);
    else roots.push(node);
    stack.push({ indent: it.indent, node });
  }
  return roots.length === 1 ? roots[0] : { title: rootTitle, content: '', children: roots };
}

/** Validates/normalises a tree given as JSON ({title, content?, children?}). */
export function normalizeTree(tree) {
  let count = 0;
  const walk = (t, depth) => {
    if (!t || typeof t !== 'object' || !String(t.title || '').trim()) throw new Error('Every node needs a title');
    if (depth > 12) throw new Error('The tree is nested too deeply (max 12 levels)');
    if (++count > MAX_NODES_PER_CALL) throw new Error(`Too many nodes (max ${MAX_NODES_PER_CALL} per call)`);
    return {
      title: String(t.title).trim(),
      content: String(t.content || '').trim(),
      type: NODE_TYPES.includes(t.type) ? t.type : undefined,
      color: TONES.includes(t.color) ? t.color : undefined,
      children: Array.isArray(t.children) ? t.children.map((c) => walk(c, depth + 1)) : [],
    };
  };
  return walk(tree, 0);
}

// ---------------------------------------------------------------------------------------------- layout
/** Flattens a tree into nodes/edges with ids and colours; positions are assigned by a layout function. */
export function treeToGraph(tree, { rootTone = 'sky' } = {}) {
  const nodes = [];
  const edges = [];
  const walk = (t, parent, depth, branchTone) => {
    const tone = depth === 0 ? rootTone : branchTone;
    const type = t.type || 'idea';
    const node = {
      id: newNodeId(),
      type,
      x: 0,
      y: 0,
      width: NODE_W[type],
      title: t.title,
      content: t.content || '',
      color: normalizeTone(t.color, tone),
    };
    nodes.push(node);
    if (parent) {
      edges.push({
        id: newEdgeId(),
        fromNodeId: parent.id,
        toNodeId: node.id,
        color: TONE_ACCENT[node.color] || TONE_ACCENT.sky,
        style: 'solid',
      });
    }
    t.children.forEach((c, i) => {
      // depth-1 branches each get their own colour; deeper nodes inherit it
      const childTone = depth === 0 ? TONES[(i % (TONES.length - 1)) + 1] : tone;
      walk(c, node, depth + 1, childTone);
    });
  };
  walk(tree, null, 0, rootTone);
  return { nodes, edges };
}

/**
 * Turns an arbitrary graph into a spanning forest for outlines and layout. Edges are taken in order; an edge
 * becomes a tree edge only if its target has no parent yet AND it would not close a loop. Everything else
 * (a second parent, a link back up to an ancestor, a self-link) stays a "cross-link". Without the loop check a
 * back-link made every node in the loop look like a child, so the tree disappeared (found by tests).
 */
function childrenMap(nodes, edges) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const kids = new Map(nodes.map((n) => [n.id, []]));
  const parentOf = new Map();
  const isAncestor = (candidate, startId) => {
    let cur = startId;
    for (let guard = 0; cur !== undefined && guard <= nodes.length; guard++) {
      if (cur === candidate) return true;
      cur = parentOf.get(cur);
    }
    return false;
  };
  for (const e of edges) {
    const f = e.fromNodeId;
    const t = e.toNodeId;
    if (!byId.has(f) || !byId.has(t) || f === t || parentOf.has(t)) continue;
    if (isAncestor(t, f)) continue; // would close a loop
    kids.get(f).push(t);
    parentOf.set(t, f);
  }
  return { byId, kids, roots: nodes.filter((n) => !parentOf.has(n.id)) };
}

/** Left-to-right tree: the root on the left, each level one column right, parents centred on their children. */
export function layoutTree(nodes, edges, { originX = 120, originY = 120 } = {}) {
  const { byId, kids, roots } = childrenMap(nodes, edges);
  const subtreeH = new Map();
  const measure = (id, seen = new Set()) => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const own = heightOf(byId.get(id)) + ROW_PAD;
    const cs = kids.get(id);
    const h = cs.length ? Math.max(own, cs.reduce((s, c) => s + measure(c, seen), 0)) : own;
    subtreeH.set(id, h);
    return h;
  };
  roots.forEach((r) => measure(r.id));

  const depthOf = new Map();
  const place = (id, depth, top) => {
    const n = byId.get(id);
    const cs = kids.get(id);
    depthOf.set(id, depth);
    if (!cs.length) {
      n.y = Math.round(top);
    } else {
      let y = top;
      cs.forEach((c) => {
        place(c, depth + 1, y);
        y += subtreeH.get(c) || 0;
      });
      const first = byId.get(cs[0]);
      const last = byId.get(cs[cs.length - 1]);
      n.y = Math.round((first.y + last.y) / 2);
    }
  };
  let cursorY = originY;
  for (const r of roots) {
    place(r.id, 0, cursorY);
    cursorY += (subtreeH.get(r.id) || 0) + ROW_PAD;
  }

  // Columns. The app draws an edge from the SIDE of a node only when |dx| >= |dy| between the node centres
  // (src/components/MindMap/MindMapView.tsx, computeEdgeGeometry); otherwise it leaves from the top/bottom and
  // the curves swoop across the board. So each level is placed far enough right that every edge from the
  // previous level is at least as wide as it is tall.
  const levels = [];
  for (const n of nodes) {
    const d = depthOf.get(n.id);
    if (d !== undefined) (levels[d] ||= []).push(n);
  }
  const colX = [originX];
  for (let d = 0; d + 1 < levels.length; d++) {
    let gap = COL_GAP;
    for (const p of levels[d]) {
      for (const cid of kids.get(p.id)) {
        const c = byId.get(cid);
        const dy = Math.abs(c.y + heightOf(c) / 2 - (p.y + heightOf(p) / 2));
        gap = Math.max(gap, dy + 40);
      }
    }
    colX[d + 1] = colX[d] + gap;
  }
  for (const n of nodes) if (depthOf.has(n.id)) n.x = Math.round(colX[depthOf.get(n.id)]);
  return nodes;
}

/** Radial layout: root in the middle, subtrees fan out in angular sectors proportional to their leaf count. */
export function layoutRadial(nodes, edges, { centerX = 900, centerY = 600 } = {}) {
  const { byId, kids, roots } = childrenMap(nodes, edges);
  const leaves = new Map();
  const count = (id) => {
    const cs = kids.get(id);
    const n = cs.length ? cs.reduce((s, c) => s + count(c), 0) : 1;
    leaves.set(id, n);
    return n;
  };
  roots.forEach((r) => count(r.id));
  const ring = 440;
  const place = (id, depth, a0, a1) => {
    const n = byId.get(id);
    const mid = (a0 + a1) / 2;
    const r = depth * ring;
    n.x = Math.round(centerX + Math.cos(mid) * r - widthOf(n) / 2);
    n.y = Math.round(centerY + Math.sin(mid) * r - heightOf(n) / 2);
    let a = a0;
    const total = kids.get(id).reduce((s, c) => s + leaves.get(c), 0) || 1;
    for (const c of kids.get(id)) {
      const span = ((a1 - a0) * leaves.get(c)) / total;
      place(c, depth + 1, a, a + span);
      a += span;
    }
  };
  roots.forEach((r, i) => {
    if (roots.length === 1) place(r.id, 0, -Math.PI, Math.PI);
    else place(r.id, 1, (i * 2 * Math.PI) / roots.length - Math.PI, ((i + 1) * 2 * Math.PI) / roots.length - Math.PI);
  });
  return nodes;
}

export function layout(nodes, edges, kind = 'tree') {
  return kind === 'radial' ? layoutRadial(nodes, edges) : layoutTree(nodes, edges);
}

const overlaps = (a, b) =>
  a.x < b.x + widthOf(b) + 24 && b.x < a.x + widthOf(a) + 24 && a.y < b.y + heightOf(b) + 24 && b.y < a.y + heightOf(a) + 24;

/**
 * Positions `node` next to its parent without touching the hand-arranged layout: one column to the right of
 * the parent, below the last existing child, then pushed down until it collides with nothing.
 */
export function placeNear(board, node, parentId) {
  const parent = board.nodes.find((n) => n.id === parentId);
  if (!parent) {
    // no parent: drop it below everything, aligned with the leftmost node
    const bottom = board.nodes.reduce((m, n) => Math.max(m, n.y + heightOf(n)), 0);
    node.x = board.nodes.length ? Math.min(...board.nodes.map((n) => n.x)) : 120;
    node.y = Math.round(bottom + 60);
  } else {
    const siblings = board.edges
      .filter((e) => e.fromNodeId === parent.id)
      .map((e) => board.nodes.find((n) => n.id === e.toNodeId))
      .filter(Boolean);
    node.y = siblings.length ? Math.round(Math.max(...siblings.map((s) => s.y + heightOf(s))) + ROW_PAD) : Math.round(parent.y);
  }
  // keep |dx| >= |dy| to the parent so the app draws the edge side-to-side (see layoutTree)
  const alignX = () => {
    if (parent) node.x = Math.round(parent.x + Math.max(COL_GAP, Math.abs(node.y + heightOf(node) / 2 - (parent.y + heightOf(parent) / 2)) + 40));
  };
  alignX();
  for (let guard = 0; guard < 400; guard++) {
    const hit = board.nodes.find((n) => n.id !== node.id && overlaps(node, n));
    if (!hit) break;
    node.y = Math.round(hit.y + heightOf(hit) + 30);
    alignX();
  }
  return node;
}

// ---------------------------------------------------------------------------------------------- reading
/** Renders a board as an indented outline with node ids, so a model can refer to nodes in follow-up calls. */
export function boardToOutline(board, { maxChars = 12000 } = {}) {
  const { byId, kids, roots } = childrenMap(board.nodes || [], board.edges || []);
  const out = [];
  const label = (n) =>
    `${n.title}${n.type !== 'idea' ? ` (${n.type})` : ''} [${n.id}]${n.content ? ` | ${n.content.replace(/\s+/g, ' ').slice(0, 300)}` : ''}`;
  const seen = new Set();
  const walk = (id, depth) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(`${'  '.repeat(depth)}- ${label(byId.get(id))}`);
    kids.get(id).forEach((c) => walk(c, depth + 1));
  };
  roots.forEach((r) => walk(r.id, 0));
  // extra (non-tree) connections, e.g. cross-links between branches
  const treeEdges = new Set();
  for (const [p, cs] of kids) cs.forEach((c) => treeEdges.add(`${p}>${c}`));
  const extra = (board.edges || []).filter(
    (e) => byId.has(e.fromNodeId) && byId.has(e.toNodeId) && !treeEdges.has(`${e.fromNodeId}>${e.toNodeId}`)
  );
  let text = out.join('\n');
  if (extra.length) {
    text += `\n\nCross-links:\n${extra
      .map(
        (e) =>
          `- ${byId.get(e.fromNodeId).title} [${e.fromNodeId}] -> ${byId.get(e.toNodeId).title} [${e.toNodeId}]${e.label ? ` (${e.label})` : ''} {edge ${e.id}}`
      )
      .join('\n')}`;
  }
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…[truncated; use format=json or ask for fewer nodes]` : text;
}

export function summarizeBoard(b) {
  return {
    id: b.id,
    name: b.name,
    projectId: b.projectId ?? null,
    nodes: (b.nodes || []).length,
    edges: (b.edges || []).length,
    updatedAt: b.updatedAt,
  };
}

/** Compact JSON view: drops snippet images and pen strokes. */
export function boardToJson(b) {
  return {
    ...summarizeBoard(b),
    nodes: (b.nodes || []).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      color: n.color,
      x: n.x,
      y: n.y,
      ...(n.linkedPaperTitle ? { linkedPaperTitle: n.linkedPaperTitle } : {}),
    })),
    edges: (b.edges || []).map((e) => ({ id: e.id, from: e.fromNodeId, to: e.toNodeId, ...(e.label ? { label: e.label } : {}), style: e.style || 'solid' })),
    penStrokes: (b.strokes || []).length,
  };
}

/** Builds a complete board object from a tree (what mindmap_create stores). */
export function createBoardFromTree(name, tree, { layoutKind = 'tree', projectId = null } = {}) {
  const { nodes, edges } = treeToGraph(tree);
  layout(nodes, edges, layoutKind);
  return {
    id: newBoardId(),
    name: String(name).trim().slice(0, 120) || 'Mind map',
    projectId: projectId || null,
    nodes,
    edges,
    strokes: [],
    updatedAt: new Date().toISOString(),
  };
}
