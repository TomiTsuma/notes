import React from 'react';
import { useAppStore } from '../../store/appStore';
import { PenIcon, HighlighterIcon, TextIcon, EraserIcon, StickyNoteIcon } from '../UI/Icons';

const iconBase = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Marquee-select cursor arrow */
export const LassoIcon = () => (
  <svg {...iconBase}>
    <path d="M6 3 L6 18 L9.5 13.5 L12 19.5 L14 18.5 L11.5 12.5 H17.5 Z" />
  </svg>
);

/** Ruler with graduated ticks */
export const RulerIcon = () => (
  <svg {...iconBase}>
    <rect x="2.5" y="9" width="19" height="6" rx="1.5" />
    <line x1="6"  y1="9" x2="6"  y2="12.5" />
    <line x1="9.5"  y1="9" x2="9.5"  y2="11.5" />
    <line x1="13" y1="9" x2="13" y2="12.5" />
    <line x1="16.5" y1="9" x2="16.5" y2="11.5" />
    <line x1="20" y1="9" x2="20" y2="12.5" />
  </svg>
);

/** Sticky note with fold */
export const StickyIcon = () => (
  <svg {...iconBase}>
    <path d="M5 4 C5 3.4 5.4 3 6 3 H16 L21 8 V20 C21 20.6 20.6 21 20 21 H6 C5.4 21 5 20.6 5 20 V4 Z" />
    <path d="M16 3 V8 H21" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="13" y2="17" />
  </svg>
);

/** Counterclockwise undo arc */
export const UndoIcon = () => (
  <svg {...iconBase} width={18} height={18}>
    <path d="M9 13 H4 V8" />
    <path d="M4 13 C4.5 8 8 5 12.5 5 C17 5 20.5 8.5 20.5 13 C20.5 17.5 17 21 12.5 21 C9.5 21 7 19.5 5.5 17" />
  </svg>
);

export const ClearAllIcon = () => (
  <svg {...iconBase} width={18} height={18}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6 L18 20 C18 20.6 17.6 21 17 21 H7 C6.4 21 6 20.6 6 20 L5 6" />
    <path d="M10 11 V17 M14 11 V17" />
    <path d="M9 6 V4 C9 3.4 9.4 3 10 3 H14 C14.6 3 15 3.4 15 4 V6" />
  </svg>
);

const FloatingToolbar: React.FC = () => {
  const { activeTool, setActiveTool, brushColor, setBrushColor, undo, clearAnnotations, activeDocumentId } = useAppStore();

  const colors = ['#1c1c1e', '#e24361', '#34c759', '#007aff', '#ff9500'];

  const tools = [
    { id: 'select',      icon: <LassoIcon /> },
    { id: 'text',        icon: <TextIcon /> },
    { id: 'sticky',      icon: <StickyIcon /> },
    { id: 'pen',         icon: <PenIcon /> },
    { id: 'highlighter', icon: <HighlighterIcon /> },
    { id: 'ruler',       icon: <RulerIcon /> },
    { id: 'eraser',      icon: <EraserIcon /> },
  ] as const;

  return (
    <div style={{
      position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      backgroundColor: 'var(--fab-bg)', borderRadius: '24px',
      display: 'flex', alignItems: 'center', padding: '8px 12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)', border: '1px solid var(--border-color)',
      gap: '16px', zIndex: 100,
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    }}>

      <button onClick={undo} style={{ padding: '8px', borderRadius: '12px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex' }} title="Undo Stroke">
        <UndoIcon />
      </button>

      <button
        onClick={() => { if (activeDocumentId && window.confirm('Clear all annotations from this document?')) clearAnnotations(activeDocumentId); }}
        style={{ padding: '8px', borderRadius: '12px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger-color)', display: 'flex' }}
        title="Clear All Annotations"
      >
        <ClearAllIcon />
      </button>

      <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />

      <div style={{ display: 'flex', gap: '6px' }}>
        {tools.map(tool => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id as any)}
            style={{
              padding: '8px', borderRadius: '12px', border: 'none', cursor: 'pointer', display: 'flex',
              background: activeTool === tool.id ? 'var(--accent-light)' : 'transparent',
              color: activeTool === tool.id ? 'var(--accent-color)' : 'var(--text-primary)',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />

      <div style={{ display: 'flex', gap: '6px' }}>
        {colors.map(color => (
          <button
            key={color}
            onClick={() => setBrushColor(color)}
            style={{
              width: '22px', height: '22px', borderRadius: '50%', backgroundColor: color,
              border: brushColor === color ? '2px solid white' : '1.5px solid rgba(0,0,0,0.1)',
              outline: brushColor === color ? `2.5px solid ${color}` : 'none',
              cursor: 'pointer', padding: 0,
              transition: 'transform 0.15s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default FloatingToolbar;
