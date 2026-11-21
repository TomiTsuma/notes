// Run: node --test src/utils/stateMerge.test.ts     (Node 22.6+ strips the types; excluded from tsc, see tsconfig.app.json)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeStates, same, stableStringify, type Snapshot } from './stateMerge.ts';

const task = (id: string, title = id, status = 'todo') => ({ id, projectId: 'p1', title, description: '', status, priority: 'medium', createdAt: 't' });
const board = (id: string, nodes: Array<Record<string, unknown>>, edges: Array<Record<string, unknown>> = []) => ({ id, name: id, nodes, edges, strokes: [], updatedAt: '2026-01-01T00:00:00.000Z' });
const node = (id: string, x = 0, extra: Record<string, unknown> = {}) => ({ id, type: 'idea', x, y: 0, title: id, content: '', color: 'sky', ...extra });
const ids = (arr: unknown) => (arr as Array<{ id: string }>).map((e) => e.id);

test('stableStringify ignores key order and undefined', () => {
  assert.equal(stableStringify({ b: 1, a: [2, { d: 1, c: undefined }] }), stableStringify({ a: [2, { d: 1 }], b: 1 }));
  assert.ok(!same({ a: 1 }, { a: 2 }));
});

test('nothing changed anywhere -> unchanged; only one side changed -> that side', () => {
  const base: Snapshot = { theme: 'light', kanbanTasks: [task('a'), task('b')] };
  assert.ok(same(mergeStates(base, base, base), base));
  const remote: Snapshot = { theme: 'dark', kanbanTasks: [task('a'), task('b'), task('c')] };
  assert.ok(same(mergeStates(base, base, remote), remote), 'local untouched -> remote wins');
  const local: Snapshot = { theme: 'dark', kanbanTasks: [task('a', 'edited'), task('b')] };
  assert.ok(same(mergeStates(base, local, base), local), 'remote untouched -> local wins');
});

test('scalars: local edit beats remote, otherwise remote shows through', () => {
  const m = mergeStates({ theme: 'light', activeView: 'home' }, { theme: 'dark', activeView: 'home' }, { theme: 'light', activeView: 'kanban' });
  assert.equal(m.theme, 'dark');
  assert.equal(m.activeView, 'kanban');
  assert.equal(mergeStates({ x: 1 }, { x: 2 }, { x: 3 }).x, 2, 'both changed -> local');
});

test('MCP adds a board while the user edits a task: both survive', () => {
  const base: Snapshot = { kanbanTasks: [task('a')], mindMapBoards: [] };
  const local: Snapshot = { kanbanTasks: [task('a', 'renamed in the browser')], mindMapBoards: [] };
  const remote: Snapshot = { kanbanTasks: [task('a')], mindMapBoards: [board('from-mcp', [node('n1')])] };
  const m = mergeStates(base, local, remote);
  assert.deepEqual(ids(m.mindMapBoards), ['from-mcp']);
  assert.equal((m.kanbanTasks as Array<{ title: string }>)[0].title, 'renamed in the browser');
});

test('both sides add different items: union, server order first', () => {
  const base: Snapshot = { kanbanTasks: [task('a')] };
  const m = mergeStates(base, { kanbanTasks: [task('a'), task('local-new')] }, { kanbanTasks: [task('a'), task('remote-new')] });
  assert.deepEqual(ids(m.kanbanTasks), ['a', 'remote-new', 'local-new']);
});

test('both edit the same task: the local edit wins; other tasks follow their own side', () => {
  const base: Snapshot = { kanbanTasks: [task('a'), task('b'), task('c')] };
  const local: Snapshot = { kanbanTasks: [task('a', 'mine'), task('b'), task('c')] };
  const remote: Snapshot = { kanbanTasks: [task('a', 'theirs'), task('b', 'b moved', 'done'), task('c')] };
  const t = mergeStates(base, local, remote).kanbanTasks as Array<{ id: string; title: string; status: string }>;
  assert.equal(t.find((x) => x.id === 'a')!.title, 'mine');
  assert.equal(t.find((x) => x.id === 'b')!.status, 'done');
});

