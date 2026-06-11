import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../../store/appStore';

const CanvasTagBar: React.FC = () => {
  const { activeDocumentId, files, tags, addTag, setFileTags } = useAppStore();
  const [creating, setCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const file = activeDocumentId ? files.find(f => f.id === activeDocumentId) : null;
  const assignedIds = file?.tags || [];
  const assignedTags = tags.filter(t => assignedIds.includes(t.id));
  const unassignedTags = tags.filter(t => !assignedIds.includes(t.id));

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  if (!file) return null;

  const normalizeTagName = (name: string) =>
    name.trim().toLowerCase().replace(/\s+/g, '_');

  const handleCreate = () => {
    const normalized = normalizeTagName(newTagName);
    if (!normalized) {
      setCreating(false);
      return;
    }
    const existing = tags.find(t => t.name === normalized);
    if (existing) {
      if (!assignedIds.includes(existing.id)) {
        setFileTags(file.id, [...assignedIds, existing.id]);
      }
    } else {
      const id = `tag-${uuidv4().substring(0, 8)}`;
      addTag({ id, name: normalized, createdAt: new Date().toISOString() });
      setFileTags(file.id, [...assignedIds, id]);
    }
    setNewTagName('');
    setCreating(false);
  };

  const toggleTag = (tagId: string) => {
    const selected = assignedIds.includes(tagId);
    const next = selected
      ? assignedIds.filter(id => id !== tagId)
      : [...assignedIds, tagId];
    setFileTags(file.id, next);
  };

  const chipStyle = (selected: boolean): React.CSSProperties => ({
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'Nunito',
    background: selected ? 'var(--accent-light)' : 'var(--bg-surface)',
    color: selected ? 'var(--accent-color)' : 'var(--text-secondary)',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', maxWidth: 420 }}>
      {assignedTags.map(t => (
        <button key={t.id} onClick={() => toggleTag(t.id)} style={chipStyle(true)} title="Remove tag">
          #{t.name}
        </button>
      ))}
      {unassignedTags.slice(0, 4).map(t => (
        <button key={t.id} onClick={() => toggleTag(t.id)} style={chipStyle(false)} title="Add tag">
          +{t.name}
        </button>
      ))}
      {creating ? (
        <input
          ref={inputRef}
          value={newTagName}
          onChange={e => setNewTagName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleCreate();
            if (e.key === 'Escape') { setCreating(false); setNewTagName(''); }
          }}
          onBlur={handleCreate}
          placeholder="tag_name"
          style={{
            width: 100, fontSize: 11, padding: '3px 6px', borderRadius: 6,
            border: '1px solid var(--border-color)', fontFamily: 'Nunito',
            background: 'var(--bg-surface)', color: 'var(--text-primary)',
          }}
        />
      ) : (
        <button
          onClick={() => setCreating(true)}
          style={{
            ...chipStyle(false),
            border: '1px dashed var(--border-color)',
          }}
          title="Create and assign tag"
        >
          + Tag
        </button>
      )}
    </div>
  );
};

export default CanvasTagBar;
