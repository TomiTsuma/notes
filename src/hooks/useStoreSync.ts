import { useEffect, useRef, useState } from 'react';
import { get } from 'idb-keyval';
import { useAppStore, getPersistedSnapshot } from '../store/appStore';
import { fetchBootstrap, saveBootstrap, fetchRevision, fileContentUrl, ConflictError } from '../services/api';
import { fetchGoogleStatus, fetchGoogleCalendarEvents } from '../services/calendarSyncService';
import { mergeStates, stableStringify, same, type Snapshot } from '../utils/stateMerge';

// Each save serialises the whole store, which is dominated by stroke data. A short
// window meant a multi-megabyte stringify on the main thread between pen strokes.
const DEBOUNCE_MS = 2000;
// How often to ask the server "did anyone else change the data?" (a few bytes) while the tab is visible.
const POLL_MS = 8000;
const MAX_CONFLICT_RETRIES = 5;
const IDB_LEGACY_KEY = 'clio-storage';

type Setter = Parameters<typeof useAppStore.setState>[0];

/** The same projection the app saves: uploaded files are referenced by URL, never re-sent as data. */
const snapshotNow = (): Snapshot => getPersistedSnapshot(useAppStore.getState());

/** Bring a state fetched from the server into the exact shape of snapshotNow() so the two can be compared/merged. */
function normalizeRemote(state: Record<string, unknown>): Snapshot {
  const keys = Object.keys(snapshotNow());
  const out: Snapshot = {};
  for (const k of keys) if (state[k] !== undefined) out[k] = state[k];
  if (Array.isArray(out.files)) {
    out.files = (out.files as Array<Record<string, unknown>>).map((f) => {
      if (f.serverStored && typeof f.dataUrl === 'string' && f.dataUrl.startsWith('/api/files/')) {
        const rest = { ...f };
        delete rest.dataUrl;
        return rest;
      }
      return f;
    });
  }
  return out;
}

/** Put a merged snapshot into the store, touching only the keys that actually differ. */
function applyToStore(snapshot: Snapshot) {
  const current = snapshotNow();
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (same(value, current[key])) continue;
    patch[key] =
      key === 'files' && Array.isArray(value)
        ? // the store keeps a URL for files that live on the server (the snapshot omits it)
          (value as Array<Record<string, unknown>>).map((f) => (f.serverStored && !f.dataUrl ? { ...f, dataUrl: fileContentUrl(String(f.id)) } : f))
        : value;
  }
  if (Object.keys(patch).length) useAppStore.setState(patch as unknown as Setter);
}

