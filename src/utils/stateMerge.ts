/**
 * Three-way merge of the synced app state.
 *
 *   base   = what the server had when we last synced
 *   local  = what is in the browser now (the user's unsaved edits on top of base)
 *   remote = what the server has now (someone else, e.g. the MCP server, changed it)
 *
 * Why: the browser saves its WHOLE state. Without a merge, a save made from an old copy would erase whatever
 * the MCP server added meanwhile (or, the other way round, a refresh would erase unsaved edits).
 *
 * Rules, per item (matched by `id`):
 *  - only one side changed it            -> take that side (incl. deletions)
 *  - both changed it                     -> merge field by field where that is safe (mind-map nodes/edges,
 *                                           notebook text elements), otherwise the local edit wins
 *  - one side deleted, the other edited  -> keep the edit (never lose data silently)
 * Scalars (theme, activeView, ...): local if the user changed it, otherwise remote.
 *
 * Pure and dependency-free so it can be unit tested (stateMerge.test.ts).
 */
export type Snapshot = Record<string, unknown>;
type Entity = Record<string, unknown> & { id: string };

/** Arrays of {id,...} objects, merged item by item. */
const ENTITY_ARRAYS = new Set(['folders', 'files', 'papers', 'readingList', 'tags', 'projects', 'kanbanTasks', 'calendarEvents', 'mindMapBoards']);
/** Objects keyed by id (document/page id, project id) whose values are merged key by key. */
const KEYED_MAPS = new Set(['annotations', 'chatHistory']);

export function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export const same = (a: unknown, b: unknown): boolean => a === b || stableStringify(a) === stableStringify(b);

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isEntityArray = (v: unknown): v is Entity[] =>
  Array.isArray(v) && v.every((x) => isRecord(x) && typeof (x as Record<string, unknown>).id === 'string');

/** local if the user changed it since base, otherwise remote */
const scalar = (b: unknown, l: unknown, r: unknown): unknown => (same(b, l) ? r : l);

/** The three-way decision for one item; `both` resolves the case where both sides edited it. */
function pick<T>(be: T | undefined, le: T | undefined, re: T | undefined, both: (b: T | undefined, l: T, r: T) => T): T | undefined {
  if (le === undefined && re === undefined) return undefined;
  if (same(be, le)) return re; // local did not touch it
  if (same(be, re)) return le; // remote did not touch it
  if (le === undefined) return re; // local deleted, remote edited: keep the edit
  if (re === undefined) return le; // remote deleted, local edited: keep the edit
  return both(be, le, re);
}

const localWins = <T>(_b: T | undefined, l: T): T => l;

function mergeById(
  base: Entity[] | undefined,
  local: Entity[] | undefined,
  remote: Entity[] | undefined,
  both: (b: Entity | undefined, l: Entity, r: Entity) => Entity = localWins
): Entity[] {
  const index = (a?: Entity[]) => new Map((a ?? []).map((e) => [e.id, e]));
  const b = index(base);
  const l = index(local);
  const r = index(remote);
  // server order first (it is the shared truth), then items that only exist locally
  const order = [...(remote ?? []).map((e) => e.id), ...(local ?? []).map((e) => e.id).filter((id) => !r.has(id))];
  const out: Entity[] = [];
  for (const id of order) {
    const chosen = pick(b.get(id), l.get(id), r.get(id), both);
    if (chosen !== undefined) out.push(chosen);
  }
  return out;
}

function mergeRecordFields(
  b: Record<string, unknown> | undefined,
  l: Record<string, unknown>,
  r: Record<string, unknown>,
  special: Record<string, (b: unknown, l: unknown, r: unknown) => unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(b ?? {}), ...Object.keys(l), ...Object.keys(r)])) {
    const fn = special[key];
    const v = fn ? fn(b?.[key], l[key], r[key]) : scalar(b?.[key], l[key], r[key]);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

const asEntities = (v: unknown): Entity[] | undefined => (isEntityArray(v) ? v : undefined);

/** A mind-map board edited on both sides: merge nodes and edges item by item. */
function mergeBoard(b: Entity | undefined, l: Entity, r: Entity): Entity {
  const merged = mergeRecordFields(b, l, r, {
    nodes: (bb, ll, rr) => mergeById(asEntities(bb), asEntities(ll), asEntities(rr)),
    edges: (bb, ll, rr) => mergeById(asEntities(bb), asEntities(ll), asEntities(rr)),
    updatedAt: (_bb, ll, rr) => [ll, rr].filter((x): x is string => typeof x === 'string').sort().pop(),
  });
  return { ...merged, id: l.id };
}

/** Per-page/document annotations edited on both sides: text elements (typed notes) merge by id. */
function mergeAnnotation(b: unknown, l: unknown, r: unknown): unknown {
  if (!isRecord(l) || !isRecord(r)) return l;
  return mergeRecordFields(isRecord(b) ? b : undefined, l, r, {
    textElements: (bb, ll, rr) => mergeById(asEntities(bb), asEntities(ll), asEntities(rr)),
  });
}

function mergeKeyedMap(b: unknown, l: unknown, r: unknown, both: (b: unknown, l: unknown, r: unknown) => unknown): Record<string, unknown> {
  const bm = isRecord(b) ? b : {};
  const lm = isRecord(l) ? l : {};
  const rm = isRecord(r) ? r : {};
  const out: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(rm), ...Object.keys(lm)])) {
    const chosen = pick<unknown>(bm[key], lm[key], rm[key], both);
    if (chosen !== undefined) out[key] = chosen;
  }
  return out;
}

export function mergeStates(base: Snapshot, local: Snapshot, remote: Snapshot): Snapshot {
  const out: Snapshot = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
    const b = base[key];
    const l = local[key];
    const r = remote[key];
    const arrays = [b, l, r].filter((v) => v !== undefined);
    if (ENTITY_ARRAYS.has(key) && arrays.every(isEntityArray)) {
      out[key] = mergeById(asEntities(b), asEntities(l), asEntities(r), key === 'mindMapBoards' ? mergeBoard : localWins);
    } else if (KEYED_MAPS.has(key) && [b, l, r].every((v) => v === undefined || isRecord(v))) {
      out[key] = mergeKeyedMap(b, l, r, key === 'annotations' ? mergeAnnotation : localWins);
    } else {
      out[key] = scalar(b, l, r);
    }
  }
  return out;
}
