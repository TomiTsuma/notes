// Run: node --test server/test/mindmap.test.js   (no dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseOutline,
  normalizeTree,
  treeToGraph,
  layoutTree,
  layoutRadial,
  placeNear,
  boardToOutline,
  boardToJson,
  createBoardFromTree,
  estimateHeight,
  TONES,
} from '../mcp/mindmap.js';

const W = (n) => n.width || 260;
const H = (n) => n.height || estimateHeight(n);
const overlap = (a, b) => a.x < b.x + W(b) && b.x < a.x + W(a) && a.y < b.y + H(b) && b.y < a.y + H(a);
function assertNoOverlaps(nodes, label = '') {
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++)
      assert.ok(!overlap(nodes[i], nodes[j]), `${label} "${nodes[i].title}" overlaps "${nodes[j].title}"`);
}

const OUTLINE = `
- Research question | How do discrete latents help molecule generation?
  - Methods
    - VQ-VAE | codebook of 512 entries
    - Graph transformer
  - Evidence
    - Benchmarks | QM9, ZINC
  - Risks
`;

// ------------------------------------------------------------------------------------------------ parsing
test('parseOutline builds the tree, notes and nesting', () => {
  const t = parseOutline(OUTLINE);
  assert.equal(t.title, 'Research question');
  assert.equal(t.content, 'How do discrete latents help molecule generation?');
  assert.deepEqual(t.children.map((c) => c.title), ['Methods', 'Evidence', 'Risks']);
  assert.deepEqual(t.children[0].children.map((c) => c.title), ['VQ-VAE', 'Graph transformer']);
  assert.equal(t.children[0].children[0].content, 'codebook of 512 entries');
  assert.equal(t.children[2].children.length, 0);
});

test('parseOutline accepts other bullets, tabs, numbering, and joins several roots', () => {
  const t = parseOutline('* A\n\t* A1\n\t* A2\n+ B\n1. C\n2) D');
  assert.equal(t.title, 'Mind map'); // synthetic root
  assert.deepEqual(t.children.map((c) => c.title), ['A', 'B', 'C', 'D']);
  assert.deepEqual(t.children[0].children.map((c) => c.title), ['A1', 'A2']);
  assert.equal(parseOutline('A\nB', 'Topics').title, 'Topics');
});

test('parseOutline ignores id markers produced by boardToOutline and rejects bad input', () => {
  assert.equal(parseOutline('- Idea [mm-abc123-ff00] | note').title, 'Idea');
  assert.throws(() => parseOutline('   \n\n'), /empty/);
  assert.throws(() => parseOutline(Array.from({ length: 201 }, (_, i) => `- n${i}`).join('\n')), /Too many/);
});

test('normalizeTree validates and bounds the JSON form', () => {
  const t = normalizeTree({ title: ' Root ', children: [{ title: 'A', color: 'rose', type: 'sticky' }, { title: 'B', color: 'nope', type: 'bogus' }] });
  assert.equal(t.title, 'Root');
  assert.equal(t.children[0].color, 'rose');
  assert.equal(t.children[0].type, 'sticky');
  assert.equal(t.children[1].color, undefined);
  assert.equal(t.children[1].type, undefined);
  assert.throws(() => normalizeTree({ title: 'x', children: [{ title: '' }] }), /title/);
  let deep = { title: 'leaf' };
  for (let i = 0; i < 15; i++) deep = { title: `n${i}`, children: [deep] };
  assert.throws(() => normalizeTree(deep), /deeply/);
});

// ------------------------------------------------------------------------------------------------ layout
test('tree layout: valid graph, parents left of children, no overlaps, sensible colours', () => {
  const { nodes, edges } = treeToGraph(parseOutline(OUTLINE));
  layoutTree(nodes, edges);
  assert.equal(nodes.length, 7);
  assert.equal(edges.length, 6);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const e of edges) {
    assert.ok(byId.has(e.fromNodeId) && byId.has(e.toNodeId));
    assert.ok(byId.get(e.toNodeId).x > byId.get(e.fromNodeId).x, 'child is to the right of its parent');
  }
  assertNoOverlaps(nodes, 'tree');
  assert.equal(nodes[0].color, 'sky');
  const branchColours = new Set(nodes.filter((n) => ['Methods', 'Evidence', 'Risks'].includes(n.title)).map((n) => n.color));
  assert.equal(branchColours.size, 3, 'each top-level branch gets its own colour');
  assert.ok(nodes.every((n) => TONES.includes(n.color)));
  // descendants inherit their branch colour
  const methods = nodes.find((n) => n.title === 'Methods');
  assert.equal(nodes.find((n) => n.title === 'VQ-VAE').color, methods.color);
});