export function useStoreSync() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const syncPaused = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // What the server holds, as of `revisionRef`. The base of every three-way merge.
  const revisionRef = useRef(0);
  const baseRef = useRef<Snapshot>({});
  const baseJsonRef = useRef('');
  const savingRef = useRef(false);
  const saveAgainRef = useRef(false);

  const markSynced = (snapshot: Snapshot, revision: number) => {
    baseRef.current = snapshot;
    baseJsonRef.current = stableStringify(snapshot);
    revisionRef.current = revision;
  };

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const { empty, state, revision } = await fetchBootstrap();

        if (cancelled) return;

        if (!empty && state) {
          const loadedState = state as Record<string, unknown>;
          if (loadedState.palmRejection === undefined) {
            loadedState.palmRejection = true;
          }
          if (loadedState.nextcloudPapersPath === '/Papers') {
            loadedState.nextcloudPapersPath = '/';
          }
          if (Array.isArray(loadedState.projects) && Array.isArray(loadedState.kanbanTasks)) {
            const jiraProjMap = new Map(
              (loadedState.projects as any[])
                .filter((p: any) => p?.jiraKey)
                .map((p: any) => [p.jiraKey.toUpperCase(), p.id])
            );
            loadedState.kanbanTasks = (loadedState.kanbanTasks as any[]).map((t: any) => {
              const rawKey = (t.projectId || (t.jiraKey ? t.jiraKey.split('-')[0] : ''))?.toUpperCase();
              const matchedProjId = (rawKey && jiraProjMap.get(rawKey)) || t.projectId;
              return matchedProjId !== t.projectId ? { ...t, projectId: matchedProjId } : t;
            });
          }
          useAppStore.setState(loadedState as unknown as Setter);
          // base = what the server actually holds (before the client-side migrations above), so those
          // migrations count as local edits and get saved on the next change.
          markSynced(normalizeRemote(state as Record<string, unknown>), revision);
        } else {
          markSynced({}, revision);
          const legacyRaw = await get(IDB_LEGACY_KEY);
          let legacyState: Record<string, unknown> | null = null;
          if (typeof legacyRaw === 'string') {
            try {
              const parsed = JSON.parse(legacyRaw);
              legacyState = parsed.state ?? null;
            } catch { /* ignore */ }
          } else if (legacyRaw && typeof legacyRaw === 'object' && 'state' in legacyRaw) {
            legacyState = (legacyRaw as { state: Record<string, unknown> }).state;
          }
          if (legacyState) {
            if (legacyState.nextcloudPapersPath === '/Papers') {
              legacyState.nextcloudPapersPath = '/';
            }
            if (Array.isArray(legacyState.projects) && Array.isArray(legacyState.kanbanTasks)) {
              const jiraProjMap = new Map(
                (legacyState.projects as any[])
                  .filter((p: any) => p?.jiraKey)
                  .map((p: any) => [p.jiraKey.toUpperCase(), p.id])
              );
              legacyState.kanbanTasks = (legacyState.kanbanTasks as any[]).map((t: any) => {
                const rawKey = (t.projectId || (t.jiraKey ? t.jiraKey.split('-')[0] : ''))?.toUpperCase();
                const matchedProjId = (rawKey && jiraProjMap.get(rawKey)) || t.projectId;
                return matchedProjId !== t.projectId ? { ...t, projectId: matchedProjId } : t;
              });
            }
            useAppStore.setState(legacyState as unknown as Setter);
            const snap = snapshotNow();
            const newRevision = await saveBootstrap(snap, revisionRef.current);
            markSynced(snap, newRevision);
          }
        }

        syncPaused.current = false;
        setLoading(false);

        // Auto-sync Google Calendar events after bootstrap hydration so they are never overwritten
        fetchGoogleStatus()
          .then((status) => {
            if (status.connected && !cancelled) {
              return fetchGoogleCalendarEvents().then((events) => {
                if (!cancelled) {
                  useAppStore.getState().mergeExternalEvents(events, 'google');
                }
              });
            }
          })
          .catch(() => {});
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
          syncPaused.current = false;
          setLoading(false);
        }
      }
    }

    hydrate();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    /** Saves the store. If the server changed meanwhile, merge its version in and try again. */
    async function flush() {
      if (savingRef.current) {
        saveAgainRef.current = true;
        return;
      }
      savingRef.current = true;
      try {
        for (let attempt = 0; attempt <= MAX_CONFLICT_RETRIES; attempt++) {
          const snap = snapshotNow();
          const json = stableStringify(snap);
          if (json === baseJsonRef.current) {
            setError(null);
            return; // nothing differs from what the server has (e.g. we just applied its changes)
          }
          try {
            const revision = await saveBootstrap(snap, revisionRef.current);
            markSynced(snap, revision);
            setError(null);
            return;
          } catch (err) {
            if (!(err instanceof ConflictError)) throw err;
            // Someone else (e.g. the MCP server) saved first. Merge using the CURRENT local state: the user may
            // have kept editing during the request, and those edits must not be overwritten.
            const remote = normalizeRemote(err.state ?? {});
            const merged = mergeStates(baseRef.current, snapshotNow(), remote);
            markSynced(remote, err.revision);
            applyToStore(merged);
          }
        }
        throw new Error('Could not save: the data keeps changing elsewhere. Reload the page.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save data');
      } finally {
        savingRef.current = false;
        if (saveAgainRef.current) {
          saveAgainRef.current = false;
          schedule();
        }
      }
    }

    function schedule() {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        void flush();
      }, DEBOUNCE_MS);
    }

    /** Has anyone else changed the data? If so pull it in, keeping the user's unsaved edits. */
    async function checkForRemoteChanges() {
      if (syncPaused.current || savingRef.current || document.hidden) return;
      try {
        if ((await fetchRevision()) === revisionRef.current) return;
        const { state, revision } = await fetchBootstrap();
        // a save may have started while we were fetching; its own conflict handling will cover it
        if (!state || savingRef.current || revision === revisionRef.current) return;
        const remote = normalizeRemote(state as Record<string, unknown>);
        const merged = mergeStates(baseRef.current, snapshotNow(), remote);
        markSynced(remote, revision);
        applyToStore(merged); // if the user had unsaved edits this schedules a save of the merged result
      } catch {
        // offline or signed out: the next poll tries again (a 401 raises the sign-in screen elsewhere)
      }
    }

    const unsub = useAppStore.subscribe((state, prev) => {
      if (syncPaused.current) return;
      if (state === prev) return;
      schedule();
    });

    const interval = setInterval(() => void checkForRemoteChanges(), POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void checkForRemoteChanges();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);

    return () => {
      unsub();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return { loading, error };
}
