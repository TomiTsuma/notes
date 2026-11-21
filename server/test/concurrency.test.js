// The API and the MCP server are separate processes sharing one SQLite file. This proves their writes never get lost.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chlio-conc-'));
process.env.CLIO_DATA_DIR = dir;
const { saveStatePayload, loadStatePayload, getStateRevision, mutateState, saveStateIfRevision } = await import('../db.js');
const worker = path.join(path.dirname(fileURLToPath(import.meta.url)), 'helpers', 'state-worker.js');

const run = (mode, n, tag) =>
  new Promise((resolve, reject) => {
    const child = fork(worker, [mode, String(n), tag], { env: { ...process.env, CLIO_DATA_DIR: dir } });
    let msg;
    child.on('message', (m) => (msg = m));
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 && msg ? resolve(msg) : reject(new Error(`worker ${tag} exited ${code}`))));
  });

test('compare-and-swap: a stale save is refused and changes nothing', () => {
  saveStatePayload({ counter: 0 });
  const rev = getStateRevision();
  assert.deepEqual(saveStateIfRevision({ counter: 1 }, rev), { ok: true, revision: rev + 1 });
  const stale = saveStateIfRevision({ counter: 999 }, rev);
  assert.equal(stale.ok, false);
  assert.equal(stale.revision, rev + 1);
  assert.equal(loadStatePayload().counter, 1);
  // and a mutation that throws inside the IMMEDIATE transaction still rolls back
  assert.throws(() => mutateState((s) => { s.counter = 'broken'; throw new Error('boom'); }), /boom/);
  assert.equal(loadStatePayload().counter, 1);
});

test('6 separate processes (4 MCP-style writers, 2 browser-style savers) lose no update', { timeout: 120_000 }, async () => {
  saveStatePayload({ counter: 0, ids: [] });
  const seedRevision = getStateRevision();
  const PER_WORKER = 150;
  const results = await Promise.all([
    run('mutate', PER_WORKER, 'm1'), run('mutate', PER_WORKER, 'm2'), run('mutate', PER_WORKER, 'm3'), run('mutate', PER_WORKER, 'm4'),
    run('cas', PER_WORKER, 'c1'), run('cas', PER_WORKER, 'c2'),
  ]);
  const total = PER_WORKER * 6;
  const state = loadStatePayload();
  assert.equal(results.reduce((s, r) => s + r.done, 0), total, 'every worker finished all of its writes (no SQLITE_BUSY crash)');
  assert.equal(state.counter, total, 'no lost update: every increment from every process is in the final state');
  assert.equal(new Set(state.ids).size, total, 'and every one of them is distinct');
  assert.equal(getStateRevision(), seedRevision + total, 'each successful write bumped the revision exactly once');
  const conflicts = results.filter((r) => r.mode === 'cas').reduce((s, r) => s + r.conflicts, 0);
  console.log(`# ${total} writes from 6 processes, ${conflicts} browser-style conflicts detected and retried`);
});