/** The app attaches an edge to a node's side only when |dx| >= |dy| between centres; otherwise it swoops from top/bottom. */
function assertSideAttached(nodes, edges, label) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const e of edges) {
    const a = byId.get(e.fromNodeId);
    const b = byId.get(e.toNodeId);
    const dx = b.x + W(b) / 2 - (a.x + W(a) / 2);
    const dy = b.y + H(b) / 2 - (a.y + H(a) / 2);
    assert.ok(dx >= Math.abs(dy), `${label}: edge "${a.title}" -> "${b.title}" would attach top/bottom (dx ${Math.round(dx)} < |dy| ${Math.round(Math.abs(dy))})`);
  }
}

test('tree layout: every edge is wider than tall, so the app draws it side to side (no swooping curves)', () => {
  const { nodes, edges } = treeToGraph(parseOutline(OUTLINE));
  layoutTree(nodes, edges);
  assertSideAttached(nodes, edges, 'sample');
  const lines = ['- Root'];
  for (let i = 0; i < 4; i++) { lines.push(`  - Branch ${i}`); for (let j = 0; j < 4; j++) lines.push(`    - Leaf ${i}.${j} | ${'note '.repeat(j * 6)}`); }
  const big = treeToGraph(parseOutline(lines.join('\n')));
  layoutTree(big.nodes, big.edges);
  assertSideAttached(big.nodes, big.edges, 'wide fan-out');
  assertNoOverlaps(big.nodes, 'wide fan-out');
  const wide = treeToGraph(parseOutline(['- R', ...Array.from({ length: 14 }, (_, i) => `  - child ${i}`)].join('\n')));
  layoutTree(wide.nodes, wide.edges);
  assertSideAttached(wide.nodes, wide.edges, '14 children');
});

test('tree layout: a parent is vertically centred on its children', () => {
  const { nodes, edges } = treeToGraph(parseOutline('- R\n  - A\n  - B\n  - C'));
  layoutTree(nodes, edges);
  const [r, a, , c] = nodes;
  assert.equal(r.y, Math.round((a.y + c.y) / 2));
});

test('tree layout scales: 120 nodes, still no overlaps', () => {
  const lines = ['- Root'];
  for (let i = 0; i < 10; i++) {
    lines.push(`  - Branch ${i} | ${'x'.repeat(i * 12)}`);
    for (let j = 0; j < 11; j++) lines.push(`    - Leaf ${i}.${j}`);
  }
  const { nodes, edges } = treeToGraph(parseOutline(lines.join('\n')));
  layoutTree(nodes, edges);
  assert.equal(nodes.length, 121);
  assertNoOverlaps(nodes, 'big tree');
});

test('radial layout: root centred, no overlaps on a moderate tree', () => {
  const lines = ['- Hub'];
  for (let i = 0; i < 6; i++) {
    lines.push(`  - Spoke ${i}`);
    lines.push(`    - a${i}`);
    lines.push(`    - b${i}`);
  }
  const { nodes, edges } = treeToGraph(parseOutline(lines.join('\n')));
  layoutRadial(nodes, edges);
  assertNoOverlaps(nodes, 'radial');
  const hub = nodes[0];
  assert.ok(Math.abs(hub.x + 130 - 900) < 2, 'hub is at the centre column');
});

// ------------------------------------------------------------------------------------------------ editing an existing board
test('placeNear puts a new child right of its parent, below siblings, never on top of anything', () => {
  const board = createBoardFromTree('B', parseOutline(OUTLINE));
  const methods = board.nodes.find((n) => n.title === 'Methods');
  for (let i = 0; i < 6; i++) {
    const node = { id: `new-${i}`, type: 'idea', title: `extra ${i}`, content: 'y'.repeat(80), width: 260 };
    placeNear(board, node, methods.id);
    assert.ok(node.x > methods.x);
    board.nodes.push(node);
    board.edges.push({ id: `e${i}`, fromNodeId: methods.id, toNodeId: node.id });
  }
  assertNoOverlaps(board.nodes, 'after placeNear');
  const byId = new Map(board.nodes.map((n) => [n.id, n]));
  for (const e of board.edges.filter((x) => x.id.startsWith('e'))) {
    const a = byId.get(e.fromNodeId); const b = byId.get(e.toNodeId);
    assert.ok(b.x + W(b) / 2 - (a.x + W(a) / 2) >= Math.abs(b.y + H(b) / 2 - (a.y + H(a) / 2)), 'added nodes also attach side to side');
  }
});

