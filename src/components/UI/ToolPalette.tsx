import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import type { ToolType } from '../../store/appStore';

// Icon helpers
import { LassoIcon, RulerIcon, StickyIcon, UndoIcon } from '../Layout/FloatingToolbar';
import { PenIcon, HighlighterIcon, TextIcon, EraserIcon } from '../UI/Icons';

const ToolPalette: React.FC = () => {
  const { activeTool, setActiveTool, brushColor, setBrushColor, brushSize, setBrushSize, undo, activeView } = useAppStore();
  const [showSettings, setShowSettings] = useState(false);

  if (activeView !== 'canvas') return null;

  const colors = ['#1c1c1e', '#e24361', '#34c759', '#007aff', '#ff9500', '#af52de'];

  const tools = [
    { id: 'select', label: 'Select / Lasso', icon: <LassoIcon /> },
    { id: 'text', label: 'Text Input', icon: <TextIcon /> },
    { id: 'sticky', label: 'Sticky Note', icon: <StickyIcon /> },
    { id: 'pen', label: 'Drawing Pen', icon: <PenIcon /> },
    { id: 'highlighter', label: 'Highlighter', icon: <HighlighterIcon /> },
    { id: 'ruler', label: 'Ruler Tool', icon: <RulerIcon /> },
    { id: 'eraser', label: 'Eraser', icon: <EraserIcon /> },
  ] as const;

  const activeToolLabel = tools.find(t => t.id === activeTool)?.label || 'Pen';

  return (
    <div 
      style={{ 
        position: 'absolute', 
        left: '24px', 
        top: '24px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px',
        zIndex: 200 
      }}
    >
      
      {/* Main Tool Palette vertical glass card */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '10px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px', 
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          boxShadow: 'rgba(31, 38, 135, 0.1) 0 8px 32px',
          border: '1px solid rgba(255, 255, 255, 0.5)'
        }}
      >
        
        {/* Undo Action */}
        <button 
          onClick={undo} 
          style={{ 
            padding: '10px', 
            borderRadius: '12px', 
            border: 'none', 
            background: 'transparent', 
            cursor: 'pointer', 
            color: '#1c1c1e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center' 
          }} 
          title="Undo Last Stroke"
          className="btn-animate"
        >
          <UndoIcon />
        </button>

        <div style={{ height: '1px', backgroundColor: 'rgba(0,0,0,0.06)', margin: '4px 0' }} />

        {/* Tools Loop */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {tools.map(tool => {
            const isSelected = activeTool === tool.id;
            return (
              <button 
                key={tool.id} 
                onClick={() => {
                  setActiveTool(tool.id as any);
                  if (tool.id === 'pen' || tool.id === 'highlighter') {
                    setShowSettings(true);
                  } else {
                    setShowSettings(false);
                  }
                }}
                style={{ 
                  padding: '10px', 
                  borderRadius: '12px', 
                  border: 'none', 
                  background: isSelected ? 'rgba(10, 122, 255, 0.12)' : 'transparent', 
                  cursor: 'pointer', 
                  color: isSelected ? '#0a7aff' : '#1c1c1e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
                title={tool.label}
                className="btn-animate"
              >
                {tool.icon}
                {isSelected && (
                  <div style={{ position: 'absolute', left: 0, top: '25%', width: '3px', height: '50%', backgroundColor: '#0a7aff', borderRadius: '0 4px 4px 0' }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Brush config slider trigger */}
        {(activeTool === 'pen' || activeTool === 'highlighter') && (
          <>
            <div style={{ height: '1px', backgroundColor: 'rgba(0,0,0,0.06)', margin: '4px 0' }} />
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                padding: '8px',
                borderRadius: '10px',
                border: 'none',
                background: showSettings ? 'rgba(0,0,0,0.04)' : 'transparent',
                cursor: 'pointer',
                color: '#8e8e93',
                fontSize: '11px',
                fontWeight: 800,
                textAlign: 'center'
              }}
              className="btn-animate"
            >
              🎨
            </button>
          </>
        )}

      </div>

      {/* Expanded side configuration panel for colors and size */}
      {showSettings && (activeTool === 'pen' || activeTool === 'highlighter') && (
        <div 
          className="glass-card" 
          style={{ 
            position: 'absolute',
            left: '64px',
            top: '40px',
            padding: '16px',
            width: '180px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#8e8e93', letterSpacing: '0.5px' }}>
            {activeToolLabel.toUpperCase()} CONFIG
          </div>

          {/* Color Matrix */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {colors.map(color => (
              <button 
                key={color} 
                onClick={() => setBrushColor(color)}
                style={{ 
                  width: '28px', 
                  height: '28px', 
                  borderRadius: '50%', 
                  backgroundColor: color, 
                  border: brushColor === color ? '2px solid white' : 'none', 
                  outline: brushColor === color ? `2px solid ${color}` : 'none', 
                  cursor: 'pointer', 
                  padding: 0
                }}
                className="btn-animate"
              />
            ))}
          </div>

          <div style={{ height: '1px', backgroundColor: 'rgba(0,0,0,0.05)' }} />

          {/* Brush Thickness Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 800, color: '#48484a' }}>
              <span>SIZE</span>
              <span>{brushSize}px</span>
            </div>
            <input 
              type="range" 
              min={1} 
              max={activeTool === 'highlighter' ? 30 : 15} 
              value={brushSize}
              onChange={e => setBrushSize(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer', accentColor: '#0a7aff' }}
            />
          </div>

        </div>
      )}

      {/* Internal animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

    </div>
  );
};

export default ToolPalette;
