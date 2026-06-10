import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store/appStore';

interface ReferenceModalProps {
  x: number;
  y: number;
  onSelect: (paperTitle: string) => void;
  onClose: () => void;
}

const ReferenceModal: React.FC<ReferenceModalProps> = ({ x, y, onSelect, onClose }) => {
  const { papers, files, tags } = useAppStore();
  const [search, setSearch] = useState('');
  
  const fileResults = useMemo(() => {
    const q = search.toLowerCase();
    return files
      .filter(f => f.type === 'pdf' || f.name.endsWith('.pdf'))
      .filter(f => {
        if (!q) return true;
        const tagNames = (f.tags || []).map(tid => tags.find(t => t.id === tid)?.name || '').join(' ');
        return f.name.toLowerCase().includes(q) || tagNames.includes(q);
      })
      .map(f => ({ id: f.id, title: f.name, authors: (f.tags || []).map(tid => tags.find(t => t.id === tid)?.name).filter(Boolean).join(', ') || 'Local file' }));
  }, [files, tags, search]);

  const mockResults = papers.filter(p => 
    p.title.toLowerCase().includes(search.toLowerCase()) || 
    p.authors.toLowerCase().includes(search.toLowerCase())
  );

  const filtered = [...fileResults, ...mockResults.filter(m => !fileResults.some(f => f.title === m.title))];

  return (
    <div style={{
      position: 'absolute', left: x, top: y + 24, width: '300px',
      backgroundColor: 'white', border: '1px solid var(--border-color)',
      borderRadius: '8px', boxShadow: 'var(--shadow-lg)', zIndex: 1000,
      padding: '12px'
    }}>
      <input 
        autoFocus
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search papers by name or tag..."
        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', marginBottom: '8px' }}
      />
      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {filtered.map(paper => (
          <div 
            key={paper.id}
            onClick={() => onSelect(paper.title)}
            style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
          >
            <div style={{ fontWeight: 600, fontSize: '14px' }}>{paper.title}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{paper.authors}</div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ fontSize: '14px', padding: '8px' }}>No papers found.</div>}
      </div>
      <div style={{ textAlign: 'right', marginTop: '8px' }}>
        <button onClick={onClose} style={{ padding: '4px 8px', fontSize: '12px' }}>Cancel</button>
      </div>
    </div>
  );
};

export default ReferenceModal;