test('deletions: honoured when the other side did not touch the item, never when it edited it', () => {
  const base: Snapshot = { kanbanTasks: [task('a'), task('b'), task('c'), task('d')] };
  const local: Snapshot = { kanbanTasks: [task('b'), task('c', 'local edit'), task('d')] }; // deleted a, edited c
  const remote: Snapshot = { kanbanTasks: [task('a'), task('c'), task('d', 'remote edit')] }; // deleted b, edited d
  const t = mergeStates(base, local, remote).kanbanTasks as Array<{ id: string; title: string }>;
  assert.deepEqual(t.map((x) => x.id).sort(), ['c', 'd'], 'a and b are gone');
  assert.equal(t.find((x) => x.id === 'c')!.title, 'local edit');
  assert.equal(t.find((x) => x.id === 'd')!.title, 'remote edit');
  // local deleted, remote edited -> the edit is kept; remote deleted, local edited -> kept
  const keep = mergeStates({ kanbanTasks: [task('x'), task('y')] }, { kanbanTasks: [task('y', 'mine')] }, { kanbanTasks: [task('x', 'theirs')] }).kanbanTasks as Array<{ id: string; title: string }>;
  assert.deepEqual(keep.map((e) => `${e.id}:${e.title}`).sort(), ['x:theirs', 'y:mine']);
});

test('the same mind-map board edited on both sides: nodes and edges merge item by item', () => {
  const base = { mindMapBoards: [board('b1', [node('root', 100), node('c1', 400)], [{ id: 'e1', fromNodeId: 'root', toNodeId: 'c1' }])] };
  // the user drags c1 and links it to a new sticky; the MCP server adds a branch and renames the root
  const local = { mindMapBoards: [board('b1', [node('root', 100), node('c1', 777), node('sticky', 50, { type: 'sticky' })], [{ id: 'e1', fromNodeId: 'root', toNodeId: 'c1' }, { id: 'e2', fromNodeId: 'c1', toNodeId: 'sticky' }])] };
  const remote = { mindMapBoards: [{ ...board('b1', [node('root', 100, { title: 'Renamed by MCP' }), node('c1', 400), node('mcp-node', 400)], [{ id: 'e1', fromNodeId: 'root', toNodeId: 'c1' }, { id: 'e3', fromNodeId: 'root', toNodeId: 'mcp-node' }]), updatedAt: '2026-06-01T00:00:00.000Z' }] };
  const b = (mergeStates(base, local, remote).mindMapBoards as Array<{ nodes: Array<{ id: string; x: number; title: string }>; edges: Array<{ id: string }>; updatedAt: string }>)[0];
  assert.deepEqual(b.nodes.map((n) => n.id).sort(), ['c1', 'mcp-node', 'root', 'sticky']);
  assert.equal(b.nodes.find((n) => n.id === 'c1')!.x, 777, 'the user\'s drag is kept');
  assert.equal(b.nodes.find((n) => n.id === 'root')!.title, 'Renamed by MCP', 'the MCP rename is kept');
  assert.deepEqual(b.edges.map((e) => e.id).sort(), ['e1', 'e2', 'e3']);
  assert.equal(b.updatedAt, '2026-06-01T00:00:00.000Z');
});

test('notebook pages: typed text from one side and ink from the other both survive', () => {
  const page = 'nb-pg-1';
  const typed = (text: string) => ({ id: `${page}-lined-notes`, x: 88, y: 32, text, type: 'text' });
  const base = { annotations: { [page]: { strokes: [], textElements: [typed('old')] } } };
  const local = { annotations: { [page]: { strokes: [{ points: [[0, 0, 1]] }], textElements: [typed('old')] } } }; // handwriting
  const remote = { annotations: { [page]: { strokes: [], textElements: [typed('new text from MCP')] }, 'nb-pg-2': { strokes: [], textElements: [] } } };
  const a = mergeStates(base, local, remote).annotations as Record<string, { strokes: unknown[]; textElements: Array<{ text: string }> }>;
  assert.equal(a[page].strokes.length, 1);
  assert.equal(a[page].textElements[0].text, 'new text from MCP');
  assert.ok(a['nb-pg-2'], 'pages added remotely appear');
});

