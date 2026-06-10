import React, { useState, useEffect } from 'react';
import { listDirectories, normalizeRemotePath, getParentRemotePath } from '../../services/nextcloud';

interface Props {
  title: string;
  currentPath: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}

const NextcloudFolderPicker: React.FC<Props> = ({ title, currentPath, onSelect, onClose }) => {
  const [path, setPath] = useState(() => normalizeRemotePath(currentPath || '/'));
  const [dirs, setDirs] = useState<{ name: string; path: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPath(normalizeRemotePath(currentPath || '/'));
  }, [currentPath]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await listDirectories(path);
        setDirs(items);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to list folders');
        setDirs([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [path]);

  const parentPath = getParentRemotePath(path);

  return (
    <div className="event-modal-overlay" onClick={onClose}>
      <div className="event-modal-form glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <h3 style={{ fontSize: 18, fontWeight: 900 }}>{title}</h3>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Current: {path}</p>

        {loading && <p style={{ fontSize: 12 }}>Loading folders...</p>}
        {error && <p style={{ fontSize: 12, color: '#ff2d55' }}>{error}</p>}

        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: 8 }}>
          {path !== '/' && (
            <button onClick={() => setPath(parentPath)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 700, color: 'var(--text-primary)' }}>
              📁 ..
            </button>
          )}
          {dirs.map(d => (
            <button key={d.path} onClick={() => setPath(d.path)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)' }}>
              📁 {d.name}
            </button>
          ))}
          {!loading && dirs.length === 0 && !error && (
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', padding: 8 }}>No subfolders</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: 'var(--bg-inset)', cursor: 'pointer', fontWeight: 700, color: 'var(--text-primary)' }}>Cancel</button>
          <button onClick={() => { onSelect(normalizeRemotePath(path)); onClose(); }} style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#0a7aff', color: 'white', fontWeight: 800, cursor: 'pointer' }}>
            Use this folder
          </button>
        </div>
      </div>
    </div>
  );
};

export default NextcloudFolderPicker;
