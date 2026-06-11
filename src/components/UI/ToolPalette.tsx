import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { LassoIcon, RulerIcon, StickyIcon, UndoIcon } from '../Layout/FloatingToolbar';
import { PenIcon, HighlighterIcon, TextIcon, EraserIcon } from './Icons';
import './RadialToolMenu.css';

const ToolPalette: React.FC = () => {
  const { activeTool, setActiveTool, brushColor, setBrushColor, brushSize, setBrushSize, undo, activeView } = useAppStore();
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  if (activeView !== 'canvas') return null;

  const colors = ['#1c1c1e', '#e24361', '#34c759', '#007aff', '#ff9500', '#af52de'];

  const mainTools = [
    { id: 'select', label: 'Select', icon: <LassoIcon /> },
    { id: 'text', label: 'Text', icon: <TextIcon /> },
    { id: 'sticky', label: 'Sticky', icon: <StickyIcon /> },
    { id: 'pen', label: 'Pen', icon: <PenIcon /> },
    { id: 'highlighter', label: 'Highlighter', icon: <HighlighterIcon /> },
    { id: 'ruler', label: 'Ruler', icon: <RulerIcon /> },
    { id: 'eraser', label: 'Eraser', icon: <EraserIcon /> },
  ] as const;

  const handleToolClick = (id: string) => {
    if (id === 'undo') {
      undo();
      return;
    }
    setActiveTool(id as typeof activeTool);
    setShowSettings(id === 'pen' || id === 'highlighter');
    setExpanded(false);
  };

  const radius = 136;
  const startAngle = Math.PI * 0.92;
  const endAngle = Math.PI * 1.78;
  const step = mainTools.length > 1 ? (endAngle - startAngle) / (mainTools.length - 1) : 0;

  const polarPosition = (angle: number) => ({
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  });

  const undoAngle = endAngle + 0.38;
  const undoPos = polarPosition(undoAngle);

  return (
    <div className="radial-fab-container">
      {expanded && <div className="radial-fab-backdrop" onClick={() => { setExpanded(false); setShowSettings(false); }} />}

      <div className="radial-tool-orbit">
        {mainTools.map((tool, i) => {
          const { x, y } = polarPosition(startAngle + step * i);
          const isSelected = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              className={`radial-tool-btn ${expanded ? 'visible' : ''} ${isSelected ? 'active' : ''}`}
              style={{
                ['--tx' as string]: `${x}px`,
                ['--ty' as string]: `${y}px`,
                transitionDelay: expanded ? `${i * 35}ms` : '0ms',
                zIndex: 10 + i,
              }}
              onClick={() => handleToolClick(tool.id)}
              title={tool.label}
            >
              {tool.icon}
            </button>
          );
        })}
        <button
          className={`radial-tool-btn ${expanded ? 'visible' : ''}`}
          style={{
            ['--tx' as string]: `${undoPos.x}px`,
            ['--ty' as string]: `${undoPos.y}px`,
            zIndex: 20,
          }}
          onClick={() => handleToolClick('undo')}
          title="Undo"
        >
          <UndoIcon />
        </button>
      </div>

      {showSettings && (activeTool === 'pen' || activeTool === 'highlighter') && (
        <div className="radial-settings-panel">
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 8 }}>COLOR</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {colors.map(c => (
              <button key={c} onClick={() => setBrushColor(c)}
                style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: brushColor === c ? '2px solid #0a7aff' : '1px solid rgba(0,0,0,0.1)', cursor: 'pointer' }} />
            ))}
          </div>
          {activeTool === 'pen' && (
            <>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 4 }}>SIZE: {brushSize}</div>
              <input type="range" min={1} max={12} value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} style={{ width: '100%' }} />
            </>
          )}
        </div>
      )}

      <button
        className={`radial-fab-main ${expanded ? 'open' : ''}`}
        onClick={() => setExpanded(!expanded)}
        title="Tools"
      >
        <PenIcon />
      </button>
    </div>
  );
};

export default ToolPalette;
