// Child process used by concurrency.test.js. Each worker opens the SAME database file (via db.js) and hammers it.
//   node state-worker.js mutate <n>   MCP-style: mutateState(counter += 1)
//   node state-worker.js cas <n>      browser-style: read revision + state, save with saveStateIfRevision, retry on conflict
import { mutateState, getStateRevision, loadStatePayload, saveStateIfRevision } from '../../db.js';

const [mode, nArg, tag] = process.argv.slice(2);
const n = Number(nArg);
let done = 0;
let conflicts = 0;

if (mode === 'mutate') {
  for (let i = 0; i < n; i++) {
    mutateState((s) => {
      s.counter = (s.counter || 0) + 1;
      (s.ids ||= []).push(`${tag}-${i}`);
    });
    done++;
  }
} else if (mode === 'cas') {
  while (done < n) {
    const rev = getStateRevision();
    const s = loadStatePayload() || {};
    s.counter = (s.counter || 0) + 1;
    (s.ids ||= []).push(`${tag}-${done}`);
    const r = saveStateIfRevision(s, rev);
    if (r.ok) done++;
    else conflicts++; // someone saved between our read and our write: re-read and try again, never overwrite
  }
}
process.send?.({ mode, tag, done, conflicts });
