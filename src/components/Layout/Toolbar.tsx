import React from 'react';
import { PenIcon, HighlighterIcon, TextIcon, EraserIcon, StickyNoteIcon } from '../UI/Icons';
import { useAppStore } from '../../store/appStore';
import type { ToolType } from '../../store/appStore';

const Toolbar: React.FC = () => {
  const { activeTool, setActiveTool, brushColor, setBrushColor } = useAppStore();

  const renderToolBtn = (tool: ToolType, Icon: React.FC<React.SVGProps<SVGSVGElement>>, label: string) => (
    <button 
      className={`tool-btn ${activeTool === tool ? 'active' : ''}`}
      onClick={() => setActiveTool(tool)}
      title={label}
    >
      <Icon />
    </button>
  );

  return (
    <div style={{
      height: '60px',
      backgroundColor: 'var(--bg-toolbar)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      justifyContent: 'center',
      boxShadow: 'var(--shadow-toolbar)',
      zIndex: 10
    }}>
      <div style={{ display: 'flex', gap: '2px', backgroundColor: 'var(--bg-sidebar)', padding: '4px', borderRadius: '12px' }}>
        {renderToolBtn('pen', PenIcon, 'Pen')}
        {renderToolBtn('highlighter', HighlighterIcon, 'Highlighter')}
        {renderToolBtn('eraser', EraserIcon, 'Eraser')}
        {renderToolBtn('text', TextIcon, 'Text')}
        {renderToolBtn('sticky', StickyNoteIcon, 'Sticky Note')}
      </div>
      
      {/* Dynamic Brush Colors panel */}
      {(activeTool === 'pen' || activeTool === 'highlighter') && (
        <div style={{ marginLeft: '24px', display: 'flex', gap: '8px', padding: '0 12px', borderLeft: '1px solid var(--border-color)' }}>
          {['#1c1c1e', '#ea3323', '#0a7aff', '#34c759', '#ffcc00'].map(color => (
            <button 
              key={color}
              onClick={() => setBrushColor(color)}
              style={{
                width: '26px', height: '26px', borderRadius: '50%', backgroundColor: color, 
                border: brushColor === color ? '2px solid var(--accent-hover)' : '2px solid var(--border-color)', 
                cursor: 'pointer', padding: 0,
                outlineOffset: '2px', outline: brushColor === color ? '2px solid var(--accent-light)' : 'none'
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Toolbar;
