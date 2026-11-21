// The revision / If-Match contract that keeps the browser and the MCP server from overwriting each other.
// Uses the REAL bootstrap.js + db.js against a throwaway data dir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.CLIO_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chlio-state-'));
const { getBootstrap, putBootstrap } = await import('../bootstrap.js');
const { mutateState, getStateRevision, loadStatePayload, getFileBlob } = await import('../db.js');

test('a fresh database starts at revision 0 and is empty', () => {
  const b = getBootstrap();
  assert.equal(b.empty, true);
  assert.equal(b.revision, 0);
});

test('a save with the current revision succeeds and returns the next one', () => {
  const r = putBootstrap({ projects: [{ id: 'p1', name: 'A' }], activeView: 'home' }, 0);
  assert.deepEqual(r, { ok: true, revision: 1 });
  const b = getBootstrap();
  assert.equal(b.revision, 1);
  assert.equal(b.state.projects[0].id, 'p1');
});

test('a save without a number, or with a stale one, is a conflict that returns the current state', () => {
  for (const bad of [undefined, null, NaN, 0, 99]) {
    const r = putBootstrap({ projects: [] }, bad);
    assert.equal(r.conflict, true, `ifMatch=${bad}`);
    assert.equal(r.revision, 1);
    assert.equal(r.state.projects[0].id, 'p1', 'the stored state is untouched and returned for merging');
  }
  assert.equal(getStateRevision(), 1);
});

test('unknown keys are not persisted', () => {
  putBootstrap({ projects: [{ id: 'p1' }], evil: 'x', __proto__: { polluted: true } }, 1);
  assert.equal(loadStatePayload().evil, undefined);
  assert.equal({}.polluted, undefined);
});

test('MCP-style writes bump the revision, so a browser holding the old one gets a conflict, then can retry', () => {
  const seen = getStateRevision();
  const { revision } = mutateState((st) => { (st.mindMapBoards ||= []).push({ id: 'from-mcp', nodes: [], edges: [] }); });
  assert.equal(revision, seen + 1);
  const stale = putBootstrap({ projects: [{ id: 'p1' }, { id: 'local-edit' }] }, seen);
  assert.equal(stale.conflict, true);
  assert.equal(stale.state.mindMapBoards[0].id, 'from-mcp', 'the MCP board is not lost');
  const retry = putBootstrap({ projects: [{ id: 'p1' }, { id: 'local-edit' }], mindMapBoards: stale.state.mindMapBoards }, stale.revision);
  assert.equal(retry.ok, true);
  assert.equal(loadStatePayload().mindMapBoards[0].id, 'from-mcp');
});

test('a mutation that throws is rolled back completely', () => {
  const rev = getStateRevision();
  const before = JSON.stringify(loadStatePayload());
  assert.throws(() => mutateState((st) => { st.projects.push({ id: 'half-written' }); throw new Error('boom'); }), /boom/);
  assert.equal(getStateRevision(), rev);
  assert.equal(JSON.stringify(loadStatePayload()), before);
});

test('a conflicting save does not delete uploaded files; a successful one does', () => {
  const pdf = 'data:application/pdf;base64,JVBERi0xLjQK';
  let rev = getStateRevision();
  rev = putBootstrap({ files: [{ id: 'f1', name: 'a.pdf', type: 'application/pdf', dataUrl: pdf }] }, rev).revision;
  assert.ok(getFileBlob('f1'), 'blob written');
  const stale = putBootstrap({ files: [] }, rev - 1);
  assert.equal(stale.conflict, true);
  assert.ok(getFileBlob('f1'), 'a refused save must not delete anyone\'s files');
  assert.equal(putBootstrap({ files: [] }, rev).ok, true);
  assert.equal(getFileBlob('f1'), undefined, 'removed once the delete is actually saved');
});
