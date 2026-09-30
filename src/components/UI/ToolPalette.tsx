import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { ToolDock, ToolPopover, PEN_COLORS } from './clio';

// The palette's swatches are design tokens ('pen-black'), but a stroke needs a real
// colour: an invalid SVG stroke value resolves to `none`, so the ink never paints.
const resolvePenToken = (token: string) =>
  token.startsWith('#')
    ? token
    : getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim() || token;

const ToolPalette: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    brushColor,
    setBrushColor,
    brushSize,
    setBrushSize,
    undo,
    clearAnnotations,
    activeDocumentId,
    activeView,
    addNotebookPage,
    palmRejection,
    togglePalmRejection,
    markerStraightMode,
    setMarkerStraightMode,
    toggleMarkerStraightMode,
  } = useAppStore();

  const [showPopover, setShowPopover] = useState(false);
  const swatchToken = PEN_COLORS.find((t) => resolvePenToken(t) === brushColor) ?? brushColor;

  if (activeView !== 'canvas') return null;

  const handleSelectTool = (toolId: string) => {
    setActiveTool(toolId as any);
    if (['pen', 'pencil', 'highlighter'].includes(toolId)) {
      setShowPopover((prev) => !prev);
    } else {
      setShowPopover(false);
    }
  };

  const handleClear = () => {
    if (activeDocumentId && confirm('Clear all annotations on this page?')) {
      clearAnnotations(activeDocumentId);
    }
  };

  const handleAddPage = () => {
    if (activeDocumentId) {
      addNotebookPage(activeDocumentId);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {showPopover && (
        <div style={{ pointerEvents: 'auto', marginBottom: 4 }}>
          <ToolPopover
            tool={activeTool}
            size={brushSize}
            color={swatchToken}
            palmRejection={palmRejection}
            markerStraightMode={markerStraightMode}
            onToolChange={(t) => setActiveTool(t as any)}
            onSizeChange={(s) => setBrushSize(s)}
            onColorChange={(c) => setBrushColor(resolvePenToken(c))}
            onPalmRejectionChange={togglePalmRejection}
            onMarkerStraightModeChange={(val) => setMarkerStraightMode(val)}
          />
        </div>
      )}

      {activeTool === 'highlighter' && !showPopover && (
        <div style={{ pointerEvents: 'auto', marginBottom: -4 }}>
          <button
            onClick={toggleMarkerStraightMode}
            style={{
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              background: markerStraightMode ? 'var(--primary, #2a2724)' : 'rgba(255, 255, 255, 0.92)',
              color: markerStraightMode ? 'var(--ink-inverse, #fff)' : 'var(--ink, #2a2724)',
              border: markerStraightMode ? '1px solid var(--primary, #2a2724)' : '1px solid var(--line, rgba(0,0,0,0.15))',
              boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              transition: 'all 0.15s ease',
            }}
            title="Toggle straight lines for Marker (or hold Shift / pause at stroke end)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="12" x2="20" y2="12" />
              <polyline points="14 6 20 12 14 18" />
            </svg>
            <span>{markerStraightMode ? 'Straight lines: ON' : 'Straight lines: Auto'}</span>
          </button>
        </div>
      )}

      <div style={{ pointerEvents: 'auto' }}>
        <ToolDock
          active={activeTool}
          color={swatchToken}
          onSelect={handleSelectTool}
          onUndo={undo}
          onClear={handleClear}
          onAddPage={handleAddPage}
        />
      </div>
    </div>
  );
};

export default ToolPalette;