test('merging again after applying the result changes nothing (idempotent)', () => {
  const base: Snapshot = { kanbanTasks: [task('a')], mindMapBoards: [] };
  const local: Snapshot = { kanbanTasks: [task('a'), task('l')], mindMapBoards: [] };
  const remote: Snapshot = { kanbanTasks: [task('a')], mindMapBoards: [board('r', [node('n')])] };
  const once = mergeStates(base, local, remote);
  const twice = mergeStates(remote, once, remote); // after a save, base == remote
  assert.ok(same(once, twice));
});

test('values of a different shape fall back to the scalar rule instead of throwing', () => {
  assert.doesNotThrow(() => mergeStates({ projects: 'oops' }, { projects: [task('a')] }, { projects: null }));
  assert.doesNotThrow(() => mergeStates({}, { annotations: 5 }, { annotations: { x: 1 } }));
});

// ------------------------------------------------------------------------------------------ property test
function prng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

test('property: edits to DIFFERENT items on both sides always combine (300 random cases)', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rnd = prng(seed);
    const n = 3 + Math.floor(rnd() * 10);
    const baseTasks = Array.from({ length: n }, (_, i) => task(`t${i}`, `title ${i}`));
    const base: Snapshot = { kanbanTasks: baseTasks };
    let local = baseTasks.map((t) => ({ ...t }));
    let remote = baseTasks.map((t) => ({ ...t }));
    const expected = new Map<string, ReturnType<typeof task>>(baseTasks.map((t) => [t.id, { ...t }]));
    // even-numbered items belong to the user, odd-numbered ones to the "server"
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? 'local' : 'remote';
      const op = Math.floor(rnd() * 3); // 0 edit, 1 delete, 2 leave
      const apply = (arr: ReturnType<typeof task>[]) => (op === 0 ? arr.map((t) => (t.id === `t${i}` ? { ...t, title: `${side} edit ${seed}` } : t)) : op === 1 ? arr.filter((t) => t.id !== `t${i}`) : arr);
      if (side === 'local') local = apply(local);
      else remote = apply(remote);
      if (op === 0) expected.set(`t${i}`, { ...baseTasks[i], title: `${side} edit ${seed}` });
      if (op === 1) expected.delete(`t${i}`);
    }
    const addL = rnd() < 0.5 ? [task(`local-new-${seed}`)] : [];
    const addR = rnd() < 0.5 ? [task(`remote-new-${seed}`)] : [];
    local = [...local, ...addL];
    remote = [...remote, ...addR];
    [...addL, ...addR].forEach((t) => expected.set(t.id, t));

    const merged = mergeStates(base, { kanbanTasks: local }, { kanbanTasks: remote }).kanbanTasks as ReturnType<typeof task>[];
    const byId = (arr: ReturnType<typeof task>[]) => [...arr].sort((a, b) => a.id.localeCompare(b.id));
    assert.deepEqual(byId(merged), byId([...expected.values()]), `seed ${seed}`);
  }
});

test('reading list: papers added by the MCP server survive a browser save, and a status change made in the browser survives a refresh', () => {
  const paper = (id: string, status = 'to-read') => ({ id, projectId: 'p1', title: id, authors: '', status, addedAt: 't' });
  const base: Snapshot = { readingList: [paper('a')] };
  // Claude adds two papers on the server while the user marks paper `a` as read in the browser
  const remote: Snapshot = { readingList: [paper('a'), paper('b'), paper('c')] };
  const local: Snapshot = { readingList: [paper('a', 'read')] };
  const merged = mergeStates(base, local, remote).readingList as Array<{ id: string; status: string }>;
  assert.deepEqual(ids(merged), ['a', 'b', 'c'], 'the papers Claude added are kept');
  assert.equal(merged.find((p) => p.id === 'a')!.status, 'read', "the user's status change is kept");
  // the user removes a paper locally, the server meanwhile added another: both are respected
  const local2: Snapshot = { readingList: [] };
  assert.deepEqual(ids(mergeStates(base, local2, remote).readingList), ['b', 'c']);
});
