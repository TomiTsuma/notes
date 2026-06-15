import React from 'react';
import { useAppStore } from '../../store/appStore';
import { PenIcon, HighlighterIcon, TextIcon, EraserIcon } from '../UI/Icons';

export const RulerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="8" width="20" height="8" rx="2"/><path d="M6 8v3M10 8v3M14 8v3M18 8v3"/></svg>
);

export const StickyIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/><path d="M14 2v6h6"/><path d="M9 15h6"/></svg>
);

export const LassoIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
  </svg>
);

export const UndoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
);

export const ClearAllIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
);

const FloatingToolbar: React.FC = () => {
  const { activeTool, setActiveTool, brushColor, setBrushColor, undo, clearAnnotations, activeDocumentId } = useAppStore();
  
  const colors = ['#1c1c1e', '#e24361', '#34c759', '#007aff', '#ff9500'];

  const tools = [
    { id: 'select', icon: <LassoIcon /> },
    { id: 'text', icon: <TextIcon /> },
    { id: 'sticky', icon: <StickyIcon /> },
    { id: 'pen', icon: <PenIcon /> },
    { id: 'highlighter', icon: <HighlighterIcon /> },
    { id: 'ruler', icon: <RulerIcon /> },
    { id: 'eraser', icon: <EraserIcon /> },
  ] as const;

  return (
    <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#ffffff', borderRadius: '24px', display: 'flex', alignItems: 'center', padding: '8px 12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', border: '1px solid var(--border-color)', gap: '16px', zIndex: 100 }}>
       
       <button onClick={undo} style={{ padding: '8px', borderRadius: '12px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#1c1c1e' }} title="Undo Stroke">
          <UndoIcon />
       </button>

       <button onClick={() => { if (activeDocumentId && window.confirm('Clear all annotations from this document?')) clearAnnotations(activeDocumentId); }} style={{ padding: '8px', borderRadius: '12px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ff3b30' }} title="Clear All Annotations">
          <ClearAllIcon />
       </button>
       
       <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
       
       <div style={{ display: 'flex', gap: '8px' }}>
        {tools.map(tool => (
          <button key={tool.id} onClick={() => setActiveTool(tool.id as any)}
            style={{ padding: '8px', borderRadius: '12px', border: 'none', background: activeTool === tool.id ? '#f0f0f5' : 'transparent', cursor: 'pointer', color: activeTool === tool.id ? 'var(--accent-color)' : '#1c1c1e' }}
          >
            {tool.icon}
          </button>
        ))}
       </div>

      <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />

      <div style={{ display: 'flex', gap: '6px' }}>
        {colors.map(color => (
          <button key={color} onClick={() => setBrushColor(color)}
            style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: color, border: brushColor === color ? '2px solid white' : 'none', outline: brushColor === color ? `2px solid ${color}` : 'none', cursor: 'pointer', margin: '0 4px' }}
          />
        ))}
      </div>
    </div>
  );
};
export default FloatingToolbar;
