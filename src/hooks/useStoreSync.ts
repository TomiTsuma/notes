import { useEffect, useRef, useState } from 'react';
import { get } from 'idb-keyval';
import { useAppStore, getPersistedSnapshot } from '../store/appStore';
import { fetchBootstrap, saveBootstrap } from '../services/api';

const DEBOUNCE_MS = 500;
const IDB_LEGACY_KEY = 'clio-storage';

export function useStoreSync() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const syncPaused = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const { empty, state } = await fetchBootstrap();

        if (cancelled) return;

        if (!empty && state) {
          useAppStore.setState(state as unknown as Parameters<typeof useAppStore.setState>[0]);
        } else {
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
            useAppStore.setState(legacyState as unknown as Parameters<typeof useAppStore.setState>[0]);
            await saveBootstrap(getPersistedSnapshot(useAppStore.getState()));
          }
        }

        syncPaused.current = false;
        setLoading(false);
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
    const unsub = useAppStore.subscribe((state, prev) => {
      if (syncPaused.current) return;
      if (state === prev) return;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await saveBootstrap(getPersistedSnapshot(useAppStore.getState()));
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to save data');
        }
      }, DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return { loading, error };
}