test('placeNear with no parent drops the node below everything', () => {
  const board = createBoardFromTree('B', parseOutline(OUTLINE));
  const bottom = Math.max(...board.nodes.map((n) => n.y + H(n)));
  const node = { id: 'orphan', type: 'sticky', title: 'loose', content: '', width: 220 };
  placeNear(board, node, null);
  assert.ok(node.y >= bottom);
});

// ------------------------------------------------------------------------------------------------ reading back
test('boardToOutline round-trips through parseOutline (structure and notes survive)', () => {
  const board = createBoardFromTree('Round trip', parseOutline(OUTLINE));
  const text = boardToOutline(board);
  assert.match(text, /\[mm-[\w-]+\]/, 'node ids are shown so follow-up calls can reference them');
  const again = parseOutline(text);
  const shape = (t) => ({ title: t.title, content: t.content, children: t.children.map(shape) });
  assert.deepEqual(shape(again), shape(parseOutline(OUTLINE)));
});

test('boardToOutline lists cross-links and orphans; boardToJson is compact', () => {
  const board = createBoardFromTree('B', parseOutline('- R\n  - A\n  - B'));
  const [, a, b] = board.nodes;
  board.edges.push({ id: 'x1', fromNodeId: a.id, toNodeId: b.id, label: 'contradicts' });
  board.nodes.push({ id: 'mm-loose', type: 'sticky', title: 'Loose note', content: 'remember', x: 0, y: 0, color: 'amber', snippetDataUrl: 'data:image/png;base64,AAAA' });
  const text = boardToOutline(board);
  assert.match(text, /Cross-links:/);
  assert.match(text, /contradicts/);
  assert.match(text, /Loose note/);
  const json = boardToJson(board);
  assert.ok(!JSON.stringify(json).includes('base64'), 'snippet images are not sent to the model');
  assert.equal(json.nodes.length, 4);
});

test('cycles, second parents and self-links never hide nodes: they become cross-links', () => {
  const board = createBoardFromTree('Loops', parseOutline(['- A', '  - B', '    - C', '  - D'].join('\n')));
  const [a, b, c, d] = board.nodes;
  board.edges.push({ id: 'back', fromNodeId: c.id, toNodeId: a.id, label: 'feeds back' }); // loop to an ancestor
  board.edges.push({ id: 'dia', fromNodeId: d.id, toNodeId: c.id }); // c gets a second parent
  board.edges.push({ id: 'self', fromNodeId: b.id, toNodeId: b.id }); // self-link
  const text = boardToOutline(board);
  for (const n of [a, b, c, d]) assert.ok(text.includes(`[${n.id}]`), `${n.title} is still in the outline`);
  assert.match(text, /Cross-links:[\s\S]*feeds back/);
  layoutTree(board.nodes, board.edges);
  assertNoOverlaps(board.nodes, 'loops');
  // the original tree is unchanged: A is the only root, C is still under B
  const shape = parseOutline(text.split('\n\nCross-links:')[0]);
  assert.equal(shape.title, 'A');
  assert.equal(shape.children[0].children[0].title, 'C');
});

test('a fully cyclic graph (no natural root) still lays out and prints every node', () => {
  const nodes = ['x', 'y', 'z'].map((t, i) => ({ id: `n${i}`, type: 'idea', title: t, content: '', x: 0, y: 0, width: 260 }));
  const edges = [['n0', 'n1'], ['n1', 'n2'], ['n2', 'n0']].map(([f, t], i) => ({ id: `e${i}`, fromNodeId: f, toNodeId: t }));
  layoutRadial(nodes, edges);
  layoutTree(nodes, edges);
  assertNoOverlaps(nodes, 'cycle');
  const text = boardToOutline({ nodes, edges });
  for (const n of nodes) assert.ok(text.includes(`[${n.id}]`));
});

test('createBoardFromTree produces a board the app can load', () => {
  const b = createBoardFromTree('  My map  ', parseOutline(OUTLINE), { projectId: 'proj-1', layoutKind: 'radial' });
  assert.equal(b.name, 'My map');
  assert.equal(b.projectId, 'proj-1');
  assert.deepEqual(b.strokes, []);
  assert.ok(b.id.startsWith('board-') && !Number.isNaN(Date.parse(b.updatedAt)));
  assert.ok(b.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y) && n.id.startsWith('mm-')));
  assert.equal(new Set(b.nodes.map((n) => n.id)).size, b.nodes.length, 'unique ids');
});
